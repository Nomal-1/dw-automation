import { MODULE_ID } from "../constants.js";

// 야만전사 헤라클레스의 욕망(Herculean Appetites)의 두 토글.
// - askMode(true가 기본): 판정마다 "이 판정이 욕망을 쫓는 액션입니까?"를
//   묻는다. false(묻지 않기)면 안 묻고 active 상태를 그대로 쓴다.
// - active: askMode가 꺼져 있을 때 이번 판정에 적용할지를 대신 결정하는
//   상태(묻기 모드에서는 참고되지 않는다).
const ASK_FLAG = "heraclesAskMode";
const ACTIVE_FLAG = "heraclesActive";

export function isHeraclesAskMode(actor) {
  const value = actor.getFlag(MODULE_ID, ASK_FLAG);
  return value === undefined ? true : Boolean(value);
}

export async function setHeraclesAskMode(actor, value) {
  await actor.setFlag(MODULE_ID, ASK_FLAG, value);
}

export function isHeraclesActive(actor) {
  return Boolean(actor.getFlag(MODULE_ID, ACTIVE_FLAG));
}

export async function setHeraclesActive(actor, value) {
  await actor.setFlag(MODULE_ID, ACTIVE_FLAG, value);
}
