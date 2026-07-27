// 던전월드 상급 무브(advanced move)는 컴펜디엄 데이터 안에 이미 requiresMove
// 필드로 "이걸 배우려면 어떤 무브가 먼저 있어야 하는지"가 구조적으로 들어있다.
// 그런데 그 필드는 캐릭터 시트가 아니라 컴펜디엄 소스에만 있고, 게임 상에서는
// 상급 무브를 배워도 그 전 단계 무브가 시트에 자동으로 남아있다. 실제로는
// "상위 버전으로 대체"하는 관계인 쌍이 8개 기본 직업에 걸쳐 43개나 있어서
// (예: 치료사 → 치료사의 모범, 과감한 일격 → 태그팀 일격), 새로 배운 무브
// 이름이 아래 표의 upgradeName과 일치하면 같은 액터가 갖고 있는
// replacesName 무브를 자동으로 제거한다.
//
// 이름은 requiresMove 필드(컴펜디엄 원문, 영어)를 그대로 기본값으로 채워뒀다.
// 번역 모듈을 쓰는 게임이면 "번역 모듈에서 자동 채우기"로 두 칸 다 한글로
// 바뀐다(둘 다 무브 이름이라 같은 방식으로 번역된다).
export const DEFAULT_MOVE_UPGRADES = [
  { upgradeName: "Armored Perfection", replacesName: "Armor Mastery" },
  { upgradeName: "Bloodthirsty", replacesName: "Merciless" },
  { upgradeName: "Evil Eye", replacesName: "Seeing Red" },
  { upgradeName: "Steel Hide", replacesName: "Iron Hide" },
  { upgradeName: "Taste Of Blood", replacesName: "Scent Of Blood" },
  { upgradeName: "Divine Authority", replacesName: "Voice Of Authority" },
  { upgradeName: "Divine Protection", replacesName: "Holy Protection" },
  { upgradeName: "Ever Onward", replacesName: "Charge!" },
  { upgradeName: "Evidence Of Faith", replacesName: "Divine Favor" },
  { upgradeName: "Holy Smite", replacesName: "Smite" },
  { upgradeName: "Impervious Defender", replacesName: "Staunch Defender" },
  { upgradeName: "Perfect Hospitaller", replacesName: "Hospitaller" },
  { upgradeName: "Tandem Strike", replacesName: "Setup Strike" },
  { upgradeName: "Anointed", replacesName: "Chosen One" },
  { upgradeName: "Divine Armor", replacesName: "Divine Protection" },
  { upgradeName: "Divine Invincibility", replacesName: "Divine Intervention" },
  { upgradeName: "Greater Empower", replacesName: "Empower" },
  { upgradeName: "Greater First Aid", replacesName: "First Aid" },
  { upgradeName: "Martyr", replacesName: "Penitent" },
  { upgradeName: "Providence", replacesName: "Serenity" },
  { upgradeName: "Arcane Armor", replacesName: "Arcane Ward" },
  { upgradeName: "Enchanter's Soul", replacesName: "Enchanter" },
  { upgradeName: "Greater Empowered Magic", replacesName: "Empowered Magic" },
  { upgradeName: "Highly Logical", replacesName: "Logical" },
  { upgradeName: "Master", replacesName: "Prodigy" },
  { upgradeName: "Protective Counter", replacesName: "Counterspell" },
  { upgradeName: "Alchemist", replacesName: "Brewer" },
  { upgradeName: "Dirty Fighter", replacesName: "Cheap Shot" },
  { upgradeName: "Extremely Cautious", replacesName: "Cautious" },
  { upgradeName: "Serious Underdog", replacesName: "Underdog" },
  { upgradeName: "A Safer Place", replacesName: "A Safe Place" },
  { upgradeName: "Hunter’s Prey", replacesName: "Familiar Prey" },
  { upgradeName: "Strider", replacesName: "Follow Me" },
  { upgradeName: "Viper’s Fangs", replacesName: "Viper’s Strike" },
  { upgradeName: "Wild Speech", replacesName: "Wild Empathy" },
  { upgradeName: "Con", replacesName: "Bamboozle" },
  { upgradeName: "Duelist’s Block", replacesName: "Duelist's Parry" },
  { upgradeName: "Eldritch Chord", replacesName: "Eldritch Tones" },
  { upgradeName: "Healing Chorus", replacesName: "Healing Song" },
  { upgradeName: "Vicious Blast", replacesName: "Vicious Cacophony" },
  { upgradeName: "Blood and Thunder", replacesName: "Red of Tooth and Claw" },
  { upgradeName: "Formshaper", replacesName: "Formcrafter" },
  { upgradeName: "World-talker", replacesName: "Thing-talker" }
];
