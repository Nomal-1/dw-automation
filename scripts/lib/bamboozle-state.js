import { MODULE_ID } from "../constants.js";

const FLAG = "bamboozleActive";

export function isBamboozleActive(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? false;
}

export async function setBamboozleActive(actor, value) {
  await actor.setFlag(MODULE_ID, FLAG, value);
}
