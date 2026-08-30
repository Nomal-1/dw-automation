import { MODULE_ID } from "../constants.js";

const FLAG = "loveTruckActive";

export function isLoveTruckActive(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? false;
}

export async function setLoveTruckActive(actor, value) {
  await actor.setFlag(MODULE_ID, FLAG, value);
}
