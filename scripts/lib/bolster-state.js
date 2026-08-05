import { MODULE_ID } from "../constants.js";

// 던전월드 기본 무브 수련(Bolster): 발동하면 예비(preparation)를 얻고,
// 나중에 판정 하나마다 예비 1점을 써서 +1을 받는다(판정당 한 번만). 예비는
// 숫자 카운터라(단순 온/오프 플래그가 아니다) 액터당 하나만 유지한다.
const RESERVE_FLAG = "bolsterReserve"; // number, 0 이상
const ASK_FLAG = "bolsterAskEnabled"; // boolean, 값이 없으면(처음이면) 기본 true(묻기)

export function getBolsterReserve(actor) {
  return Number(actor.getFlag(MODULE_ID, RESERVE_FLAG)) || 0;
}

export async function setBolsterReserve(actor, value) {
  const clamped = Math.max(0, Math.floor(Number(value) || 0));
  if (clamped === 0) {
    await actor.unsetFlag(MODULE_ID, RESERVE_FLAG);
  } else {
    await actor.setFlag(MODULE_ID, RESERVE_FLAG, clamped);
  }
}

export function isBolsterAskEnabled(actor) {
  const value = actor.getFlag(MODULE_ID, ASK_FLAG);
  return value === undefined ? true : Boolean(value);
}

export async function setBolsterAskEnabled(actor, value) {
  await actor.setFlag(MODULE_ID, ASK_FLAG, value);
}
