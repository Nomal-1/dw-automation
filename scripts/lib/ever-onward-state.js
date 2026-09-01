import { MODULE_ID } from "../constants.js";

const FLAG = "everOnwardArmorPending"; // { amount: number, source: string } | undefined

export function getPendingArmorRemoval(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setPendingArmorRemoval(actor, amount, source) {
  await actor.setFlag(MODULE_ID, FLAG, { amount, source });
}

export async function clearPendingArmorRemoval(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
}
