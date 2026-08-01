// 클레릭 신의 개입(Divine Intervention)/신의 불멸(Divine Invincibility) 원문:
//   - Divine Intervention: "When you Commune you get 1 hold and lose any
//     hold you already had. Spend that hold when you or an ally takes
//     damage to call on your deity, they intervene with an appropriate
//     manifestation ... and negate the damage."
//   - Divine Invincibility(업그레이드, requiresLevel 6): 위와 완전히 같은
//     문구인데 hold가 1 대신 2.
//
// "기원할 때 hold를 얻는다(이전 hold는 소멸)" 부분만 이 표로 관리한다 —
// features/spell-preparation.js가 기원(Commune)이 실제로 발동될 때마다 이
// 표를 확인해서 hold를 정확히 이 값으로 덮어쓴다(누적이 아니라 항상
// 새로 설정 — 원문 "lose any hold you already had"). "hold를 써서 피해를
// 무효화" 부분은 features/hit-trigger.js의 HIT_TRIGGER_MOVES 표에 effect:
// "hold"로 등록되어 있다(data/hit-trigger-moves.js 참고).
//
// 원문은 "you or an ally"라서 아군을 대신 지켜주는 것도 가능하지만, 이
// 모듈의 피격 무효화 체계는 지금 "피해를 받는 그 캐릭터 자신의 무브"만
// 후보로 삼는 구조라 다른 캐릭터가 대신 hold를 써주는 것까지는 자동화하지
// 않는다(자신을 지키는 경우만 자동화됨 — GM이 아군을 지키는 경우는 수동으로
// 처리해야 한다).
//
// 상급형(Divine Invincibility)은 features/move-upgrades.js에 이미 "대체"
// 관계(deletesPrevious:true)로 등록되어 있어서, 한 캐릭터가 둘을 동시에
// 갖는 일은 없다.
export const DEFAULT_HOLD_GRANT_MOVES = [
  { name: "Divine Intervention", holdAmount: 1 },
  { name: "Divine Invincibility", holdAmount: 2 }
];
