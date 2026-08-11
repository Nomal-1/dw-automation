import { MODULE_ID } from "../constants.js";

// 클레릭 신의 보우(Divine Intervention)/신의 가호(Divine Invincibility)로
// 예배 때마다 얻는 예비를, 자기 자신뿐 아니라 지정한 아군을 지키는 데도 쓸
// 수 있게 하기 위한 "보호 대상" 목록. 예배를 다시 올려 예비를 새로 받을
// 때마다 덮어쓴다(원문 "이전 예비는 사라진다"와 같은 리셋 시점 —
// features/spell-preparation.js 참고).
const FLAG = "divineProtectedAllies"; // [actorId, ...]

export function getProtectedAllies(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? [];
}

export async function setProtectedAllies(actor, actorIds) {
  await actor.setFlag(MODULE_ID, FLAG, actorIds);
}
