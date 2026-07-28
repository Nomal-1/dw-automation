// Fighter Armor Mastery/Armored Perfection, Paladin Bloody Aegis처럼 "피해를
// 입기 직전에 그 피해를 무효화하는 대신 대가를 치르는" 무브들의 기본값.
//
// - effect: "armor"(장갑을 1 낮춰서 무효화) | "debility"(약화를 하나 선택해서
//   무효화 — 이미 6개 약화를 전부 갖고 있으면 이 무브 자체를 쓸 수 없음)
// - grantsForward: 무효화에 성공하면 +1 forward도 함께 받는지(Armored
//   Perfection). 던전월드 시스템의 forward는 다음 굴림에 자동으로 붙었다가
//   소모되는 값(system.attributes.forward.value)이라 별도 계산이 필요 없다.
export const DEFAULT_HIT_TRIGGER_MOVES = [
  { name: "Armor Mastery", effect: "armor", grantsForward: false },
  { name: "Armored Perfection", effect: "armor", grantsForward: true },
  { name: "Bloody Aegis", effect: "debility", grantsForward: false }
];

// Thief Underdog/Serious Underdog: "숫적으로 열세일 때 장갑 +N"이라는 조건부
// 보너스. "숫적 열세"를 씬의 적대 토큰 수로 자동 판정할 수 없어서, 피해를
// 입기 직전에 Y/N으로 물어보고 승낙하면 그만큼 피해 자체를 깎는다(장갑을
// 실제로 바꾸지는 않음 — 대가 없이 매번 적용되는 조건부 보너스라 위의
// "무효화 무브" 표와는 성격이 달라서 별도 표로 관리한다).
export const DEFAULT_DAMAGE_REDUCTION_MOVES = [
  { name: "Underdog", amount: 1 },
  { name: "Serious Underdog", amount: 2 }
];
