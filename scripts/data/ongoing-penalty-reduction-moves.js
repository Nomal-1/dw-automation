// 클레릭 평온(Serenity)/섭리(Providence) 원문:
//   - Serenity: "When you cast a spell you ignore the first -1 penalty from
//     ongoing spells."
//   - Providence: "You ignore the -1 penalty from up to two spells you
//     maintain. If you maintain more than two you take normal penalties."
//
// GM 지시에 따라, "혜택이 통째로 사라지는" 게 아니라 "지속 주문으로 인한
// 페널티 합계에서 이만큼을 항상 빼주는"(0 밑으로는 안 내려감) 방식으로
// 구현한다 — 예: 평온을 가진 캐릭터가 디메리트 -3이 쌓였으면 -2로, 섭리를
// 가진 캐릭터라면 -1로 적용된다. 이 감산은 지속 주문(features/spellcasting.js의
// "지속 주문 관리")으로 인한 페널티에만 적용되고, 서약 페널티(부분성공 시
// "다음 기원까지 -1")에는 적용되지 않는다 — 원문이 "ongoing spells"라고
// 명시하고 있어서다.
//
// 평온→섭리는 features/move-upgrades.js에 이미 "대체" 관계(deletesPrevious:
// true)로 등록되어 있어서, 한 캐릭터가 둘을 동시에 갖는 일은 없다.
export const DEFAULT_ONGOING_PENALTY_REDUCTION_MOVES = [
  { name: "Serenity", reduction: 1 },
  { name: "Providence", reduction: 2 }
];
