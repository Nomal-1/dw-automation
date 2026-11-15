// GM 스크린 "파티" 탭에 보여줄 캐릭터의 대기·지속 상태(dw-automation 플래그).
// kind: bool(켜져 있으면 표시) · number(0보다 크면 값과 함께) · bonus({amount, source} 객체)
// clear: "대기 상태 지우기" 버튼으로 지울 수 있는 일회성 대기(지속 효과·선택한 모드는 지우지 않는다)
export const PARTY_STATUS_FLAGS = [
  { flag: "pendingRollBonus", kind: "bonus", clear: true },
  { flag: "pendingDamageForward", kind: "bonus", clear: true },
  { flag: "pendingHeistBonus", kind: "bool", clear: true },
  { flag: "pendingSpellEffectBonus", kind: "bool", clear: true },
  { flag: "saferPlaceForwardPending", kind: "bool", clear: true },
  { flag: "recruitPenaltyPending", kind: "bool", clear: true },
  { flag: "knowItAllPending", kind: "bool", clear: true },
  { flag: "iAmTheLawPending", kind: "bool", clear: true },
  { flag: "defendVengeancePending", kind: "bool", clear: true },
  { flag: "everOnwardArmorPending", kind: "bool", clear: true },
  { flag: "defendReserve", kind: "number" },
  { flag: "divineHold", kind: "number" },
  { flag: "trapExpertHold", kind: "number" },
  { flag: "communePenaltyCount", kind: "number" },
  { flag: "seeingRedActive", kind: "bool" },
  { flag: "throughDeathsEyesActive", kind: "bool" },
  { flag: "loveTruckActive", kind: "bool" },
  { flag: "onTheMoveActive", kind: "bool" },
  { flag: "heraclesActive", kind: "bool" },
  { flag: "duelistParryActive", kind: "bool" },
  { flag: "druidShapeshift", kind: "bool" },
  { flag: "dopplegangersDanceHiding", kind: "bool" },
  { flag: "underdogConditionActive", kind: "bool" },
  { flag: "indestructibleHungerPenalty", kind: "bool" },
  { flag: "twiceAsBrightUsed", kind: "bool" }
];
