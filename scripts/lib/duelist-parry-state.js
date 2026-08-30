import { MODULE_ID } from "../constants.js";

const FLAG = "duelistParryActive";

export function isDuelistParryActive(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? false;
}

export async function setDuelistParryActive(actor, value) {
  await actor.setFlag(MODULE_ID, FLAG, value);
}
