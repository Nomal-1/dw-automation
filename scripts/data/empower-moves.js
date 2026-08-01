// 위저드 주문 강화(Empowered Magic)/상급 주문 강화(Greater Empowered Magic),
// 클레릭 강화(Empower)/상급 강화(Greater Empower) 원문:
//   - 기본형: "When you cast a spell, on a 10+ you have the option of
//     choosing from the 7-9 list. If you do, you may additionally choose
//     one of the following effects: [효과 둘 중 하나]"
//   - 상급형: "...on a 10-11 [기본형과 동일]. On a 12+ you get to choose one
//     of these effects for free."
//
// GM 지시에 따라: 주문 시전이 10+로 성공하면 "강화를 적용할지" 먼저 묻고,
// 적용하면 (1) 강화 효과 둘 중 하나, (2) 7-9 목록에서 디메리트 하나를
// 추가로 고르게 한다(대가 없이는 강화 자체를 안 준다). isGreater인 무브는
// 극단적 성공(12+)에서는 디메리트 없이 강화 효과만 공짜로 준다.
//
// 강화 효과("효과 극대화"/"대상 2배") 자체는 이 모듈이 임의의 주문에 실제로
// 적용할 방법이 없어서(순수 GM 서술 영역), 무엇을 골랐는지 채팅에 남기는
// 것까지만 자동화한다 — 디메리트(7-9 목록)는 Cast a Spell의 부분성공 처리와
// 완전히 같은 방식으로 실제 효과(주문 잊음/서약 페널티)까지 적용한다.
//
// 상급형은 features/move-upgrades.js에 이미 "대체" 관계(deletesPrevious:true)로
// 등록되어 있어서, 한 캐릭터가 기본형+상급형을 동시에 갖는 일은 없다.
export const DEFAULT_EMPOWER_MOVES = [
  { name: "Empower", isGreater: false },
  { name: "Greater Empower", isGreater: true },
  { name: "Empowered Magic", isGreater: false },
  { name: "Greater Empowered Magic", isGreater: true }
];
