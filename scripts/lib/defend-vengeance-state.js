import { MODULE_ID } from "../constants.js";

// 기본액션 방어의 선택지 "공격자에게 빈틈을 만들어, 지정한 우리 편
// 캐릭터가 그 공격자에 대한 다음 판정에 +1을 받도록 합니다" 전용. 이
// 자동화는 실제 "공격자가 누구인지"를 알 방법이 없으므로(시스템이 공격자
// 액터 정보를 넘겨주지 않는다), 대신 "누가 공격당했는지"(피격자 이름)만
// 저장해두고, 지정된 아군이 다음에 아무 판정이나 굴릴 때마다 "이 판정이
// XX를 공격한 캐릭터에 대한 판정입니까?"를 직접 물어서 사람이 확인하게
// 한다(features/know-it-all.js와 완전히 같은 패턴 — 조언을 "따랐는지"를
// 매번 확인하는 것과 같은 이유). 이 플래그는 만물박사와 마찬가지로(조언을
// 준 위저드가 아니라 받은 대상에 저장하듯) +1을 받을 아군 액터에 저장한다.
const FLAG = "defendVengeancePending"; // { victimName: string, defenderActorId: string, defenderName: string } | null

export function getDefendVengeancePending(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setDefendVengeancePending(actor, victimName, defenderActorId, defenderName) {
  await actor.setFlag(MODULE_ID, FLAG, { victimName, defenderActorId, defenderName });
}

export async function clearDefendVengeancePending(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
}
