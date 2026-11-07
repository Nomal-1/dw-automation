import { MODULE_ID } from "../constants.js";

const FLAG = "duelistParryActive";

export function isDuelistParryActive(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? false;
}

export async function setDuelistParryActive(actor, value) {
  await actor.setFlag(MODULE_ID, FLAG, value);
}

// 켜질 때 실제로 더한 장갑량(호신술 +1 / 호신비결 +2). 꺼질 때 같은 양을 빼야
// 중간에 호신술에서 호신비결로 바뀌어도 장갑이 어긋나지 않는다.
const AMOUNT_FLAG = "duelistParryAmount";

export function getDuelistParryAmount(actor) {
  return Number(actor.getFlag(MODULE_ID, AMOUNT_FLAG)) || 1;
}

export async function setDuelistParryAmount(actor, amount) {
  await actor.setFlag(MODULE_ID, AMOUNT_FLAG, amount);
}
