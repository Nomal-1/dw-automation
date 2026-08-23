// 클레릭/위저드 공격 주문 중 구조화된 피해 공식(system.rollFormula)이 있는
// 것들의 기본값. features/spell-damage.js가 Cast a Spell로 이 표에 등록된
// 주문을 선택하면 자동으로 피해를 굴려준다 — data/healing-moves.js와 완전히
// 같은 구조("auto"는 주문 아이템의 system.rollFormula를 그대로 읽는다.
// 번역 여부와 무관하게 항상 정확하다).
//
// 8개 기본 직업 중 클레릭/위저드 주문 컴펜디엄(1.8.2) 전수조사로 확인:
// rollFormula가 있어도 피해가 아닌 주문(예: Dominate의 1d4는 hold 개수,
// Sleep의 1d4는 영향받는 적의 수, Summon Monster의 1d6은 소환수 스탯)은
// 제외했다. Cloudkill처럼 rollFormula가 비어 있고 "그 지역에서 피해를 입을
// 때마다 추가로"라는 지속·조건부 효과는 "한 번 캐스팅하면 한 번 피해를
// 준다"는 이 모듈의 단순 모델에 맞지 않아 기본값에서 뺐다(GM이 원하면
// 설정 화면에서 직접 행을 추가할 수 있다).
//
// - ignoresArmor: 원문에 "장갑을 무시한다"는 문구가 있으면 켠다. 데미지
//   굴림 메시지에 "ignores armor" 원문 태그를 노출시켜서, 던전월드 시스템의
//   데미지 적용 버튼이 그 문구를 읽고 알아서 장갑 계산을 건너뛰게 한다
//   (features/attack-assistant.js의 관례와 동일).
// - selfDamageFormula: Harm처럼 "대상에게 피해를 주는 동시에 자신도 피해를
//   입는" 주문 전용. 항상 시전자 본인에게 적용되는 피해라 대상 선택이나
//   권한 확인 없이 바로 시전자의 HP에서 깎는다.
export const DEFAULT_SPELL_DAMAGE_MOVES = [
  { name: "Magic Missile", formulaMode: "auto", customFormula: "2d4", ignoresArmor: false, selfDamageFormula: "" },
  { name: "Fireball", formulaMode: "auto", customFormula: "2d6", ignoresArmor: true, selfDamageFormula: "" },
  { name: "Harm", formulaMode: "auto", customFormula: "2d8", ignoresArmor: true, selfDamageFormula: "1d6" }
];
