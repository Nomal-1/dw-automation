import { MODULE_ID } from "../constants.js";

// 위저드 Know-It-All 원문: "조언을 따르면 +1 forward, 조언한 위저드는 XP
// 마크." "조언을 따랐는지"는 원조/방해의 대상 보정치(다음 판정 아무거나에
// 적용)와 달리 매번 판단이 필요해서, I Am The Law와 같은 방식으로 대상의
// 다음 판정마다 확인한다. 이 플래그는(I Am The Law와 달리) 조언을 준
// 위저드가 아니라 조언을 받은 대상 액터에 저장된다 — 판정을 하는 쪽이
// 대상이기 때문이다.
const FLAG = "knowItAllPending"; // { grantorActorId: string, grantorName: string } | null

export function getKnowItAllPending(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setKnowItAllPending(actor, grantorActorId, grantorName) {
  await actor.setFlag(MODULE_ID, FLAG, { grantorActorId, grantorName });
}

export async function clearKnowItAllPending(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
}
