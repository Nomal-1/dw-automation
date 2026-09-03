// 여러 직업의 무브가 한 표에 섞여 있는 공용 설정 메뉴(메모형 무브, 피격 시
// 무효화 무브, 클래스 부여 무브, 무브 업그레이드 등)에서 "이 행이 어느
// 직업 것인지" 보여주기 위한 표시 전용 데이터다. 이름은 공식 컴펜디엄
// 영문 원문(어퍼스트로피는 곡선형 ’로 통일 — lib/move-class-lookup.js가
// 조회 전에 정규화한다) 기준이며, 로직 분기에는 전혀 쓰이지 않는다(순수
// 표시/정렬 목적) — 항목이 여기 없어도 자동화 자체는 정상 동작한다.
export const MOVE_CLASS_LABELS = {
  // 야만전사
  "Indestructible Hunger": "야만전사",
  "Unencumbered, Unharmed": "야만전사",
  "Scent Of Blood": "야만전사",
  "Taste Of Blood": "야만전사",
  Usurper: "야만전사",
  "Appetite For Destruction": "야만전사",
  "Kill 'Em All": "야만전사",

  // 음유시인
  "An Ear For Magic": "음유시인",
  "Unforgettable Face": "음유시인",
  Con: "음유시인",
  Bamboozle: "음유시인",
  "Duelist's Block": "음유시인",
  "Duelist's Parry": "음유시인",
  "Eldritch Chord": "음유시인",
  "Eldritch Tones": "음유시인",
  "Healing Chorus": "음유시인",
  "Healing Song": "음유시인",
  "Vicious Blast": "음유시인",
  "Vicious Cacophony": "음유시인",

  // 사제
  Deity: "사제",
  Apotheosis: "사제",
  Reaper: "사제",
  "Divine Authority": "사제",
  "Voice Of Authority": "사제",
  Anointed: "사제",
  "Chosen One": "사제",
  "Greater Empower": "사제",
  Empower: "사제",
  "Greater First Aid": "사제",
  "First Aid": "사제",
  Martyr: "사제",
  Penitent: "사제",
  Providence: "사제",
  Serenity: "사제",
  "Divine Intervention": "사제",
  "Divine Invincibility": "사제",
  // "Divine Protection"/"Divine Armor"는 클레릭과 팔라딘이 이름을 공유한다
  // (data/hit-trigger-moves.js 상단 주석 참고) — 팔라딘 쪽은 linkedMoveName이
  // "Quest"로 채워져 있어 lib/move-class-lookup.js가 그 필드로 구분하고,
  // 여기 기본값은 클레릭 쪽(linkedMoveName 없음)으로 둔다.
  "Divine Protection": "사제",
  "Divine Armor": "사제",

  // 드루이드
  "Hunter's Brother": "드루이드",
  "Stalker's Sister": "드루이드",
  Barkskin: "드루이드",
  "Blood and Thunder": "드루이드",
  "Red of Tooth and Claw": "드루이드",
  Formshaper: "드루이드",
  Formcrafter: "드루이드",
  "World-talker": "드루이드",
  "Thing-talker": "드루이드",

  // 전사
  "Armor Mastery": "전사",
  "Armored Perfection": "전사",
  Bloodthirsty: "전사",
  Merciless: "전사",
  "Evil Eye": "전사",
  "Seeing Red": "전사",
  "Steel Hide": "전사",
  "Iron Hide": "전사",

  // 소각술사
  "Fighting Fire with Fire": "소각술사",
  "Ogdru Jahad": "소각술사",
  "Burns Half As Long": "소각술사",
  "Burns Twice As Bright": "소각술사",
  "Fanning The Flames": "소각술사",
  Firebrand: "소각술사",

  // 팔라딘
  "Bloody Aegis": "팔라딘",
  "Divine Favor": "팔라딘",
  Quest: "팔라딘",
  Indomitable: "팔라딘",
  "Evidence Of Faith": "팔라딘",
  "Holy Protection": "팔라딘",
  Smite: "팔라딘",
  "Holy Smite": "팔라딘",
  Exterminatus: "팔라딘",
  "Ever Onward": "팔라딘",
  "Charge!": "팔라딘",
  "Impervious Defender": "팔라딘",
  "Staunch Defender": "팔라딘",
  "Perfect Hospitaller": "팔라딘",
  Hospitaller: "팔라딘",
  "Tandem Strike": "팔라딘",
  "Setup Strike": "팔라딘",

  // 도적
  Underdog: "도적",
  "Serious Underdog": "도적",
  Alchemist: "도적",
  Brewer: "도적",
  "Dirty Fighter": "도적",
  "Cheap Shot": "도적",
  "Extremely Cautious": "도적",
  Cautious: "도적",

  // 마법사
  "Spell Defense": "마법사",
  "Quick Study": "마법사",
  "Arcane Armor": "마법사",
  "Arcane Ward": "마법사",
  "Enchanter's Soul": "마법사",
  Enchanter: "마법사",
  "Greater Empowered Magic": "마법사",
  "Empowered Magic": "마법사",
  "Highly Logical": "마법사",
  Logical: "마법사",
  Master: "마법사",
  Prodigy: "마법사",
  "Protective Counter": "마법사",
  Counterspell: "마법사",

  // 사냥꾼
  "Man's Best Friend": "사냥꾼",
  "God Amidst The Wastes": "사냥꾼",
  "Animal Companion": "사냥꾼",
  "Special Trick": "사냥꾼",
  "A Safer Place": "사냥꾼",
  "A Safe Place": "사냥꾼",
  "Hunter's Prey": "사냥꾼",
  "Familiar Prey": "사냥꾼",
  Strider: "사냥꾼",
  "Follow Me": "사냥꾼",
  "Viper's Fangs": "사냥꾼",
  "Viper's Strike": "사냥꾼",
  "Wild Speech": "사냥꾼",
  "Wild Empathy": "사냥꾼",
  "Smaug's Belly": "사냥꾼",

  // 여러 직업이 함께 쓰는 이름(고정된 한 직업으로 표시할 수 없음)
  "Multiclass Dabbler": "공용",
  "Multiclass Initiate": "공용"
};
