// "발동하면(따로 판정 없이) 자기 자신에게 +1 forward"라는 동일한 구조를
// 가진 무브들. 8개 기본 직업 + 바바리안 전수조사로 찾은 것:
//   - Reaper(클레릭), Quick Study(위저드), An Ear For Magic(바드): 제한 없는
//     일반 +1 forward.
//   - Unforgettable Face(바드)/Usurper(바바리안): 원문은 +1이 "특정 NPC(의
//     부하)에 대한 판정"에만 적용되지만, 지금 굴리는 판정이 그 NPC를
//     대상으로 하는지 자동으로 판별할 방법이 없다. 대신 features/
//     self-forward.js가 무브 옆에 GM 전용 수동 토글 배지를 붙여서, "지금
//     이 대상에게 맞는 상황"인지는 GM이 직접 판단해서 켜고 끄게 한다(그
//     시점부터는 다른 자동화와 동일하게 다음 판정에 자동으로 적용/소모됨).
//
// My Love For You Is Like A Truck(바바리안)은 원래 여기서 "협상 판정에만
// +1 forward"(restrictToMoveNames)로 다뤘지만, GM 요청대로 "한 번 쓰면
// 소모"가 아니라 지속 효과로 바뀌어서 features/love-truck.js로 옮겼다 —
// 이 표에서는 완전히 제외한다(self-forward.js의 마이그레이션이 기존에
// 저장된 표에서도 제거한다).
// Indomitable(팔라딘 불굴)은 원래 "약화를 얻으면 그 원인에 대한 판정에
// +1 forward"라 features/hit-trigger.js가 약화 감지 시 자동으로 걸어주지만
// (그쪽에서 이 표와 같은 대기 보정치 플래그에 직접 얹도록 바꿨다), GM
// 요청대로 눈에 보이는 적용중/적용안됨 배지 + 수동 토글도 필요해서 이
// 표에도 등록해둔다 — 무브를 직접 클릭해도(자동 감지를 놓쳤을 때의 수동
// 대체 수단으로) 같은 +1이 걸린다. Evidence Of Faith(팔라딘 신앙의 증거)는
// "신성 마법을 목격하면 GM에게 물어보고, 그 답에 따라 행동할 때 +1"이라
// 자동 감지가 불가능해서 완전히 수동(클릭해서 적용중으로, 다음 판정에서
// 자동 소모)으로만 동작한다.
export const DEFAULT_SELF_FORWARD_MOVES = [
  { name: "Reaper", restrictToMoveNames: "" },
  { name: "Quick Study", restrictToMoveNames: "" },
  { name: "An Ear For Magic", restrictToMoveNames: "" },
  { name: "Unforgettable Face", restrictToMoveNames: "" },
  { name: "Usurper", restrictToMoveNames: "" },
  { name: "Indomitable", restrictToMoveNames: "" },
  { name: "Evidence Of Faith", restrictToMoveNames: "" }
];
