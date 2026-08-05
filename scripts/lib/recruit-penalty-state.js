import { MODULE_ID } from "../constants.js";

// 던전월드 기본 무브 구인(Recruit) 원문 중 "지원자를 돌려보내면 다음 구인
// 판정에 -1 forward를 받는다" 부분. 단순 불리언 하나면 충분하다(액터당 한
// 번에 하나만, 다음 구인 판정 한 번에만 적용되고 소모된다).
const FLAG = "recruitPenaltyPending";

export function isRecruitPenaltyPending(actor) {
  return Boolean(actor.getFlag(MODULE_ID, FLAG));
}

export async function setRecruitPenaltyPending(actor, value) {
  if (value) {
    await actor.setFlag(MODULE_ID, FLAG, true);
  } else {
    await actor.unsetFlag(MODULE_ID, FLAG);
  }
}
