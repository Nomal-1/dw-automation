// 액터가 현재 유지하고 있는 지속형 주문 목록을 flag로 추적한다.
// flags.dw-automation.activeOngoingSpells = [{ itemId, name, castPenalty }, ...]
import { MODULE_ID, SETTINGS } from "../constants.js";

const FLAG_KEY = "activeOngoingSpells";
export const COMMUNE_PENALTY_FLAG = "communePenaltyCount";

export function getActiveOngoingSpells(actor) {
  return actor.getFlag(MODULE_ID, FLAG_KEY) ?? [];
}

export function getOngoingSpellConfig(spellName) {
  const catalog = game.settings.get(MODULE_ID, SETTINGS.ONGOING_SPELLS);
  return catalog.find((s) => s.name === spellName) ?? null;
}

/** 지속형 주문 데이터베이스에 있는 주문이면 활성 목록에 추가하고 설정을 반환한다.
 *  지속형이 아니면 아무것도 안 하고 null을 반환한다. */
export async function addActiveOngoingSpell(actor, item) {
  const config = getOngoingSpellConfig(item.name);
  if (!config) return null;

  const current = getActiveOngoingSpells(actor);
  if (current.some((s) => s.itemId === item.id)) return config;

  const next = [...current, { itemId: item.id, name: item.name, castPenalty: config.castPenalty }];
  await actor.setFlag(MODULE_ID, FLAG_KEY, next);
  return config;
}

export async function removeActiveOngoingSpell(actor, itemId) {
  const current = getActiveOngoingSpells(actor);
  const next = current.filter((s) => s.itemId !== itemId);
  await actor.setFlag(MODULE_ID, FLAG_KEY, next);
}

/** 현재 유지 중인 지속 주문들 + 부분성공에서 고른 "다음 기원까지 -1" 페널티로
 *  인한 "주문 시전" 굴림 페널티를 계산한다. blocked인 주문이 하나라도 있으면
 *  완전히 막히고, 아니면 minus1 개수 + 서약 페널티만큼 감산한다. */
export function computeCastPenalty(actor) {
  const active = getActiveOngoingSpells(actor);
  if (active.some((s) => s.castPenalty === "blocked")) {
    return { blocked: true, amount: 0 };
  }
  const fromSpells = active.filter((s) => s.castPenalty === "minus1").length;
  const communePenalty = Number(actor.getFlag(MODULE_ID, COMMUNE_PENALTY_FLAG)) || 0;
  return { blocked: false, amount: fromSpells + communePenalty };
}
