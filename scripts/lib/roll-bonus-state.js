import { MODULE_ID } from "../constants.js";

// 원조/방해(Aid or Interfere)의 "+1 또는 -2"처럼 "그 사람이 다음에 무슨
// 판정을 하든 한 번만 적용되고 사라지는" 보정치. lib/roll-wrapper.js가 이
// 액터가 실제로 무브를 굴릴 때 rollMod에 반영한 뒤 소모(제거)한다. 액터당
// 하나만 유지한다 — 동시에 여러 개가 걸리는 일은 드물고(원조/방해는 한
// 사람이 한 번에 하나만 받는다는 것이 RAW), 겹치면 마지막에 건 것으로
// 덮어쓴다.
const FLAG = "pendingRollBonus"; // { amount: number, source: string }

export function getPendingRollBonus(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setPendingRollBonus(actor, amount, source) {
  await actor.setFlag(MODULE_ID, FLAG, { amount, source });
}

export async function clearPendingRollBonus(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
}
