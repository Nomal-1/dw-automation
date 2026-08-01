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
// 토글로 관리한다(linkedMoveName을 비워두면 이 방식). Holy Protection과
// 팔라딘 버전 Divine Protection(둘 다 아래 참고)만은 예외로, "퀘스트 수행
// 중"이라는 조건이 이미 이 모듈이 추적하는 다른 무브(features/note-moves.js의
// Quest 발동 상태)와 정확히 같은 뜻이라 수동 토글 대신 linkedMoveName:
// "Quest"로 그 무브의 발동 상태를 그대로 가져다 쓴다(수동 토글 UI 자체가
// 이 행에는 안 뜬다).
//
// 참고: "Divine Protection"이라는 이름을 클레릭과 팔라딘(Holy Protection의
// 업그레이드)이 똑같이 쓴다 — 원작 자체가 그렇다. 번역되기 전(영문) 상태로는
// 두 행이 이름이 같아 보이지만, linkedMoveName 유무로 어느 클래스 것인지
// 이미 구분되어 있어서 lib/translation-import.js의 자동 채우기가 각각
// 정확한 한글 이름(클레릭 "믿음의 갑옷" / 팔라딘 "신의 갑옷")으로 번역해
// 실제로 겹치지 않게 만들어준다. 번역을 전혀 쓰지 않는(원문 영문 그대로
// 플레이하는) 세계에서는 두 행이 진짜로 이름이 같아 이론상 중복 적용될 수
// 있으니, 그런 경우 GM이 둘 중 하나를 지우거나 이름을 구분해서 고쳐두면 된다.
//
// autoCheckPreparedSpell: 위저드 Arcane Ward/Arcane Armor 전용. 원문: "As
// long as you have at least one prepared spell of first level or higher,
// you have +2(Arcane Armor는 +4) armor." — linkedMoveName(다른 메모형 무브의
// 발동 상태를 따름)과 달리, 이 조건은 "1레벨 이상 주문 중 하나라도 준비됨
// (system.prepared && spellLevel >= 1)"을 액터의 주문 아이템에서 직접 읽어
// 완전히 자동으로 판정할 수 있다 — features/spell-preparation.js(Phase 6)가
// system.prepared를 정확히 유지해주기 전에는 믿을 수 있는 판정 근거가 없어서
// 미뤄뒀던 항목이다. linkedMoveName처럼 수동 토글 UI 자체가 뜨지 않는다.
export const DEFAULT_DAMAGE_REDUCTION_MOVES = [
  { name: "Underdog", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "" },
  { name: "Serious Underdog", baseBonus: 1, outnumberedBonus: 2, linkedMoveName: "" },
  { name: "Unencumbered, Unharmed", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "" },
  { name: "Barkskin", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "" },
  { name: "Divine Protection", baseBonus: 0, outnumberedBonus: 2, linkedMoveName: "" },
  { name: "Divine Armor", baseBonus: 0, outnumberedBonus: 3, linkedMoveName: "" },
  { name: "Holy Protection", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "Quest" },
  { name: "Divine Protection", baseBonus: 0, outnumberedBonus: 2, linkedMoveName: "Quest" },
  { name: "Arcane Ward", baseBonus: 0, outnumberedBonus: 2, linkedMoveName: "", autoCheckPreparedSpell: true },
  { name: "Arcane Armor", baseBonus: 0, outnumberedBonus: 4, linkedMoveName: "", autoCheckPreparedSpell: true }
];
