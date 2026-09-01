import { MODULE_ID } from "../constants.js";

const FLAG = "dopplegangersDanceHiding";

export function isHidingTell(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? false;
}

export async function setHidingTell(actor, value) {
  await actor.setFlag(MODULE_ID, FLAG, value);
}
