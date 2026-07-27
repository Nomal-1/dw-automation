// 무기 데미지 굴림을 유발하는 "공격형" 무브들의 거동 정의.
//
// 던전월드 시스템의 채팅 카드(chat-move.html)는 무브 이름의 "번역된 표시 텍스트"만
// 담고 있고 무브 아이템의 원본 _id는 노출하지 않는다. 하지만 액터가 그 무브
// 아이템을 실제로 갖고 있으므로(move-card.js의 findMoveItem), 그 아이템의 _id로
// 아래 카탈로그를 조회하면 번역 여부와 무관하게 무브를 식별할 수 있다.
// _id는 던전월드 공식 컴펜디엄(system 1.8.2, packs/basic-moves, packs/the-*-moves)
// 기준이며, GM이 컴펜디엄에서 그대로 끌어다 썼다면(가장 흔한 경우) 그대로 보존된다.
//
// 카탈로그에 없는 무브는 기존처럼 모듈 설정(근접/사격 무브 이름)의 텍스트 목록으로
// 폴백한다.
//
// - ranged: 사격 무기 취급 여부 (화살 소모 확인 트리거)
// - damageOnPartial / damageOnSuccess: 그 결과 등급에서 무기 데미지를 굴리는지
// - choiceGatesDamage: true면 choices 중 인라인 굴림(예: [[1d6]])이 포함된 선택지를
//   골랐을 때만 무기 데미지를 굴린다(Backstab). false면 choices는 그냥 부가 연출
//   선택지일 뿐이고 데미지 굴림 여부는 damageOnPartial/damageOnSuccess로만 결정된다
//   (Called Shot: 선택지는 머리/팔/다리 연출용이고 성공 시엔 항상 데미지를 준다).
export const KNOWN_ATTACK_MOVES = {
  // Hack & Slash (basic-moves)
  PUK0JpXZA2glIGAp: { ranged: false, damageOnPartial: true, damageOnSuccess: true, choiceGatesDamage: false },
  // Volley (basic-moves)
  hsvh7AbYNZL9VlGV: { ranged: true, damageOnPartial: true, damageOnSuccess: true, choiceGatesDamage: false },
  // Backstab (the-thief-moves)
  bxOuRiaEWAkRCE01: { ranged: false, damageOnPartial: true, damageOnSuccess: true, choiceGatesDamage: true },
  // Called Shot (the-ranger-moves)
  VpeXMwtBhIQYyA77: { ranged: true, damageOnPartial: false, damageOnSuccess: true, choiceGatesDamage: false }
};

export const DEFAULT_ATTACK_BEHAVIOR = {
  ranged: false,
  damageOnPartial: true,
  damageOnSuccess: true,
  choiceGatesDamage: false
};
