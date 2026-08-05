import { MODULE_ID } from "../constants.js";

// 기본액션 방어(Defend): 발동하면 결과 등급에 따라 예비(hold)를 얻고
// (10+ 3점 / 7-9 1점 / 실패 0점), 그 예비를 지키는 대상 하나에 건다. 예비가
// 남아있는 동안 자신이나 지키는 대상이 피격당하면, 그때마다 예비를 1점씩
// 써서 선택지를 고를 수 있다(features/defend.js 참고). 예비/보호대상 둘 다
// 숫자·문자열 단일 값이라 액터당 하나만 유지하고, 방어를 다시 굴리면
// (features/defend.js의 onCreateChatMessage) 항상 이 둘을 통째로 덮어쓴다.
const RESERVE_FLAG = "defendReserve"; // number, 0 이상
const PROTECTED_FLAG = "defendProtectedActorId"; // string(액터 id) | null

export function getDefendReserve(actor) {
  return Number(actor.getFlag(MODULE_ID, RESERVE_FLAG)) || 0;
}

export async function setDefendReserve(actor, value) {
  const clamped = Math.max(0, Math.floor(Number(value) || 0));
  if (clamped === 0) {
    await actor.unsetFlag(MODULE_ID, RESERVE_FLAG);
  } else {
    await actor.setFlag(MODULE_ID, RESERVE_FLAG, clamped);
  }
}

export function getDefendProtectedActorId(actor) {
  return actor.getFlag(MODULE_ID, PROTECTED_FLAG) ?? null;
}

export async function setDefendProtectedActor(actor, targetActorId) {
  if (targetActorId) {
    await actor.setFlag(MODULE_ID, PROTECTED_FLAG, targetActorId);
  } else {
    await actor.unsetFlag(MODULE_ID, PROTECTED_FLAG);
  }
}

// 방어 태세 해제(선택지 2번)와 다시 굴리기(재판정) 둘 다 예비/보호대상을
// 통째로 초기화한다.
export async function clearDefendState(actor) {
  await setDefendReserve(actor, 0);
  await setDefendProtectedActor(actor, null);
}
