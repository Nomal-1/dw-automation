import { MODULE_ID } from "../constants.js";

// 클레릭 회개(Martyr)의 "다음 번 주문 시전으로 주는 피해나 치유에 자기
// 레벨만큼을 더한다"처럼, 다음 번 주문 피해/치유 굴림에 한 번 더해지고
// 사라지는 보너스. lib/roll-bonus-state.js(판정 자체에 붙는 forward)와는
// 별개다 — 그건 2d6+능력치 판정에 붙고, 이건 그 뒤에 이어지는 피해/치유
// "양"에 붙는다. features/hit-trigger.js가 걸고, features/healing.js(치유)와
// features/spell-damage.js(피해)가 각자 소모한다.
const FLAG = "pendingSpellEffectBonus"; // { amount: number, source: string } | undefined

export function getPendingSpellEffectBonus(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setPendingSpellEffectBonus(actor, amount, source) {
  await actor.setFlag(MODULE_ID, FLAG, { amount, source });
}

// 대기 중인 보너스를 읽고 즉시 지운다(있으면 { amount, source }, 없으면 null).
export async function consumePendingSpellEffectBonus(actor) {
  const pending = getPendingSpellEffectBonus(actor);
  if (!pending) return null;
  await actor.unsetFlag(MODULE_ID, FLAG);
  return pending;
}
