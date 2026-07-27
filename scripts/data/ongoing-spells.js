// 지속형(ongoing) 주문 데이터베이스. 던전월드 클레릭/위저드 기본 제공 주문
// 63개(system 1.8.2, packs/the-cleric-spells, packs/the-wizard-spells)를 전수
// 조사해서, 지속되는 동안 "다음 주문 시전에 영향을 주는지"를 3단계로 분류했다:
//
//   - "none": 지속되긴 하지만(효과가 유지됨) 시전에 아무 페널티도 없음 (예: Light)
//   - "minus1": 지속되는 동안 주문 시전 굴림에 -1 (예: Bless, Magic Weapon)
//   - "blocked": 지속되는 동안 아예 주문을 시전할 수 없음 (예: Invisibility, Dominate)
//
// 여기 없는 이름의 주문은 지속형이 아닌 것으로 취급한다(1회성 효과).
// 이름은 설정(지속 주문 관리)에서 GM이 직접 편집/추가/삭제할 수 있다 — 번역되면
// 이름을 맞춰줘야 하는 건 다른 설정들과 동일하다.
export const DEFAULT_ONGOING_SPELLS = [
  // --- Cleric ---
  { name: "Light", castPenalty: "none" },
  { name: "Bless", castPenalty: "minus1" },
  { name: "Cause Fear", castPenalty: "minus1" },
  { name: "Magic Weapon", castPenalty: "minus1" },
  { name: "Sanctuary", castPenalty: "none" },
  { name: "Animate Dead", castPenalty: "minus1" },
  { name: "Darkness", castPenalty: "minus1" },
  { name: "Hold Person", castPenalty: "none" },
  { name: "Contagion", castPenalty: "minus1" },
  { name: "Trap Soul", castPenalty: "none" },
  { name: "True Seeing", castPenalty: "minus1" },
  { name: "Sever", castPenalty: "minus1" },
  { name: "Word of Recall", castPenalty: "none" },
  { name: "Divine Presence", castPenalty: "minus1" },
  { name: "Plague", castPenalty: "minus1" },

  // --- Wizard ---
  { name: "Unseen Servant", castPenalty: "none" },
  { name: "Alarm", castPenalty: "none" },
  { name: "Charm Person", castPenalty: "none" },
  { name: "Invisibility", castPenalty: "blocked" },
  { name: "Telepathy", castPenalty: "none" },
  { name: "Mimic", castPenalty: "blocked" },
  { name: "Cage", castPenalty: "none" },
  { name: "Contact Other Plane", castPenalty: "none" },
  { name: "Polymorph", castPenalty: "none" },
  { name: "Summon Monster", castPenalty: "minus1" },
  { name: "Cloudkill", castPenalty: "none" },
  { name: "Contingency", castPenalty: "none" },
  { name: "Dominate", castPenalty: "blocked" },
  { name: "Alert", castPenalty: "none" },
  { name: "Antipathy", castPenalty: "minus1" },
  { name: "Shelter", castPenalty: "none" },
  { name: "Soul Gem", castPenalty: "none" }

  // 참고: "True Seeing"은 클레릭/위저드에 이름이 같은 별개의 주문으로 각각
  // 존재하지만 둘 다 minus1이라 하나로만 등록해도 된다.
];
