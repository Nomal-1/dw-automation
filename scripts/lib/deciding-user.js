// 이 액터를 자신의 캐릭터로 지정해둔 접속 중인 플레이어를 우선 찾고, 없으면
// 소유권(OWNER)을 가진 접속 중인 플레이어를 찾는다. 그런 플레이어가 아무도
// 없으면(예: GM 혼자 테스트하는 상황) null을 반환하고, 이 경우 지금 갱신을
// 시작한 클라이언트에서 바로 물어본다 — 결정권자가 아예 없는 것보다는 낫다.
// hit-trigger.js/underdog.js가 "피해를 받는 쪽이 결정해야 하는" 대화상자를
// 올바른 클라이언트로 소켓 전달할 때 공통으로 쓴다.
export function findDecidingUser(actor) {
  const assigned = game.users.find((u) => u.active && !u.isGM && u.character?.id === actor.id);
  if (assigned) return assigned;
  return game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER")) ?? null;
}
