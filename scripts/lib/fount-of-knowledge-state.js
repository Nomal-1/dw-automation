import { MODULE_ID } from "../constants.js";

const ASK_MODE_FLAG = "fountOfKnowledgeAskMode";

export function isFountOfKnowledgeAskMode(actor) {
  return actor.getFlag(MODULE_ID, ASK_MODE_FLAG) ?? true;
}

export async function setFountOfKnowledgeAskMode(actor, value) {
  await actor.setFlag(MODULE_ID, ASK_MODE_FLAG, value);
}
