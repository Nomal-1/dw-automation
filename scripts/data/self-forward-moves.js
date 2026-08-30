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
export const DEFAULT_SELF_FORWARD_MOVES = [
  { name: "Reaper", restrictToMoveNames: "" },
  { name: "Quick Study", restrictToMoveNames: "" },
  { name: "An Ear For Magic", restrictToMoveNames: "" },
  { name: "Unforgettable Face", restrictToMoveNames: "" },
  { name: "Usurper", restrictToMoveNames: "" }
];
