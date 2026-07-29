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
// 조건부로 장갑을 주는 무브들. 원문 근거:
//   - Underdog(오기): "숫적으로 열세일 때 +1 장갑" (평소 0)
//   - Serious Underdog(투지, Underdog 업그레이드): "항상 +1, 열세일 때 +2"
//   - Unencumbered, Unharmed(바바리안): "짐이 Load 미만이고 갑옷도 방패도
//     없으면 +1 장갑"
//   - Barkskin(드루이드): "발이 땅에 닿아있으면 +1 장갑"
//   - Divine Protection(클레릭): "갑옷도 방패도 없으면 +2 장갑"
//   - Divine Armor(클레릭, Divine Protection 업그레이드): "...+3 장갑"
//   - Holy Protection(팔라딘): "퀘스트 수행 중일 때 +1 장갑"
//
// 위 항목들의 조건은 캐릭터 시트에서 무브마다 독립적으로 켜고 끄는 수동
// 토글로 관리한다(linkedMoveName을 비워두면 이 방식). Holy Protection만은
// 예외로, "퀘스트 수행 중"이라는 조건이 이미 이 모듈이 추적하는 다른 무브
// (features/note-moves.js의 Quest 발동 상태)와 정확히 같은 뜻이라 수동
// 토글 대신 linkedMoveName: "Quest"로 그 무브의 발동 상태를 그대로
// 가져다 쓴다(수동 토글 UI 자체가 이 행에는 안 뜬다).
//
// 참고: 이름이 같은 "Divine Protection"이 팔라딘 쪽에도 있으나(Holy
// Protection의 업그레이드, 조건도 "퀘스트 수행 중"으로 동일) 여기 등록한
// "Divine Protection"은 클레릭 버전이다 — 이름이 완전히 같아서 팔라딘
// 버전을 별도 행으로 등록하면 같은 무브 하나에 행 두 개가 매칭돼 보너스가
// 중복 적용된다. 팔라딘이 Divine Protection까지 올리면 이 표의 클레릭
// 버전 행(수동 토글, 값은 우연히 동일)이 대신 적용되니 실제 수치는
// 똑같지만, 그 시점부터는 퀘스트 상태와 자동 연동되지 않고 수동 토글로
// 돌아간다.
export const DEFAULT_DAMAGE_REDUCTION_MOVES = [
  { name: "Underdog", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "" },
  { name: "Serious Underdog", baseBonus: 1, outnumberedBonus: 2, linkedMoveName: "" },
  { name: "Unencumbered, Unharmed", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "" },
  { name: "Barkskin", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "" },
  { name: "Divine Protection", baseBonus: 0, outnumberedBonus: 2, linkedMoveName: "" },
  { name: "Divine Armor", baseBonus: 0, outnumberedBonus: 3, linkedMoveName: "" },
  { name: "Holy Protection", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "Quest" }
];
