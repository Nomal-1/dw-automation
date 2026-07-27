// 무기 데미지 굴림을 유발하는 "공격형" 무브들의 기본 거동.
//
// 원래는 무브 아이템의 컴펜디엄 원본 _id로 Backstab/Called Shot 같은 무브를 자동
// 인식하려 했으나, 실제로는 캐릭터를 만들 때마다 무브 아이템이 새로 생성되고
// (flags.core.sourceId도 안 남음) _id가 캐릭터마다 전부 달라서 이 방식이 성립하지
// 않았다. 그래서 이름 기반 설정 테이블(SETTINGS.SPECIAL_ATTACK_MOVES,
// apps/attack-moves-menu.js)로 관리한다 — 근접/사격 무브 이름 설정과 같은 원리다.
//
// - ranged: 사격 무기 취급 여부 (화살 소모 확인 트리거)
// - damageOnPartial / damageOnSuccess: 그 결과 등급에서 무기 데미지를 굴리는지
// - gatesDamage: true면 choices 중 인라인 굴림(예: [[1d6]])이 포함된 선택지를
//   골랐을 때만 무기 데미지를 굴린다(Backstab). false면 choices는 부가 연출
//   선택지일 뿐이고 데미지 굴림 여부는 damageOnPartial/damageOnSuccess로만
//   결정된다(Called Shot: 선택지는 머리/팔/다리 연출용이고 성공 시엔 항상
//   데미지를 준다).
export const DEFAULT_SPECIAL_ATTACK_MOVES = [
  { name: "Backstab", ranged: false, gatesDamage: true, damageOnPartial: true, damageOnSuccess: true },
  { name: "Called Shot", ranged: true, gatesDamage: false, damageOnPartial: false, damageOnSuccess: true }
];

// 단순 이름 목록(모듈 설정의 근접/사격 무브 이름)에 매칭된 무브의 기본 거동.
// Hack & Slash/Volley처럼 선택지 없이 항상 데미지를 굴리는 무브가 여기 해당한다.
export const DEFAULT_ATTACK_BEHAVIOR = {
  ranged: false,
  damageOnPartial: true,
  damageOnSuccess: true,
  choiceGatesDamage: false
};
