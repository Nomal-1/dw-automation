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

// Thief Underdog(오기)/Serious Underdog(투지): "숫적으로 열세일 때 장갑
// +N"이라는 조건부 장갑 보너스. 원문 기준 baseBonus(평소)/outnumberedBonus
// (열세일 때)는 오기가 0/1, 투지가 1/2다 — 투지는 열세가 아니어도 항상
// +1을 받는다는 점에 주의(features/underdog.js가 이 표를 읽어 실제 열세
// 토글에 맞는 값을 armor-assistant.js의 장갑 재계산에 반영한다).
export const DEFAULT_DAMAGE_REDUCTION_MOVES = [
  { name: "Underdog", baseBonus: 0, outnumberedBonus: 1 },
  { name: "Serious Underdog", baseBonus: 1, outnumberedBonus: 2 }
];
