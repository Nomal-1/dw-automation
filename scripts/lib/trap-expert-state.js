import { MODULE_ID } from "../constants.js";

// 덫 전문가(Trap Expert) 예비 점수. 던전월드 시스템 자체의 Hold 속성과는
// 별개의 값을 쓴다 — 다른 무브(예: 드루이드 변신)가 이미 시스템 Hold를
// 쓰고 있어 뒤섞이면 안 되고, 이 무브는 다이얼로그 없이 배지 숫자만
// 보여주고 클릭으로 1씩 줄이는 단순한 카운터를 요청받았기 때문이다.
const HOLD_FLAG = "trapExpertHold"; // number, 0 이상

export function getTrapExpertHold(actor) {
  return Number(actor.getFlag(MODULE_ID, HOLD_FLAG)) || 0;
}

export async function setTrapExpertHold(actor, value) {
  const clamped = Math.max(0, Math.floor(Number(value) || 0));
  if (clamped === 0) {
    await actor.unsetFlag(MODULE_ID, HOLD_FLAG);
  } else {
    await actor.setFlag(MODULE_ID, HOLD_FLAG, clamped);
  }
}
