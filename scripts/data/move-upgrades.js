// 던전월드 상급 무브(advanced move)는 컴펜디엄 데이터 안에 이미 requiresMove
// 필드로 "이걸 배우려면 어떤 무브가 먼저 있어야 하는지"가 구조적으로 들어있다.
// 그런데 그 필드는 캐릭터 시트가 아니라 컴펜디엄 소스에만 있고, 게임 상에서는
// 상급 무브를 배워도 그 전 단계 무브가 시트에 자동으로 남아있다. 이 관계인
// 쌍이 8개 기본 직업에 걸쳐 43개나 있어서(예: 치료사 → 치료사의 모범, 과감한
// 일격 → 태그팀 일격), 새로 배운 무브 이름이 아래 표의 upgradeName과 일치하면
// 같은 액터가 갖고 있는 replacesName 무브를 자동으로 제거한다.
//
// 던전월드 룰에는 "대체"(이전 무브가 사라짐)뿐 아니라 "필요"(이전 무브는
// 그대로 남고 그냥 전제조건으로만 쓰임) 관계도 있다. 43쌍 전부 실제 무브
// 원문(공식 컴펜디엄, asacolips-projects/dungeonworld 1.8.2)을 다시 읽어서
// 확인했다 — 상위 무브의 효과가 이전 무브와 "같은 효과의 상위 버전"(주사위/
// 수치만 커지거나 조건이 넓어짐)이면 대체, 완전히 다른 별개의 효과이거나
// 텍스트에 "~에 더해(in addition to)"가 명시되어 있으면 필요로 분류했다.
// 필요 관계로 확인된 쌍(9개):
//   Anointed/Chosen One, Master/Prodigy — 텍스트에 "Chosen One/Prodigy에서
//     고른 것에 더해" 라고 명시됨.
//   Evil Eye/Seeing Red, Evidence Of Faith/Divine Favor, Enchanter's
//     Soul/Enchanter, Protective Counter/Counterspell — 완전히 다른 효과.
//   Greater First Aid/First Aid — 서로 다른 주문(가벼운/보통 상처 치료)을
//     각각 로트로 만들어줘서 둘 다 유지해야 의미가 있음.
//   Formshaper/Formcrafter — Formcrafter는 변신 중 능력치 보너스/페널티,
//     Formshaper는 변신 중 장갑/피해 선택으로 서로 완전히 다른 효과(이
//     모듈의 features/druid.js도 둘을 별개로 자동화하고 있어서, 여기서
//     Formcrafter를 지워버리면 그 자동화가 깨진다).
//   World-talker/Thing-talker — 대상 확장이 서로 다름(원소 vs 무생물).
// 나머지 34쌍은 전부 "같은 효과의 상위 버전"이라 대체로 분류했다.
//
// 이후 바바리안/이몰레이터(시스템에 같이 딸려오는 추가 두 직업) 컴펜디엄도
// 전수조사해서 3쌍을 더 찾았다 — 전부 "필요" 관계다:
//   Kill 'Em All/Appetite For Destruction(바바리안) — 원문이 "Take ANOTHER
//     move..."라 이전 선택을 대체하지 않고 추가로 하나 더 얻는 것.
//   Burns Half As Long/Burns Twice As Bright(이몰레이터) — 서로 짝을 이루는
//     기믹(하나를 다시 쓰려면 반드시 다른 하나를 먼저 써야 함)이라 둘 다
//     유지해야 의미가 있음.
//   Fanning The Flames/Firebrand(이몰레이터) — "Firebrand 효과를 여러 명에게
//     한번에 적용 가능"이라 Firebrand 자체가 계속 필요함.
export const DEFAULT_MOVE_UPGRADES = [
  { upgradeName: "Armored Perfection", replacesName: "Armor Mastery", deletesPrevious: true },
  { upgradeName: "Bloodthirsty", replacesName: "Merciless", deletesPrevious: true },
  { upgradeName: "Evil Eye", replacesName: "Seeing Red", deletesPrevious: false },
  { upgradeName: "Steel Hide", replacesName: "Iron Hide", deletesPrevious: true },
  { upgradeName: "Taste Of Blood", replacesName: "Scent Of Blood", deletesPrevious: true },
  { upgradeName: "Divine Authority", replacesName: "Voice Of Authority", deletesPrevious: true },
  { upgradeName: "Divine Protection", replacesName: "Holy Protection", deletesPrevious: true },
  { upgradeName: "Ever Onward", replacesName: "Charge!", deletesPrevious: true },
  { upgradeName: "Evidence Of Faith", replacesName: "Divine Favor", deletesPrevious: false },
  { upgradeName: "Holy Smite", replacesName: "Smite", deletesPrevious: true },
  { upgradeName: "Impervious Defender", replacesName: "Staunch Defender", deletesPrevious: true },
  { upgradeName: "Perfect Hospitaller", replacesName: "Hospitaller", deletesPrevious: true },
  { upgradeName: "Tandem Strike", replacesName: "Setup Strike", deletesPrevious: true },
  { upgradeName: "Anointed", replacesName: "Chosen One", deletesPrevious: false },
  { upgradeName: "Divine Armor", replacesName: "Divine Protection", deletesPrevious: true },
  { upgradeName: "Divine Invincibility", replacesName: "Divine Intervention", deletesPrevious: true },
  { upgradeName: "Greater Empower", replacesName: "Empower", deletesPrevious: true },
  { upgradeName: "Greater First Aid", replacesName: "First Aid", deletesPrevious: false },
  { upgradeName: "Martyr", replacesName: "Penitent", deletesPrevious: true },
  { upgradeName: "Providence", replacesName: "Serenity", deletesPrevious: true },
  { upgradeName: "Arcane Armor", replacesName: "Arcane Ward", deletesPrevious: true },
  { upgradeName: "Enchanter's Soul", replacesName: "Enchanter", deletesPrevious: false },
  { upgradeName: "Greater Empowered Magic", replacesName: "Empowered Magic", deletesPrevious: true },
  { upgradeName: "Highly Logical", replacesName: "Logical", deletesPrevious: true },
  { upgradeName: "Master", replacesName: "Prodigy", deletesPrevious: false },
  { upgradeName: "Protective Counter", replacesName: "Counterspell", deletesPrevious: false },
  { upgradeName: "Alchemist", replacesName: "Brewer", deletesPrevious: true },
  { upgradeName: "Dirty Fighter", replacesName: "Cheap Shot", deletesPrevious: true },
  { upgradeName: "Extremely Cautious", replacesName: "Cautious", deletesPrevious: true },
  { upgradeName: "Serious Underdog", replacesName: "Underdog", deletesPrevious: true },
  { upgradeName: "A Safer Place", replacesName: "A Safe Place", deletesPrevious: true },
  { upgradeName: "Hunter’s Prey", replacesName: "Familiar Prey", deletesPrevious: true },
  { upgradeName: "Strider", replacesName: "Follow Me", deletesPrevious: true },
  { upgradeName: "Viper’s Fangs", replacesName: "Viper’s Strike", deletesPrevious: true },
  { upgradeName: "Wild Speech", replacesName: "Wild Empathy", deletesPrevious: true },
  { upgradeName: "Con", replacesName: "Bamboozle", deletesPrevious: true },
  { upgradeName: "Duelist’s Block", replacesName: "Duelist's Parry", deletesPrevious: true },
  { upgradeName: "Eldritch Chord", replacesName: "Eldritch Tones", deletesPrevious: true },
  { upgradeName: "Healing Chorus", replacesName: "Healing Song", deletesPrevious: true },
  { upgradeName: "Vicious Blast", replacesName: "Vicious Cacophony", deletesPrevious: true },
  { upgradeName: "Blood and Thunder", replacesName: "Red of Tooth and Claw", deletesPrevious: true },
  { upgradeName: "Formshaper", replacesName: "Formcrafter", deletesPrevious: false },
  { upgradeName: "World-talker", replacesName: "Thing-talker", deletesPrevious: false },
  { upgradeName: "Kill 'Em All", replacesName: "Appetite For Destruction", deletesPrevious: false },
  { upgradeName: "Burns Half As Long", replacesName: "Burns Twice As Bright", deletesPrevious: false },
  { upgradeName: "Fanning The Flames", replacesName: "Firebrand", deletesPrevious: false }
];
