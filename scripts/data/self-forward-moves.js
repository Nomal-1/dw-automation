// "발동하면(따로 판정 없이) 자기 자신에게 +1 forward"라는 동일한 구조를
// 가진 무브들. 8개 기본 직업 + 바바리안 전수조사로 찾은 것 중, +1이 적용
// 범위(대상/무브)까지 자동 판별 가능한 것만 골랐다:
//   - Reaper(클레릭), Quick Study(위저드), An Ear For Magic(바드): 제한 없는
//     일반 +1 forward.
//   - My Love For You Is Like A Truck(바바리안): +1이 "협상(Parley)" 판정에만
//     적용된다 — restrictToMoveNames로 제한한다.
// Unforgettable Face(바드)/Usurper(바바리안)는 +1이 "특정 NPC(의 부하)에
// 대한 판정"에만 적용되는데, 지금 굴리는 판정이 그 NPC를 대상으로 하는지
// 자동으로 알 방법이 없어서(대상 지정 UI가 없는 서술형 판정이 대부분)
// 자동화 대상에서 제외했다 — GM 요청.
export const DEFAULT_SELF_FORWARD_MOVES = [
  { name: "Reaper", restrictToMoveNames: "" },
  { name: "Quick Study", restrictToMoveNames: "" },
  { name: "An Ear For Magic", restrictToMoveNames: "" },
  { name: "My Love For You Is Like A Truck", restrictToMoveNames: "Parley" }
];
