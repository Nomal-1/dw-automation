import { MODULE_ID } from "../constants.js";

// 소각술사 고급액션 곱절로 밝게 타올라(Burns Twice As Bright) 원문: "반절로
// 길게 타올라를 사용하기 전까지 이 액션을 다시 사용할 수 없습니다." 이
// 잠금 상태를 boolean 하나로 추적한다 — 곱절로 밝게 타올라를 쓰면 true,
// 반절로 길게 타올라를 쓰면 false로 되돌아간다.
const FLAG = "twiceAsBrightUsed"; // boolean

export function isTwiceAsBrightUsed(actor) {
  return Boolean(actor.getFlag(MODULE_ID, FLAG));
}

export async function setTwiceAsBrightUsed(actor, value) {
  await actor.setFlag(MODULE_ID, FLAG, value);
}
