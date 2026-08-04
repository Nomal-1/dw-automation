// 던전월드 공식 직업 컴펜디엄(systems/dungeonworld/packs/classes, v1.8.2)의
// 각 직업 아이템 데이터에 실려 있는 hp/load 필드 그대로다 — 최대 체력은
// "이 값 + 체력(CON) 점수", 기본 하중은 "이 값 + 근력(STR) 점수"로 계산한다
// (던전월드 규칙 자체가 수정치가 아니라 능력치 원점수를 더한다). 바바리안/
// 이몰레이터도 이 시스템이 기본으로 포함하는 확장 직업이라 같은 컴펜디엄에서
// 값을 확인했다.
export const CLASS_BASE_STATS = {
  Barbarian: { hp: 8, load: 8 },
  Bard: { hp: 6, load: 9 },
  Cleric: { hp: 8, load: 10 },
  Druid: { hp: 6, load: 6 },
  Fighter: { hp: 10, load: 12 },
  Immolator: { hp: 4, load: 9 },
  Paladin: { hp: 10, load: 12 },
  Ranger: { hp: 8, load: 11 },
  Thief: { hp: 6, load: 9 },
  Wizard: { hp: 4, load: 7 }
};
