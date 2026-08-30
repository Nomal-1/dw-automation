import { MODULE_ID } from "../constants.js";

const ASK_MODE_FLAG = "onTheMoveAskMode";
const ACTIVE_FLAG = "onTheMoveActive";

export function isOnTheMoveAskMode(actor) {
  return actor.getFlag(MODULE_ID, ASK_MODE_FLAG) ?? true;
}

export async function setOnTheMoveAskMode(actor, value) {
  await actor.setFlag(MODULE_ID, ASK_MODE_FLAG, value);
}

export function isOnTheMoveActive(actor) {
  return actor.getFlag(MODULE_ID, ACTIVE_FLAG) ?? false;
}

export async function setOnTheMoveActive(actor, value) {
  await actor.setFlag(MODULE_ID, ACTIVE_FLAG, value);
}
