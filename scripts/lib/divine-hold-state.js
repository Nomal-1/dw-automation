// 클레릭 Divine Intervention/Invincibility 전용: "기원(Commune)할 때 hold를
// 얻고(이전 hold는 소멸), 피격 시 hold 1개를 써서 피해를 완전 무효화한다."
// hold 개수를 액터 플래그로 추적한다.
import { MODULE_ID } from "../constants.js";

const HOLD_FLAG = "divineHold";

export function getHold(actor) {
  return Number(actor.getFlag(MODULE_ID, HOLD_FLAG)) || 0;
}

export async function setHold(actor, amount) {
  await actor.setFlag(MODULE_ID, HOLD_FLAG, Math.max(0, amount));
}
