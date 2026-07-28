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

// 8개 기본 직업 + 바바리안/이몰레이터 컴펜디엄(1.8.2) 전수조사로 찾은,
// "다른 무브/상태에 의존하지 않는 독립적인 서사적 조건"으로 장갑을 주는
// 무브들. 원문 근거:
//   - Underdog(오기): "숫적으로 열세일 때 +1 장갑" (평소 0)
//   - Serious Underdog(투지, Underdog 업그레이드): "항상 +1, 열세일 때 +2"
//   - Unencumbered, Unharmed(바바리안): "짐이 Load 미만이고 갑옷도 방패도
//     없으면 +1 장갑"
//   - Barkskin(드루이드): "발이 땅에 닿아있으면 +1 장갑"
//   - Divine Protection(클레릭): "갑옷도 방패도 없으면 +2 장갑"
//   - Divine Armor(클레릭, Divine Protection 업그레이드): "...+3 장갑"
// 조사 중 이름이 같은 "Divine Protection"이 팔라딘 쪽에도 있으나(퀘스트
// 무브에 의존하는 별개 조건, 값은 우연히 동일) 여기 등록한 건 클레릭
// 버전이다 — 어느 쪽이든 값이 같아 실제 동작에는 차이가 없다.
//
// 조사했지만 일부러 넣지 않은 것(다른 무브가 만든 "상태"에 의존해서
// Formshaper와 같은 이유로 제외 — 독립적인 조건이 아님):
//   - 팔라딘 Holy Protection/Divine Protection: "퀘스트 중일 때" (Quest 무브에
//     종속)
//   - 위저드 Arcane Ward/Arcane Armor: "1레벨 이상 주문을 준비해뒀을 때"
//     (Prepare Spells 무브에 종속)
export const DEFAULT_DAMAGE_REDUCTION_MOVES = [
  { name: "Underdog", baseBonus: 0, outnumberedBonus: 1 },
  { name: "Serious Underdog", baseBonus: 1, outnumberedBonus: 2 },
  { name: "Unencumbered, Unharmed", baseBonus: 0, outnumberedBonus: 1 },
  { name: "Barkskin", baseBonus: 0, outnumberedBonus: 1 },
  { name: "Divine Protection", baseBonus: 0, outnumberedBonus: 2 },
  { name: "Divine Armor", baseBonus: 0, outnumberedBonus: 3 }
];
