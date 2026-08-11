import { MODULE_ID } from "../constants.js";

// 전사 고급액션 죽음의 예감(Through Death's Eyes) 원문: "실패하면, 자기
// 자신의 죽음을 예감하고 전투 동안 판정에 계속 -1을 받습니다." 판정이
// 끝나는 순간 실패 여부를 이미 알 수 있어서(hunger-penalty 등과 달리
// 물어볼 필요 없이) 실패하면 자동으로 켠다. 언제 전투가 끝나는지는 알 수
// 없어서 끄는 시점은 마스터가 직접 정한다.
const FLAG = "throughDeathsEyesActive"; // boolean

export function isThroughDeathsEyesActive(actor) {
  return Boolean(actor.getFlag(MODULE_ID, FLAG));
}

export async function setThroughDeathsEyesActive(actor, value) {
  await actor.setFlag(MODULE_ID, FLAG, value);
}
