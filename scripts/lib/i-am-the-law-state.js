import { MODULE_ID } from "../constants.js";

// 팔라딘 I Am The Law 원문: "그 NPC를 상대로 한 다음 판정에 +1/-1". 원조/
// 방해의 pendingRollBonus(제한 없이 다음 판정 아무거나에 적용)와 달리, 이
// 보정치는 "정말 그 NPC를 상대로 한 판정인지"를 매번 확인받아야만 소모된다
// — 확인 전까지는 액터가 어떤 판정을 하든 계속 대기 상태로 남는다(features/
// i-am-the-law.js의 promptIAmTheLawPreRoll이 lib/roll-wrapper.js를 통해
// 모든 판정 전에 물어본다).
const FLAG = "iAmTheLawPending"; // { amount: number, source: string } | null

export function getIAmTheLawPending(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setIAmTheLawPending(actor, amount, source) {
  await actor.setFlag(MODULE_ID, FLAG, { amount, source });
}

export async function clearIAmTheLawPending(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
}
