// 직업별 자동화 창에서 표 설정(세부 값)을 액션 줄 안에서 바로 고칠 때 쓰는 칸 정보.
// 각 표의 기존 편집 창 템플릿(templates/*-settings.html)의 열 제목·입력 종류와,
// 그 창 코드(apps/*-menu.js)의 선택지 목록을 2026-11-14에 그대로 옮겼다.
// 키는 표 설정 키(SETTINGS 값), 행의 "name"(어느 액션의 행인지)은 편집하지 않는다.
// 기존 편집 창에 칸을 더하면 여기에도 같이 더한다.
export const TABLE_FIELDS = {
  specialAttackMoves: [
      { key: "ranged", label: "DWAUTO.AttackMoves.Ranged", type: "checkbox" },
      { key: "gatesDamage", label: "DWAUTO.AttackMoves.GatesDamage", type: "checkbox" },
      { key: "damageOnPartial", label: "DWAUTO.AttackMoves.DamageOnPartial", type: "checkbox" },
      { key: "damageOnSuccess", label: "DWAUTO.AttackMoves.DamageOnSuccess", type: "checkbox" },
      { key: "partialPickCount", label: "DWAUTO.AttackMoves.PartialPickCount", type: "number" },
      { key: "successPickCount", label: "DWAUTO.AttackMoves.SuccessPickCount", type: "number" }
  ],
  classGrantMoves: [
      { key: "mode", label: "DWAUTO.ClassGrantMoves.Mode", type: "select", options: [{ value: "fixed", label: "DWAUTO.ClassGrantMoves.ModeOption.fixed" }, { value: "choice", label: "DWAUTO.ClassGrantMoves.ModeOption.choice" }] },
      { key: "grantedMoveNames", label: "DWAUTO.ClassGrantMoves.GrantedMoveNames", type: "text" },
      { key: "restrictToClassKeys", label: "DWAUTO.ClassGrantMoves.RestrictToClassKeys", type: "text" },
      { key: "excludeMulticlassMoves", label: "DWAUTO.ClassGrantMoves.ExcludeMulticlassMoves", type: "checkbox" }
  ],
  conditionalDamageMoves: [
      { key: "yesFormula", label: "DWAUTO.ConditionalDamageMoves.YesFormula", type: "text" },
      { key: "noFormula", label: "DWAUTO.ConditionalDamageMoves.NoFormula", type: "text" },
      { key: "requiresDesignation", label: "DWAUTO.ConditionalDamageMoves.RequiresDesignation", type: "checkbox" }
  ],
  conditionalTagMoves: [
      { key: "tag", label: "DWAUTO.ConditionalTagMoves.Tag", type: "text" }
  ],
  damageReductionMoves: [
      { key: "baseBonus", label: "DWAUTO.DamageReductionMoves.BaseBonus", type: "number" },
      { key: "outnumberedBonus", label: "DWAUTO.DamageReductionMoves.OutnumberedBonus", type: "number" },
      { key: "linkedMoveName", label: "DWAUTO.DamageReductionMoves.LinkedMoveName", type: "text" },
      { key: "autoCheckPreparedSpell", label: "DWAUTO.DamageReductionMoves.AutoCheckPreparedSpell", type: "checkbox" }
  ],
  druidDamageDieMoves: [
      { key: "dieSize", label: "DWAUTO.DruidDamageDieMoves.DieSize", type: "number" }
  ],
  empowerMoves: [
      { key: "isGreater", label: "DWAUTO.EmpowerMoves.IsGreater", type: "checkbox" }
  ],
  healingMoves: [
      { key: "formulaMode", label: "DWAUTO.HealingMoves.FormulaMode", type: "select", options: [{ value: "auto", label: "DWAUTO.HealingMoves.FormulaModeOption.auto" }, { value: "custom", label: "DWAUTO.HealingMoves.FormulaModeOption.custom" }, { value: "max", label: "DWAUTO.HealingMoves.FormulaModeOption.max" }] },
      { key: "customFormula", label: "DWAUTO.HealingMoves.CustomFormula", type: "text" },
      { key: "transferToSelfOnPartial", label: "DWAUTO.HealingMoves.TransferToSelfOnPartial", type: "checkbox" }
  ],
  hitTriggerMoves: [
      { key: "effect", label: "DWAUTO.HitTriggerMoves.Effect", type: "select", options: [{ value: "armor", label: "DWAUTO.HitTriggerMoves.EffectOption.armor" }, { value: "debility", label: "DWAUTO.HitTriggerMoves.EffectOption.debility" }, { value: "spellDefense", label: "DWAUTO.HitTriggerMoves.EffectOption.spellDefense" }, { value: "hold", label: "DWAUTO.HitTriggerMoves.EffectOption.hold" }, { value: "animalCompanion", label: "DWAUTO.HitTriggerMoves.EffectOption.animalCompanion" }, { value: "ongoingPenalty", label: "DWAUTO.HitTriggerMoves.EffectOption.ongoingPenalty" }, { value: "fireAid", label: "DWAUTO.HitTriggerMoves.EffectOption.fireAid" }] },
      { key: "grantsForward", label: "DWAUTO.HitTriggerMoves.GrantsForward", type: "checkbox" }
  ],
  holdGrantMoves: [
      { key: "holdAmount", label: "DWAUTO.HoldGrantMoves.HoldAmount", type: "number" }
  ],
  hospitallerMoves: [
      { key: "bonusFormula", label: "DWAUTO.HospitallerMoves.BonusFormula", type: "text" }
  ],
  ongoingPenaltyReductionMoves: [
      { key: "reduction", label: "DWAUTO.OngoingPenaltyReductionMoves.Reduction", type: "number" }
  ],
  ongoingSpells: [
      { key: "castPenalty", label: "DWAUTO.OngoingSpells.CastPenalty", type: "select", options: [{ value: "none", label: "DWAUTO.OngoingSpells.Penalty.none" }, { value: "minus1", label: "DWAUTO.OngoingSpells.Penalty.minus1" }, { value: "blocked", label: "DWAUTO.OngoingSpells.Penalty.blocked" }] }
  ],
  prepareSpellsMoves: [
      { key: "enforceIndividualLevelCap", label: "DWAUTO.PrepareSpellsMoves.EnforceIndividualLevelCap", type: "checkbox" }
  ],
  selfForwardMoves: [
      { key: "restrictToMoveNames", label: "DWAUTO.SelfForwardMoves.RestrictToMoveNames", type: "text" }
  ],
  spellDamageMoves: [
      { key: "formulaMode", label: "DWAUTO.HealingMoves.FormulaMode", type: "select", options: [{ value: "auto", label: "DWAUTO.HealingMoves.FormulaModeOption.auto" }, { value: "custom", label: "DWAUTO.HealingMoves.FormulaModeOption.custom" }] },
      { key: "customFormula", label: "DWAUTO.HealingMoves.CustomFormula", type: "text" },
      { key: "ignoresArmor", label: "DWAUTO.SpellDamageMoves.IgnoresArmor", type: "checkbox" },
      { key: "selfDamageFormula", label: "DWAUTO.SpellDamageMoves.SelfDamageFormula", type: "text" }
  ]
};
