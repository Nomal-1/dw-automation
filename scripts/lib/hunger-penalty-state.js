// 바바리안 Indestructible Hunger 전용: "피해를 받는 대신 욕구를 채울
// 때까지 -1 ongoing을 진다. 이미 이 페널티를 지고 있으면 이 선택지를 다시
// 고를 수 없다." "욕구를 채움"은 features/animal-companion-state.js의
// "몇 시간 휴식"과 같은 이유로 채팅 트리거로 자동 감지할 수 없어서,
// 캐릭터 시트의 배지를 클릭해 수동으로 되돌린다.
import { MODULE_ID } from "../constants.js";

const HUNGER_PENALTY_FLAG = "indestructibleHungerPenalty";

export function isHungerPenaltyActive(actor) {
  return Boolean(actor.getFlag(MODULE_ID, HUNGER_PENALTY_FLAG));
}

export async function setHungerPenaltyActive(actor, active) {
  if (active) {
    await actor.setFlag(MODULE_ID, HUNGER_PENALTY_FLAG, true);
  } else {
    await actor.unsetFlag(MODULE_ID, HUNGER_PENALTY_FLAG);
  }
}
