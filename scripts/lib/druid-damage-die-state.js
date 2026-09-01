import { MODULE_ID } from "../constants.js";

const FLAG = "druidDamageDieActive";

export function isDamageDieActive(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? false;
}

export async function setDamageDieActive(actor, value) {
  await actor.setFlag(MODULE_ID, FLAG, value);
}
