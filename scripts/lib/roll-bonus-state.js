import { MODULE_ID } from "../constants.js";

// 원조/방해(Aid or Interfere)의 "+1 또는 -2"처럼 "그 사람이 다음에 무슨
// 판정을 하든 한 번만 적용되고 사라지는" 보정치. lib/roll-wrapper.js가 이
// 액터가 실제로 무브를 굴릴 때 rollMod에 반영한 뒤 소모(제거)한다. 액터당
// 하나만 유지한다 — 동시에 여러 개가 걸리는 일은 드물고(원조/방해는 한
// 사람이 한 번에 하나만 받는다는 것이 RAW), 겹치면 마지막에 건 것으로
// 덮어쓴다.
//
// restrictToMoveNames(선택)는 My Love For You Is Like A Truck("협상 판정에만
// +1")처럼 "다음 판정 아무거나"가 아니라 "특정 무브의 다음 판정에만" 적용
// 되는 경우를 위한 것이다 — null/빈 배열이면 원조/방해처럼 제한 없이
// 적용된다. roll-wrapper.js는 이 목록과 안 맞는 판정을 만나면 보너스를
// 소모하지 않고 그대로 남겨둔다(맞는 판정이 나올 때까지 계속 대기).
const FLAG = "pendingRollBonus"; // { amount: number, source: string, restrictToMoveNames: string[] | null }

export function getPendingRollBonus(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setPendingRollBonus(actor, amount, source, restrictToMoveNames = null) {
  await actor.setFlag(MODULE_ID, FLAG, { amount, source, restrictToMoveNames });
}

// pendingBonus가 지금 굴리는 무브(moveName)에 실제로 적용되는지 확인한다.
export function rollBonusAppliesTo(pendingBonus, moveName) {
  if (!pendingBonus) return false;
  if (!pendingBonus.restrictToMoveNames || pendingBonus.restrictToMoveNames.length === 0) return true;
  return pendingBonus.restrictToMoveNames.includes(moveName);
}

export async function clearPendingRollBonus(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
}
