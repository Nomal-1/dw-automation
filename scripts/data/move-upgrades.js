// 던전월드 상급 무브(advanced move)는 컴펜디엄 데이터 안에 이미 requiresMove
// 필드로 "이걸 배우려면 어떤 무브가 먼저 있어야 하는지"가 구조적으로 들어있다.
// 그런데 그 필드는 캐릭터 시트가 아니라 컴펜디엄 소스에만 있고, 게임 상에서는
// 상급 무브를 배워도 그 전 단계 무브가 시트에 자동으로 남아있다. 이 관계인
// 쌍이 8개 기본 직업에 걸쳐 43개나 있어서(예: 치료사 → 치료사의 모범, 과감한
// 일격 → 태그팀 일격), 새로 배운 무브 이름이 아래 표의 upgradeName과 일치하면
// 같은 액터가 갖고 있는 replacesName 무브를 자동으로 제거한다.
//
// 던전월드 룰에는 "대체"(이전 무브가 사라짐)뿐 아니라 "필요"(이전 무브는
// 그대로 남고 그냥 전제조건으로만 쓰임) 관계도 있어서, deletesPrevious로
// 구분한다. requiresMove 필드만으로는 어느 쪽인지 알 수 없어서(둘 다 그
// 필드는 똑같이 채워짐) 기본값은 지금까지의 동작(전부 대체)과 같게
// true로 채워뒀다 — 실제로 "필요" 관계인 쌍을 확인하면 설정에서 개별적으로
// 체크를 풀어주면 된다.
//
// 이름은 requiresMove 필드(컴펜디엄 원문, 영어)를 그대로 기본값으로 채워뒀다.
// 번역 모듈을 쓰는 게임이면 "번역 모듈에서 자동 채우기"로 두 칸 다 한글로
// 바뀐다(둘 다 무브 이름이라 같은 방식으로 번역된다).
export const DEFAULT_MOVE_UPGRADES = [
  { upgradeName: "Armored Perfection", replacesName: "Armor Mastery", deletesPrevious: true },
  { upgradeName: "Bloodthirsty", replacesName: "Merciless", deletesPrevious: true },
  { upgradeName: "Evil Eye", replacesName: "Seeing Red", deletesPrevious: true },
  { upgradeName: "Steel Hide", replacesName: "Iron Hide", deletesPrevious: true },
  { upgradeName: "Taste Of Blood", replacesName: "Scent Of Blood", deletesPrevious: true },
  { upgradeName: "Divine Authority", replacesName: "Voice Of Authority", deletesPrevious: true },
  { upgradeName: "Divine Protection", replacesName: "Holy Protection", deletesPrevious: true },
  { upgradeName: "Ever Onward", replacesName: "Charge!", deletesPrevious: true },
  { upgradeName: "Evidence Of Faith", replacesName: "Divine Favor", deletesPrevious: true },
  { upgradeName: "Holy Smite", replacesName: "Smite", deletesPrevious: true },
  { upgradeName: "Impervious Defender", replacesName: "Staunch Defender", deletesPrevious: true },
  { upgradeName: "Perfect Hospitaller", replacesName: "Hospitaller", deletesPrevious: true },
  { upgradeName: "Tandem Strike", replacesName: "Setup Strike", deletesPrevious: true },
  { upgradeName: "Anointed", replacesName: "Chosen One", deletesPrevious: true },
  { upgradeName: "Divine Armor", replacesName: "Divine Protection", deletesPrevious: true },
  { upgradeName: "Divine Invincibility", replacesName: "Divine Intervention", deletesPrevious: true },
  { upgradeName: "Greater Empower", replacesName: "Empower", deletesPrevious: true },
  { upgradeName: "Greater First Aid", replacesName: "First Aid", deletesPrevious: true },
  { upgradeName: "Martyr", replacesName: "Penitent", deletesPrevious: true },
  { upgradeName: "Providence", replacesName: "Serenity", deletesPrevious: true },
  { upgradeName: "Arcane Armor", replacesName: "Arcane Ward", deletesPrevious: true },
  { upgradeName: "Enchanter's Soul", replacesName: "Enchanter", deletesPrevious: true },
  { upgradeName: "Greater Empowered Magic", replacesName: "Empowered Magic", deletesPrevious: true },
  { upgradeName: "Highly Logical", replacesName: "Logical", deletesPrevious: true },
  { upgradeName: "Master", replacesName: "Prodigy", deletesPrevious: true },
  { upgradeName: "Protective Counter", replacesName: "Counterspell", deletesPrevious: true },
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
  { upgradeName: "Formshaper", replacesName: "Formcrafter", deletesPrevious: true },
  { upgradeName: "World-talker", replacesName: "Thing-talker", deletesPrevious: true }
];
