// 치유 굴림을 발동시키는 무브/주문의 기본값.
//
// - formulaMode:
//   - "auto": 주문 아이템이면 system.rollFormula(1.8.2 컴펜디엄에 이미 구조적으로
//     들어있는 주사위 공식 — 예: Cure Light Wounds=1d8, Cure Moderate Wounds=2d8,
//     Cure Critical Wounds=3d8. 번역 여부와 무관하게 항상 정확하다)를 그대로
//     읽는다. 무브 아이템(Lay On Hands 등)은 system.rollFormula가 없으므로,
//     성공/부분성공 결과 텍스트에 박힌 [[1d8]] 같은 인라인 주사위 표기를
//     대신 파싱한다(특수 공격 무브의 데미지 판정과 같은 방식).
//   - "custom": customFormula를 그대로 사용(자동 인식이 안 되는 경우의 대비책).
//   - "max": 주사위 굴림이 아니라 "치유자의 최대 HP까지 원하는 만큼" 같은
//     경우(Heal 주문). 굴리는 대신 숫자를 입력받는다.
// - transferToSelfOnPartial: Lay On Hands처럼 부분성공 시 치유량(또는 질병)이
//   본인에게 전이되는 무브에 체크한다.
export const DEFAULT_HEALING_MOVES = [
  { name: "Lay On Hands", formulaMode: "auto", customFormula: "1d8", transferToSelfOnPartial: true },
  { name: "Cure Light Wounds", formulaMode: "auto", customFormula: "1d8", transferToSelfOnPartial: false },
  { name: "Cure Moderate Wounds", formulaMode: "auto", customFormula: "2d8", transferToSelfOnPartial: false },
  { name: "Cure Critical Wounds", formulaMode: "auto", customFormula: "3d8", transferToSelfOnPartial: false },
  { name: "Heal", formulaMode: "max", customFormula: "", transferToSelfOnPartial: false }
];

// Paladin Hospitaller/Perfect Hospitaller: "아군을 치유할 때(자신 제외) 추가로
// 이만큼 더 치유한다"는 수동형 보너스. 위 표의 무브로 남을 치유할 때마다
// 이 무브를 갖고 있으면 자동으로 추가 굴림을 더한다.
// Bard Healing Song/Healing Chorus는 전수조사로 찾은 같은 구조의 무브다
// (원문: "Arcane Art로 치유할 때 +1d8"/"...+2d8"). 실제로는 Arcane Art로
// 치유했을 때만 적용되는 문구지만, 이 모듈은 애초에 Hospitaller류를 "그
// 캐릭터가 이 표의 무브로 남을 치유하면 무조건 보너스를 더한다"로 단순화해서
// 구현해뒀다(어느 치유 무브로 치유했는지는 구분하지 않음) — 새 항목도 같은
// 단순화를 그대로 따른다.
// 클레릭 헌신적 치유자(Devoted Healer) 원문: "When you heal someone else of
// damage, add your level to the amount of damage healed." — Hospitaller와
// 정확히 같은 "남을 치유할 때 추가로 더한다" 구조라, bonusFormula에 고정
// 주사위 대신 던전월드 시스템의 롤데이터 경로(actor.getRollData()의
// attributes.level.value)를 그대로 적어서 레벨만큼 더하게 한다.
export const DEFAULT_HOSPITALLER_MOVES = [
  { name: "Hospitaller", bonusFormula: "1d8" },
  { name: "Perfect Hospitaller", bonusFormula: "2d8" },
  { name: "Healing Song", bonusFormula: "1d8" },
  { name: "Healing Chorus", bonusFormula: "2d8" },
  { name: "Devoted Healer", bonusFormula: "@attributes.level.value" }
];
