import { MODULE_ID } from "../constants.js";

// 이러면 더 안전하오(A Safer Place)가 "파수에 +1"과는 별개로 추가로 거는
// "다음 판정 아무거나 +1 forward"용 대기 플래그. 파수 전용 보너스는
// lib/roll-bonus-state.js(액터당 한 슬롯)를 그대로 쓰지만, 이 무브는 같은
// 대상에게 두 가지 보너스를 동시에 걸어야 해서(파수 전용 + 무엇이든) 그
// 슬롯 하나로는 부족하다 — 이 플래그가 그 두 번째 보너스를 담당한다.
const FLAG = "saferPlaceForwardPending";

export function isSaferPlaceForwardPending(actor) {
  return Boolean(actor.getFlag(MODULE_ID, FLAG));
}

export async function setSaferPlaceForwardPending(actor, value) {
  if (value) {
    await actor.setFlag(MODULE_ID, FLAG, true);
  } else {
    await actor.unsetFlag(MODULE_ID, FLAG);
  }
}
