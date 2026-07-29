// "다른 직업의 액션을 얻는 액션": 발동하면 다른 직업 컴펜디엄의 특정 무브(들)를
// 그대로 캐릭터에게 추가해주는 무브. 팔라딘 Divine Favor("신의 은혜")와
// 레인저 God Amidst The Wastes("황야 속의 신")가 원문 그대로 완전히 같은
// 효과("클레릭의 예배/주문 시전 무브를 얻고, 자신의 레벨만큼 클레릭 레벨을
// 가진 것으로 취급")를 준다 — 둘 다 클레릭의 Commune/Cast A Spell을 그대로
// 부여한다.
//
// grantedMoveNames에 적은 이름은 8개 기본 직업 무브 컴펜디엄 전체에서
// 이름으로 찾는다(특정 팩을 지정할 필요 없음 — 무브 이름은 클래스마다
// 겹치지 않는다고 가정한다). 이미 그 이름의 무브를 갖고 있으면(멀티클래스
// 등으로 이미 얻었거나 실제 그 클래스 본인인 경우) 중복으로 추가하지 않는다.
//
// 참고: Multiclass Dabbler/Initiate처럼 "다른 클래스의 시작 무브 중 아무거나
// 하나 고르시오" 식의 무브는 고정된 목록이 아니라 자유 선택이라 이 표로
// 자동화할 수 없다 — 지금은 다루지 않는다.
export const DEFAULT_CLASS_GRANT_MOVES = [
  { name: "Divine Favor", grantedMoveNames: "Commune, Cast A Spell" },
  { name: "God Amidst The Wastes", grantedMoveNames: "Commune, Cast A Spell" }
];
