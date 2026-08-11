import { MODULE_ID } from "../constants.js";

// 전사 고급액션 전사의 눈(Seeing Red) 원문: "When you Discern Realities
// during combat, you take +1." 지금이 전투 중인지는 이 모듈이 알 방법이
// 없어서, 상황파악을 처음 성공/발동했을 때 한 번 물어보고 그 뒤로는 이
// boolean 하나로 "지금 전투 중으로 취급할지"를 계속 추적한다. 끄는 시점은
// 마스터가 직접 정해서 수동으로 끈다(전투가 끝났는지도 자동으로 알 수
// 없으므로).
const FLAG = "seeingRedActive"; // boolean

export function isSeeingRedActive(actor) {
  return Boolean(actor.getFlag(MODULE_ID, FLAG));
}

export async function setSeeingRedActive(actor, value) {
  await actor.setFlag(MODULE_ID, FLAG, value);
}
