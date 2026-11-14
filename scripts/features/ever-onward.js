import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { setPendingRollBonus } from "../lib/roll-bonus-state.js";
import { getPendingArmorRemoval, setPendingArmorRemoval, clearPendingArmorRemoval } from "../lib/ever-onward-state.js";

// 팔라딘 무브 끝없는 전진(Ever Onward, 돌격의 6레벨 상위 무브) 원문: "전투에
// 앞장서서 돌격을 이끌 때, 이끄는 아군은 +1 forward와 +2 장갑 forward를
// 받는다." 돌격(features/charge.js)과 달리 GM 요청대로 이 자동화는 아군
// 한 명만 지정한다. "장갑 forward"는 결투사의 호신술(features/
// duelist-parry.js)과 같은 "다음에 실제로 맞을 때까지만 유지되는 임시
// 장갑"이라, 즉시 +2를 더하고 lib/ever-onward-state.js에 "다음 피격 때
// -2 해야 한다"는 예약을 걸어둔다 — features/hit-trigger.js가 그 대상이
// 실제로 피해를 입는 순간(damage > 0으로 확정된 직후) 이 예약을 소모한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_EVER_ONWARD_ASSISTANT);
}

function splitCommaList(settingKey) {
  const parse = (value) =>
    String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const names = parse(game.settings.get(MODULE_ID, settingKey));
  // 이름 목록이면 설정 기본값(원문 영어 이름)도 항상 포함한다. 번역 자동 채우기가
  // 기본값을 한글로 바꿔 넣어도, 아이템의 원문 이름(flags.babele.originalName)으로
  // 계속 알아볼 수 있게 하기 위해서다. 한글 카드 제목과는 겹치지 않아 해가 없다.
  if (!settingKey.endsWith("Names")) return names;
  const defaults = parse(game.settings.settings.get(`${MODULE_ID}.${settingKey}`)?.default);
  return [...new Set([...names, ...defaults])];
}

function matchesConfiguredNameByTitle(title) {
  return splitCommaList(SETTINGS.EVER_ONWARD_MOVE_NAMES).includes(title);
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
function matchesConfiguredName(title, originalTitle = null) {
  const byTitle = matchesConfiguredNameByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return matchesConfiguredNameByTitle(originalTitle);
}

async function adjustArmor(actor, delta) {
  const current = Number(actor.system.attributes?.ac?.value) || 0;
  const next = Math.max(0, current + delta);
  await actor.update({ "system.attributes.ac.value": next });
  return next;
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, originalTitle } = info;
    if (actor.type !== "character") return;

    if (!matchesConfiguredName(title, originalTitle)) return;

    const ally = await promptActorTarget(actor, {
      title,
      label: game.i18n.localize("DWAUTO.EverOnward.TargetLabel"),
      excludeSelf: true
    });
    if (!ally) return;

    await setPendingRollBonus(ally, 1, title, null);
    const armor = await adjustArmor(ally, 2);
    await setPendingArmorRemoval(ally, 2, title);

    announceActionApplied(actor, title, game.i18n.format("DWAUTO.EverOnward.Applied", { name: ally.name, armor }));
  } catch (err) {
    console.error(`${MODULE_ID} | ever-onward: onCreateChatMessage failed`, err);
  }
}

// features/hit-trigger.js가 이 액터의 HP가 실제로 줄어드는 게 확정된
// 직후(damage > 0) 호출한다. 끝없는 전진의 임시 장갑 예약이 없으면 조용히
// 통과한다.
export async function applyEverOnwardArmorRemovalOnHit(actor) {
  if (!isEnabled()) return;

  const pending = getPendingArmorRemoval(actor);
  if (!pending) return;

  await clearPendingArmorRemoval(actor);
  const current = Number(actor.system.attributes?.ac?.value) || 0;
  const next = Math.max(0, current - pending.amount);
  await actor.update({ "system.attributes.ac.value": next });

  announceActionApplied(actor, pending.source, game.i18n.format("DWAUTO.EverOnward.ArmorRemoved", { armor: next }));
}

export function registerEverOnwardAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
