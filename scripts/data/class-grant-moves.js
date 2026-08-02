// "다른 직업의 액션을 얻는 액션": 발동하면 다른 직업 무브(들)를 그대로
// 캐릭터에게 추가해주는 무브. mode로 두 가지 방식을 구분한다.
//
// - mode: "fixed" — 항상 정해진 무브(들)를 그대로 부여한다. 팔라딘 Divine
//   Favor("신의 은혜")와 레인저 God Amidst The Wastes("황야 속의 신")가
//   원문 그대로 완전히 같은 효과("클레릭의 예배/주문 시전 무브를 얻고,
//   자신의 레벨만큼 클레릭 레벨을 가진 것으로 취급")를 준다 — 둘 다
//   클레릭의 Commune/Cast A Spell을 그대로 부여한다. grantedMoveNames에
//   적은 이름은 8개 기본 직업 무브 컴펜디엄 전체에서 이름으로 찾는다
//   (특정 팩을 지정할 필요 없음 — 무브 이름은 클래스마다 겹치지 않는다고
//   가정한다).
// - mode: "choice" — 파이터 Multiclass Dabbler/Initiate("다른 직업 무브
//   하나 습득")처럼 "다른 직업 무브 중 아무거나 하나 고르시오" 식의 무브.
//   발동하면 직업을 먼저 고르고, 그 직업의 무브 목록에서 하나를 골라 그대로
//   부여한다(grantedMoveNames는 이 모드에서 쓰이지 않는다).
//
// 두 모드 모두, 이미 그 이름의 무브를 갖고 있으면(멀티클래스로 이미
// 얻었거나 실제 그 클래스 본인인 경우) 중복으로 추가하지 않는다.
//
// restrictToClassKeys(선택, "choice" 모드 전용): 비워두면 Multiclass
// Dabbler/Initiate처럼 8개 기본 직업 전체에서 고를 수 있다. 값을 채우면
// (쉼표로 구분한 팩 이름 조각, 예: "fighter,bard,thief") 그 직업들의
// 무브 목록에서만 고를 수 있게 제한한다 — 바바리안 Appetite For
// Destruction/Kill 'Em All 원문("Take a move from the Fighter, Bard, or
// Thief class list")이 이 제한을 명시하고 있다. 팩 이름 조각은 번역과
// 무관하게 고정된 팩 id(dungeonworld.the-<조각>-moves)로 매칭하므로
// 번역 여부와 상관없이 항상 정확히 동작한다.
// excludeMulticlassMoves(선택): true면 고를 수 있는 목록에서 "Multiclass
// Dabbler"/"Multiclass Initiate" 자체를 제외한다 — 같은 원문("You may not
// take multiclass moves from those classes")을 반영한 것으로, 멀티클래스로
// 멀티클래스 무브를 또 골라 무한히 다른 직업을 넘나드는 것을 막는다.
export const DEFAULT_CLASS_GRANT_MOVES = [
  { name: "Divine Favor", grantedMoveNames: "Commune, Cast A Spell", mode: "fixed" },
  { name: "God Amidst The Wastes", grantedMoveNames: "Commune, Cast A Spell", mode: "fixed" },
  { name: "Multiclass Dabbler", grantedMoveNames: "", mode: "choice" },
  { name: "Multiclass Initiate", grantedMoveNames: "", mode: "choice" },
  {
    name: "Appetite For Destruction",
    grantedMoveNames: "",
    mode: "choice",
    restrictToClassKeys: "fighter,bard,thief",
    excludeMulticlassMoves: true
  },
  {
    name: "Kill 'Em All",
    grantedMoveNames: "",
    mode: "choice",
    restrictToClassKeys: "fighter,bard,thief",
    excludeMulticlassMoves: true
  },
  // 이몰레이터 Ogdru Jahad 원문: "Gain the Wizard move Ritual." — Divine
  // Favor와 같은 "고정" 패턴(정해진 무브를 그대로 부여)이지만, "class list"/
  // "multiclass" 문구가 없어 처음 바바리안/이몰레이터를 훑을 때 썼던 키워드
  // 검색(전수조사 1차)에서 놓쳤다가, 이번에(전수조사 2차, 카테고리 전체 재검토)
  // 발견했다.
  { name: "Ogdru Jahad", grantedMoveNames: "Ritual", mode: "fixed" },
  // 드루이드 Hunter's Brother(레벨2)/Stalker's Sister(레벨6) 원문: "Choose
  // one move from the ranger class list." — Appetite For Destruction/
  // Kill 'Em All과 완전히 같은 "choice + restrictToClassKeys" 패턴이다
  // (excludeMulticlassMoves는 원문에 언급이 없어 켜지 않는다).
  { name: "Hunter's Brother", grantedMoveNames: "", mode: "choice", restrictToClassKeys: "ranger" },
  { name: "Stalker's Sister", grantedMoveNames: "", mode: "choice", restrictToClassKeys: "ranger" },
  // 레인저 Special Trick 원문: "다른 직업의 무브를 하나 고른다. 동반 동물과
  // 함께 활동하는 동안에만 그 무브를 쓸 수 있다." Multiclass Dabbler/
  // Initiate와 완전히 같은 "제한 없는 choice" 패턴이고(다른 8개 기본 직업
  // 전체에서 고름), "동반 동물과 함께일 때만"이라는 조건은 이 모듈이
  // 자동으로 판정할 수 없는 서사적 전제라 무시한다(무브를 얻으면 항상 쓸
  // 수 있게 된다) — Multiclass Dabbler/Initiate 자체도 조건 없이 그대로
  // 부여하는 것과 같은 단순화다.
  { name: "Special Trick", grantedMoveNames: "", mode: "choice" }
];
