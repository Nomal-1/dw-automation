import { MODULE_ID } from "../constants.js";

// 야만전사 뭘 기다리는 거야?(What Are You Waiting For?)의 "적용중/적용안됨"
// 상태. 10+ 성공 시 자동으로 켜지고, 언제 꺼지는지는(전투가 끝났는지 등)
// 자동 감지할 수 없어서 수동 토글로 관리한다(features/what-are-you-waiting-for.js
// 참고).
const FLAG = "waitingForActive";

export function isWaitingForActive(actor) {
  return Boolean(actor.getFlag(MODULE_ID, FLAG));
}

export async function setWaitingForActive(actor, active) {
  await actor.setFlag(MODULE_ID, FLAG, active);
}
