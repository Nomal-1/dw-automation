// 레인저 Man's Best Friend 전용: "동반 동물이 대신 맞아주면 피해를 무효화하고
// 사나움(ferocity)이 0이 된다(이미 0이면 못 씀). 몇 시간 휴식하면 정상으로
// 돌아온다." 이 모듈은 동반 동물의 사나움 수치 자체를 추적하지 않으므로
// (Animal Companion은 features/note-moves.js에서 자유 기입형 메모로만 관리),
// "사나움을 썼는지"만 boolean으로 단순화해서 추적한다. "몇 시간 휴식"은 채팅
// 트리거로 자동 감지할 수 없어서, 캐릭터 시트의 배지를 클릭해 수동으로
// 되돌린다.
import { MODULE_ID } from "../constants.js";

const FEROCITY_SPENT_FLAG = "manBestFriendFerocitySpent";

export function isFerocitySpent(actor) {
  return Boolean(actor.getFlag(MODULE_ID, FEROCITY_SPENT_FLAG));
}

export async function setFerocitySpent(actor, spent) {
  if (spent) {
    await actor.setFlag(MODULE_ID, FEROCITY_SPENT_FLAG, true);
  } else {
    await actor.unsetFlag(MODULE_ID, FEROCITY_SPENT_FLAG);
  }
}
