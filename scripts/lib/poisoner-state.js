import { MODULE_ID } from "../constants.js";

// 독의 기술(Poisoner)은 딱 하나의 독을 골라 평생 그 독만 다룬다(원문: "다음
// 중에서 독을 하나 고르십시오"). 한 번 고르면 바뀌지 않으므로 문자열 하나만
// 저장한다.
const CHOICE_FLAG = "poisonerChoice"; // string | undefined

export function getPoisonerChoice(actor) {
  return actor.getFlag(MODULE_ID, CHOICE_FLAG) ?? null;
}

export async function setPoisonerChoice(actor, name) {
  await actor.setFlag(MODULE_ID, CHOICE_FLAG, name);
}
