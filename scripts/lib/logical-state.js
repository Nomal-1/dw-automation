import { MODULE_ID } from "../constants.js";

const MODE_FLAG = "logicalMode"; // "ask" | "on" | "off"
const ORDER = ["ask", "on", "off"];

export function getLogicalMode(actor) {
  return actor.getFlag(MODULE_ID, MODE_FLAG) ?? "ask";
}

export async function setLogicalMode(actor, mode) {
  await actor.setFlag(MODULE_ID, MODE_FLAG, mode);
}

export function nextLogicalMode(mode) {
  const index = ORDER.indexOf(mode);
  return ORDER[(index + 1) % ORDER.length];
}
