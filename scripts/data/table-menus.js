import { DEFAULT_SPECIAL_ATTACK_MOVES } from "./attack-moves.js";
import { DEFAULT_CLASS_GRANT_MOVES } from "./class-grant-moves.js";
import { DEFAULT_CONDITIONAL_DAMAGE_MOVES } from "./conditional-damage-moves.js";
import { DEFAULT_CONDITIONAL_TAG_MOVES } from "./conditional-tag-moves.js";
import { DEFAULT_DAMAGE_REDUCTION_MOVES, DEFAULT_HIT_TRIGGER_MOVES } from "./hit-trigger-moves.js";
import { DEFAULT_DRUID_DAMAGE_DIE_MOVES } from "./druid-damage-die-moves.js";
import { DEFAULT_EMPOWER_MOVES } from "./empower-moves.js";
import { DEFAULT_HEALING_MOVES, DEFAULT_HOSPITALLER_MOVES } from "./healing-moves.js";
import { DEFAULT_HOLD_GRANT_MOVES } from "./hold-grant-moves.js";
import { DEFAULT_ONGOING_PENALTY_REDUCTION_MOVES } from "./ongoing-penalty-reduction-moves.js";
import { DEFAULT_PREPARE_SPELLS_MOVES } from "./prepare-spells-moves.js";
import { DEFAULT_SELF_FORWARD_MOVES } from "./self-forward-moves.js";
import { DEFAULT_SPELL_DAMAGE_MOVES } from "./spell-damage-moves.js";
import { DEFAULT_ONGOING_SPELLS } from "./ongoing-spells.js";

// 표 설정 편집 창(apps/table-editor-app.js) 하나가 16개 표를 모두 그리기 위한 정보.
// 칸(열) 정보는 data/table-fields.js의 TABLE_FIELDS에 있고, 여기에는 창 제목·안내 문구의
// 번역 키 앞부분(prefix), 이름 열·초기화 버튼 문구, 기본값, 새 줄의 초기값, 창 너비,
// 직업 배지 열을 보일지(classColumn)만 둔다. 예전에는 표마다 창 코드와 템플릿이 따로
// 있었다(apps/*-moves-menu.js, templates/*-moves-settings.html — 0.124.0에서 이 파일로 합침).
//
// 키는 표 설정 키(TABLE_FIELDS와 같다). menuKey는 game.settings.registerMenu에 쓴 메뉴 키.
// prefix 아래에 Title, Hint, ResetConfirmTitle, ResetConfirmContent 번역이 있다.
export const TABLE_MENUS = {
  specialAttackMoves: {
    menuKey: "attackMovesMenu", prefix: "DWAUTO.AttackMoves", defaults: DEFAULT_SPECIAL_ATTACK_MOVES, width: 640,
    blank: { name: "", ranged: false, gatesDamage: false, damageOnPartial: true, damageOnSuccess: true, partialPickCount: 1, successPickCount: 1 }
  },
  classGrantMoves: {
    menuKey: "classGrantMovesMenu", prefix: "DWAUTO.ClassGrantMoves", defaults: DEFAULT_CLASS_GRANT_MOVES, width: 620, classColumn: true,
    blank: { name: "", grantedMoveNames: "", mode: "fixed", restrictToClassKeys: "", excludeMulticlassMoves: false }
  },
  conditionalDamageMoves: {
    menuKey: "conditionalDamageMovesMenu", prefix: "DWAUTO.ConditionalDamageMoves", defaults: DEFAULT_CONDITIONAL_DAMAGE_MOVES, width: 620, classColumn: true,
    blank: { name: "", yesFormula: "", noFormula: "0", requiresDesignation: false }
  },
  conditionalTagMoves: {
    menuKey: "conditionalTagMovesMenu", prefix: "DWAUTO.ConditionalTagMoves", defaults: DEFAULT_CONDITIONAL_TAG_MOVES, width: 560,
    blank: { name: "", tag: "" }
  },
  damageReductionMoves: {
    menuKey: "damageReductionMovesMenu", prefix: "DWAUTO.DamageReductionMoves", defaults: DEFAULT_DAMAGE_REDUCTION_MOVES, width: 560, classColumn: true,
    blank: { name: "", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "", autoCheckPreparedSpell: false }
  },
  druidDamageDieMoves: {
    menuKey: "druidDamageDieMovesMenu", prefix: "DWAUTO.DruidDamageDieMoves", defaults: DEFAULT_DRUID_DAMAGE_DIE_MOVES, width: 560,
    blank: { name: "", dieSize: 8 }, mins: { dieSize: 1 }
  },
  empowerMoves: {
    menuKey: "empowerMovesMenu", prefix: "DWAUTO.EmpowerMoves", defaults: DEFAULT_EMPOWER_MOVES, width: 560, classColumn: true,
    blank: { name: "", isGreater: false }
  },
  healingMoves: {
    menuKey: "healingMovesMenu", prefix: "DWAUTO.HealingMoves", defaults: DEFAULT_HEALING_MOVES, width: 680,
    blank: { name: "", formulaMode: "auto", customFormula: "", transferToSelfOnPartial: false }
  },
  hitTriggerMoves: {
    menuKey: "hitTriggerMovesMenu", prefix: "DWAUTO.HitTriggerMoves", defaults: DEFAULT_HIT_TRIGGER_MOVES, width: 620, classColumn: true,
    blank: { name: "", effect: "armor", grantsForward: false }
  },
  holdGrantMoves: {
    menuKey: "holdGrantMovesMenu", prefix: "DWAUTO.HoldGrantMoves", defaults: DEFAULT_HOLD_GRANT_MOVES, width: 560,
    blank: { name: "", holdAmount: 1 }
  },
  hospitallerMoves: {
    menuKey: "hospitallerMovesMenu", prefix: "DWAUTO.HospitallerMoves", defaults: DEFAULT_HOSPITALLER_MOVES, width: 560,
    blank: { name: "", bonusFormula: "" }
  },
  ongoingPenaltyReductionMoves: {
    menuKey: "ongoingPenaltyReductionMovesMenu", prefix: "DWAUTO.OngoingPenaltyReductionMoves", defaults: DEFAULT_ONGOING_PENALTY_REDUCTION_MOVES, width: 560,
    blank: { name: "", reduction: 1 }
  },
  ongoingSpells: {
    menuKey: "ongoingSpellsMenu", prefix: "DWAUTO.OngoingSpells", defaults: DEFAULT_ONGOING_SPELLS, width: 560,
    blank: { name: "", castPenalty: "none" }
  },
  prepareSpellsMoves: {
    menuKey: "prepareSpellsMovesMenu", prefix: "DWAUTO.PrepareSpellsMoves", defaults: DEFAULT_PREPARE_SPELLS_MOVES, width: 560,
    blank: { name: "", enforceIndividualLevelCap: false }
  },
  selfForwardMoves: {
    menuKey: "selfForwardMovesMenu", prefix: "DWAUTO.SelfForwardMoves", defaults: DEFAULT_SELF_FORWARD_MOVES, width: 640, classColumn: true,
    blank: { name: "", restrictToMoveNames: "" }
  },
  spellDamageMoves: {
    // 예전 창도 이름 열·초기화 버튼은 치유 표의 문구를 같이 썼다
    menuKey: "spellDamageMovesMenu", prefix: "DWAUTO.SpellDamageMoves", labelPrefix: "DWAUTO.HealingMoves", defaults: DEFAULT_SPELL_DAMAGE_MOVES, width: 720,
    blank: { name: "", formulaMode: "auto", customFormula: "", ignoresArmor: false, selfDamageFormula: "" }
  }
};
