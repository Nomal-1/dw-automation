import { MODULE_ID, SETTINGS } from "./constants.js";
import { TagSettingsMenu } from "./apps/tag-settings-menu.js";
import { AttackMovesMenu } from "./apps/attack-moves-menu.js";
import { DEFAULT_SPECIAL_ATTACK_MOVES } from "./data/attack-moves.js";
import { OngoingSpellsMenu } from "./apps/ongoing-spells-menu.js";
import { DEFAULT_ONGOING_SPELLS } from "./data/ongoing-spells.js";
import { TranslationImportMenu } from "./apps/translation-import-menu.js";
import { HitTriggerMovesMenu } from "./apps/hit-trigger-moves-menu.js";
import { HealingMovesMenu } from "./apps/healing-moves-menu.js";
import { HospitallerMovesMenu } from "./apps/hospitaller-moves-menu.js";
import { DEFAULT_HEALING_MOVES, DEFAULT_HOSPITALLER_MOVES } from "./data/healing-moves.js";
import { SpellDamageMovesMenu } from "./apps/spell-damage-moves-menu.js";
import { DEFAULT_SPELL_DAMAGE_MOVES } from "./data/spell-damage-moves.js";
import { MoveUpgradesMenu } from "./apps/move-upgrades-menu.js";
import { DEFAULT_MOVE_UPGRADES } from "./data/move-upgrades.js";
import { DamageReductionMovesMenu } from "./apps/damage-reduction-moves-menu.js";
import { DEFAULT_DAMAGE_REDUCTION_MOVES } from "./data/hit-trigger-moves.js";
import { DruidDamageDieMovesMenu } from "./apps/druid-damage-die-moves-menu.js";
import { DEFAULT_DRUID_DAMAGE_DIE_MOVES } from "./data/druid-damage-die-moves.js";
import { ConditionalDamageMovesMenu } from "./apps/conditional-damage-moves-menu.js";
import { DEFAULT_CONDITIONAL_DAMAGE_MOVES } from "./data/conditional-damage-moves.js";
import { ConditionalTagMovesMenu } from "./apps/conditional-tag-moves-menu.js";
import { DEFAULT_CONDITIONAL_TAG_MOVES } from "./data/conditional-tag-moves.js";
import { DEFAULT_HIT_TRIGGER_MOVES } from "./data/hit-trigger-moves.js";
import { NoteMovesMenu } from "./apps/note-moves-menu.js";
import { DEFAULT_NOTE_MOVE_NAMES } from "./data/note-moves.js";
import { ClassGrantMovesMenu } from "./apps/class-grant-moves-menu.js";
import { DEFAULT_CLASS_GRANT_MOVES } from "./data/class-grant-moves.js";
import { PrepareSpellsMovesMenu } from "./apps/prepare-spells-moves-menu.js";
import { DEFAULT_PREPARE_SPELLS_MOVES } from "./data/prepare-spells-moves.js";
import { OngoingPenaltyReductionMovesMenu } from "./apps/ongoing-penalty-reduction-moves-menu.js";
import { DEFAULT_ONGOING_PENALTY_REDUCTION_MOVES } from "./data/ongoing-penalty-reduction-moves.js";
import { EmpowerMovesMenu } from "./apps/empower-moves-menu.js";
import { DEFAULT_EMPOWER_MOVES } from "./data/empower-moves.js";
import { HoldGrantMovesMenu } from "./apps/hold-grant-moves-menu.js";
import { DEFAULT_HOLD_GRANT_MOVES } from "./data/hold-grant-moves.js";
import { SelfForwardMovesMenu } from "./apps/self-forward-moves-menu.js";
import { DEFAULT_SELF_FORWARD_MOVES } from "./data/self-forward-moves.js";
import { VersionInfoMenu } from "./apps/version-info-menu.js";

export function registerSettings() {
  // Foundry 설정 창은 메뉴(버튼으로 여는 것들)를 일반 설정보다 항상 먼저
  // 보여준다 — 일반 설정으로 등록하면(예전 방식) 메뉴 목록을 다 지나야
  // 나오는 아래쪽에 있어서 "맨 위"가 아니었다. 그래서 메뉴로 등록하고,
  // 메뉴 중에서도 가장 먼저 등록해서 진짜 맨 위에 오게 한다. 자세한 설계는
  // apps/version-info-menu.js 참고.
  game.settings.registerMenu(MODULE_ID, SETTINGS.MODULE_VERSION_DISPLAY, {
    name: "DWAUTO.Settings.ModuleVersion.Name",
    label: "DWAUTO.Settings.ModuleVersion.Label",
    hint: "DWAUTO.Settings.ModuleVersion.Hint",
    icon: "fas fa-info-circle",
    type: VersionInfoMenu,
    restricted: true
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_NPC_GENERATOR, {
    name: "DWAUTO.Settings.EnableNpcGenerator.Name",
    hint: "DWAUTO.Settings.EnableNpcGenerator.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_MONSTER_GENERATOR, {
    name: "DWAUTO.Settings.EnableMonsterGenerator.Name",
    hint: "DWAUTO.Settings.EnableMonsterGenerator.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_ATTACK_ASSISTANT, {
    name: "DWAUTO.Settings.EnableAttackAssistant.Name",
    hint: "DWAUTO.Settings.EnableAttackAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // dungeonworld-ko(한글화 모듈)가 설치되어 있으면, 아래의 무브/주문 이름 설정들을
  // 그 모듈의 번역 데이터 기준으로 한 번에 자동 채워주는 도구. 실제 값 변경은
  // lib/translation-import.js에서 이뤄지고, 이 메뉴는 실행 버튼만 제공한다.
  game.settings.registerMenu(MODULE_ID, "translationImportMenu", {
    name: "DWAUTO.Settings.TranslationImportMenu.Name",
    label: "DWAUTO.Settings.TranslationImportMenu.Label",
    hint: "DWAUTO.Settings.TranslationImportMenu.Hint",
    icon: "fas fa-language",
    type: TranslationImportMenu,
    restricted: true
  });

  // Hack & Slash/Volley처럼 선택지 없이 성공·부분성공 시 항상 데미지를 굴리는
  // 단순한 무브 이름 목록. Backstab/Called Shot처럼 선택지에 따라 거동이 달라지는
  // 무브는 아래 "특수 공격 무브" 설정에서 별도로 관리한다.
  game.settings.register(MODULE_ID, SETTINGS.MELEE_MOVE_NAMES, {
    name: "DWAUTO.Settings.MeleeMoveNames.Name",
    hint: "DWAUTO.Settings.MeleeMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Hack & Slash"
  });

  game.settings.register(MODULE_ID, SETTINGS.RANGED_MOVE_NAMES, {
    name: "DWAUTO.Settings.RangedMoveNames.Name",
    hint: "DWAUTO.Settings.RangedMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Volley"
  });

  // 근접/사격 판정 기준: 무기의 태그(tagsString)에 아래 목록 중 하나라도
  // 포함되어 있으면 각각 근접/사격 무기로 취급한다. 두 목록에 다 안 걸리는
  // 무기는 데미지 굴림 시 무기 목록에서 제외되지 않도록 폴백 처리한다
  // (attack-assistant.js의 promptWeaponChoice 참고).
  // 던전월드 기본 무기는 근접이 hand/close/reach, 사격이 near/far 태그를 쓰므로
  // 기본값은 그에 맞춰뒀다. touch(반드시 인접해야 하는 사거리)도 사실상
  // 근접이라 포함한다 — 소각술사 불타는 낙인의 무기가 기본으로 이 태그를
  // 가진다(features/burning-brand.js 참고).
  game.settings.register(MODULE_ID, SETTINGS.MELEE_WEAPON_TAGS, {
    name: "DWAUTO.Settings.MeleeWeaponTags.Name",
    hint: "DWAUTO.Settings.MeleeWeaponTags.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "hand, close, reach, touch"
  });

  game.settings.register(MODULE_ID, SETTINGS.RANGED_WEAPON_TAGS, {
    name: "DWAUTO.Settings.RangedWeaponTags.Name",
    hint: "DWAUTO.Settings.RangedWeaponTags.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "near, far"
  });

  // 데미지 굴림에 자동 반영할 태그 목록. 체크박스 UI(TagSettingsMenu)에서 편집하며,
  // 여기 저장되는 값은 태그 카탈로그(data/tag-catalog.js)의 key 배열이다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLED_DAMAGE_TAGS, {
    scope: "world",
    config: false,
    type: Array,
    default: ["damageBonus", "piercing", "ignoresArmor", "forceful", "messy"]
  });

  game.settings.registerMenu(MODULE_ID, "tagSettingsMenu", {
    name: "DWAUTO.Settings.TagMenu.Name",
    label: "DWAUTO.Settings.TagMenu.Label",
    hint: "DWAUTO.Settings.TagMenu.Hint",
    icon: "fas fa-tags",
    type: TagSettingsMenu,
    restricted: true
  });

  // 선택지에 종속되어 데미지 여부/사격 여부가 결과 등급마다 다른 무브(Backstab,
  // Called Shot 등). 컴펜디엄 원본 ID로는 자동 인식이 안 되는 시스템도 있어서
  // (캐릭터 생성 시 무브 아이템을 매번 새로 만들고 출처 플래그를 안 남기는 경우),
  // 근접/사격 무브 이름 설정과 같은 방식으로 이름 기반 표를 GM이 직접 관리한다.
  game.settings.register(MODULE_ID, SETTINGS.SPECIAL_ATTACK_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_SPECIAL_ATTACK_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "attackMovesMenu", {
    name: "DWAUTO.Settings.AttackMovesMenu.Name",
    label: "DWAUTO.Settings.AttackMovesMenu.Label",
    hint: "DWAUTO.Settings.AttackMovesMenu.Hint",
    icon: "fas fa-hand-fist",
    type: AttackMovesMenu,
    restricted: true
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SPELLCASTING_ASSISTANT, {
    name: "DWAUTO.Settings.EnableSpellcastingAssistant.Name",
    hint: "DWAUTO.Settings.EnableSpellcastingAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // Cast a Spell류 무브 이름(클레릭/위저드가 이름이 다를 수 있음, 쉼표 구분).
  game.settings.register(MODULE_ID, SETTINGS.CAST_SPELL_MOVE_NAMES, {
    name: "DWAUTO.Settings.CastSpellMoveNames.Name",
    hint: "DWAUTO.Settings.CastSpellMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Cast A Spell, Cast a Spell"
  });

  // 지속형 주문 데이터베이스. 체크박스 UI(OngoingSpellsMenu)에서 편집한다.
  game.settings.register(MODULE_ID, SETTINGS.ONGOING_SPELLS, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_ONGOING_SPELLS
  });

  game.settings.registerMenu(MODULE_ID, "ongoingSpellsMenu", {
    name: "DWAUTO.Settings.OngoingSpellsMenu.Name",
    label: "DWAUTO.Settings.OngoingSpellsMenu.Label",
    hint: "DWAUTO.Settings.OngoingSpellsMenu.Hint",
    icon: "fas fa-hourglass-half",
    type: OngoingSpellsMenu,
    restricted: true
  });

  // Wizard의 Spell Augmentation("지속 중인 주문을 하나 소모해 그 레벨만큼
  // 데미지 추가")은 위 지속 주문 추적 기능을 그대로 재사용한다
  // (attack-assistant.js 참고).
  game.settings.register(MODULE_ID, SETTINGS.SPELL_AUGMENTATION_MOVE_NAMES, {
    name: "DWAUTO.Settings.SpellAugmentationMoveNames.Name",
    hint: "DWAUTO.Settings.SpellAugmentationMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Spell Augmentation"
  });

  // Cast a Spell 부분성공(7-9)의 3개 선택지 중 "주문 회수"/"다음 기원까지 -1"이
  // 몇 번째인지. 텍스트로 판별하면 번역되었을 때 깨지므로 숫자로 직접 지정한다.
  // 던전월드 기본 클레릭/위저드 문구 기준 순서는 1=원치 않는 주목, 2=-1 페널티,
  // 3=주문 회수 이며, 0으로 두면 해당 효과를 적용하지 않는다.
  game.settings.register(MODULE_ID, SETTINGS.CAST_PARTIAL_REVOKE_INDEX, {
    name: "DWAUTO.Settings.CastPartialRevokeIndex.Name",
    hint: "DWAUTO.Settings.CastPartialRevokeIndex.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 3
  });

  game.settings.register(MODULE_ID, SETTINGS.CAST_PARTIAL_PENALTY_INDEX, {
    name: "DWAUTO.Settings.CastPartialPenaltyIndex.Name",
    hint: "DWAUTO.Settings.CastPartialPenaltyIndex.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 2
  });

  // Fighter Armor Mastery/Armored Perfection, Paladin Bloody Aegis처럼 "피해를
  // 입기 직전에 그 피해를 무효화하는 대신 대가를 치르는" 무브들. preUpdateActor
  // 훅으로 HP 감소를 가로채서 물어보고, 승낙하면 장갑을 낮추거나(armor) 약화를
  // 하나 선택하게(debility) 한다. 자세한 설계는 features/hit-trigger.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_HIT_TRIGGER_ASSISTANT, {
    name: "DWAUTO.Settings.EnableHitTriggerAssistant.Name",
    hint: "DWAUTO.Settings.EnableHitTriggerAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.HIT_TRIGGER_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_HIT_TRIGGER_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "hitTriggerMovesMenu", {
    name: "DWAUTO.Settings.HitTriggerMovesMenu.Name",
    label: "DWAUTO.Settings.HitTriggerMovesMenu.Label",
    hint: "DWAUTO.Settings.HitTriggerMovesMenu.Hint",
    icon: "fas fa-shield-halved",
    type: HitTriggerMovesMenu,
    restricted: true
  });

  // Paladin Indomitable: 약화를 새로 얻으면(피의 보루로 얻은 경우 포함, 원인
  // 불문) +1 forward를 받는다. 위의 무효화 테이블과 달리 선택지가 없는
  // 단순 반응형 무브라 근접/사격 무브 이름 설정과 같은 쉼표 목록으로 관리한다.
  game.settings.register(MODULE_ID, SETTINGS.INDOMITABLE_MOVE_NAMES, {
    name: "DWAUTO.Settings.IndomitableMoveNames.Name",
    hint: "DWAUTO.Settings.IndomitableMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Indomitable"
  });

  // 치유 자동화: Lay On Hands, Cure Light/Moderate/Critical Wounds, Heal 등
  // 치유를 발동시키는 무브/주문을 이름·치유량 공식으로 관리한다. 자세한 설계는
  // features/healing.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_HEALING_ASSISTANT, {
    name: "DWAUTO.Settings.EnableHealingAssistant.Name",
    hint: "DWAUTO.Settings.EnableHealingAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.HEALING_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_HEALING_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "healingMovesMenu", {
    name: "DWAUTO.Settings.HealingMovesMenu.Name",
    label: "DWAUTO.Settings.HealingMovesMenu.Label",
    hint: "DWAUTO.Settings.HealingMovesMenu.Hint",
    icon: "fas fa-heart",
    type: HealingMovesMenu,
    restricted: true
  });

  game.settings.register(MODULE_ID, SETTINGS.HOSPITALLER_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_HOSPITALLER_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "hospitallerMovesMenu", {
    name: "DWAUTO.Settings.HospitallerMovesMenu.Name",
    label: "DWAUTO.Settings.HospitallerMovesMenu.Label",
    hint: "DWAUTO.Settings.HospitallerMovesMenu.Hint",
    icon: "fas fa-hand-holding-heart",
    type: HospitallerMovesMenu,
    restricted: true
  });

  // 공격 주문 자동 피해 굴림: 자세한 설계는 features/spell-damage.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SPELL_DAMAGE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableSpellDamageAssistant.Name",
    hint: "DWAUTO.Settings.EnableSpellDamageAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.SPELL_DAMAGE_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_SPELL_DAMAGE_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "spellDamageMovesMenu", {
    name: "DWAUTO.Settings.SpellDamageMovesMenu.Name",
    label: "DWAUTO.Settings.SpellDamageMovesMenu.Label",
    hint: "DWAUTO.Settings.SpellDamageMovesMenu.Hint",
    icon: "fas fa-burst",
    type: SpellDamageMovesMenu,
    restricted: true
  });

  // 야만전사 고급액션 주도권: 자세한 설계는 features/upper-hand.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_UPPER_HAND_ASSISTANT, {
    name: "DWAUTO.Settings.EnableUpperHandAssistant.Name",
    hint: "DWAUTO.Settings.EnableUpperHandAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.UPPER_HAND_MOVE_NAMES, {
    name: "DWAUTO.Settings.UpperHandMoveNames.Name",
    hint: "DWAUTO.Settings.UpperHandMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "The Upper Hand"
  });

  // 야만전사 고급액션 뭘 기다리는 거야?: 자세한 설계는
  // features/what-are-you-waiting-for.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_WHAT_ARE_YOU_WAITING_FOR_ASSISTANT, {
    name: "DWAUTO.Settings.EnableWhatAreYouWaitingForAssistant.Name",
    hint: "DWAUTO.Settings.EnableWhatAreYouWaitingForAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.WHAT_ARE_YOU_WAITING_FOR_MOVE_NAMES, {
    name: "DWAUTO.Settings.WhatAreYouWaitingForMoveNames.Name",
    hint: "DWAUTO.Settings.WhatAreYouWaitingForMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "What Are You Waiting For?"
  });

  // 야만전사 고급액션 헤라클레스의 욕망: 자세한 설계는
  // features/herculean-appetites.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_HERCULEAN_APPETITES_ASSISTANT, {
    name: "DWAUTO.Settings.EnableHerculeanAppetitesAssistant.Name",
    hint: "DWAUTO.Settings.EnableHerculeanAppetitesAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.HERCULEAN_APPETITES_MOVE_NAMES, {
    name: "DWAUTO.Settings.HerculeanAppetitesMoveNames.Name",
    hint: "DWAUTO.Settings.HerculeanAppetitesMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Herculean Appetites"
  });

  // 야만전사 무브 재빠른 몸놀림: 자세한 설계는 features/on-the-move.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_ON_THE_MOVE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableOnTheMoveAssistant.Name",
    hint: "DWAUTO.Settings.EnableOnTheMoveAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.ON_THE_MOVE_MOVE_NAMES, {
    name: "DWAUTO.Settings.OnTheMoveMoveNames.Name",
    hint: "DWAUTO.Settings.OnTheMoveMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "On The Move"
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFY_DANGER_MOVE_NAMES, {
    name: "DWAUTO.Settings.DefyDangerMoveNames.Name",
    hint: "DWAUTO.Settings.DefyDangerMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Defy Danger"
  });

  // 야만전사 무브 너에 대한 내 사랑은 트럭 같아: 자세한 설계는
  // features/love-truck.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_LOVE_TRUCK_ASSISTANT, {
    name: "DWAUTO.Settings.EnableLoveTruckAssistant.Name",
    hint: "DWAUTO.Settings.EnableLoveTruckAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.LOVE_TRUCK_MOVE_NAMES, {
    name: "DWAUTO.Settings.LoveTruckMoveNames.Name",
    hint: "DWAUTO.Settings.LoveTruckMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "My Love For You Is Like A Truck"
  });

  // 야만전사 무브 약점을 보는 눈: 자세한 설계는 features/eye-for-weakness.js
  // 참고. 협상 판정 이름은 PARLEY_MOVE_NAMES, 상황 파악 판정 이름은
  // DISCERN_REALITIES_MOVE_NAMES를 그대로 재사용한다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_EYE_FOR_WEAKNESS_ASSISTANT, {
    name: "DWAUTO.Settings.EnableEyeForWeaknessAssistant.Name",
    hint: "DWAUTO.Settings.EnableEyeForWeaknessAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.EYE_FOR_WEAKNESS_MOVE_NAMES, {
    name: "DWAUTO.Settings.EyeForWeaknessMoveNames.Name",
    hint: "DWAUTO.Settings.EyeForWeaknessMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Eye for Weakness"
  });

  // 팔라딘 무브 돌격: 자세한 설계는 features/charge.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_CHARGE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableChargeAssistant.Name",
    hint: "DWAUTO.Settings.EnableChargeAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.CHARGE_MOVE_NAMES, {
    name: "DWAUTO.Settings.ChargeMoveNames.Name",
    hint: "DWAUTO.Settings.ChargeMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Charge!"
  });

  // 팔라딘 무브 연계 공격: 자세한 설계는 features/setup-strike.js 참고.
  // 근접 무브 이름은 MELEE_MOVE_NAMES를 그대로 재사용한다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SETUP_STRIKE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableSetupStrikeAssistant.Name",
    hint: "DWAUTO.Settings.EnableSetupStrikeAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.SETUP_STRIKE_MOVE_NAMES, {
    name: "DWAUTO.Settings.SetupStrikeMoveNames.Name",
    hint: "DWAUTO.Settings.SetupStrikeMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Setup Strike"
  });

  // 팔라딘 무브 협공: 자세한 설계는 features/tandem-strike.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_TANDEM_STRIKE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableTandemStrikeAssistant.Name",
    hint: "DWAUTO.Settings.EnableTandemStrikeAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.TANDEM_STRIKE_MOVE_NAMES, {
    name: "DWAUTO.Settings.TandemStrikeMoveNames.Name",
    hint: "DWAUTO.Settings.TandemStrikeMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Tandem Strike"
  });

  // 팔라딘 무브 견고한 방어/무적의 방어: 방어(Defend) 자동화를 강화하는
  // 보조 무브라 별도 사용 스위치 없이 ENABLE_DEFEND_ASSISTANT 하나로 같이
  // 켜고 끈다. 자세한 설계는 features/defend.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.STAUNCH_DEFENDER_MOVE_NAMES, {
    name: "DWAUTO.Settings.StaunchDefenderMoveNames.Name",
    hint: "DWAUTO.Settings.StaunchDefenderMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Staunch Defender"
  });

  game.settings.register(MODULE_ID, SETTINGS.IMPERVIOUS_DEFENDER_MOVE_NAMES, {
    name: "DWAUTO.Settings.ImperviousDefenderMoveNames.Name",
    hint: "DWAUTO.Settings.ImperviousDefenderMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Impervious Defender"
  });

  // 팔라딘 무브 끝없는 전진: 자세한 설계는 features/ever-onward.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_EVER_ONWARD_ASSISTANT, {
    name: "DWAUTO.Settings.EnableEverOnwardAssistant.Name",
    hint: "DWAUTO.Settings.EnableEverOnwardAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.EVER_ONWARD_MOVE_NAMES, {
    name: "DWAUTO.Settings.EverOnwardMoveNames.Name",
    hint: "DWAUTO.Settings.EverOnwardMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Ever Onward"
  });

  // 예배(Commune)를 가진 액터의 주문 탭에 "현재 레벨 사제 주문 모두 얻기"
  // 버튼을 추가한다: 자세한 설계는 features/cleric-spell-grant.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_CLERIC_SPELL_GRANT_ASSISTANT, {
    name: "DWAUTO.Settings.EnableClericSpellGrantAssistant.Name",
    hint: "DWAUTO.Settings.EnableClericSpellGrantAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // 위저드 무브 지식의 샘: 자세한 설계는 features/fount-of-knowledge.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_FOUNT_OF_KNOWLEDGE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableFountOfKnowledgeAssistant.Name",
    hint: "DWAUTO.Settings.EnableFountOfKnowledgeAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.FOUNT_OF_KNOWLEDGE_MOVE_NAMES, {
    name: "DWAUTO.Settings.FountOfKnowledgeMoveNames.Name",
    hint: "DWAUTO.Settings.FountOfKnowledgeMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Fount of Knowledge"
  });

  game.settings.register(MODULE_ID, SETTINGS.SPOUT_LORE_MOVE_NAMES, {
    name: "DWAUTO.Settings.SpoutLoreMoveNames.Name",
    hint: "DWAUTO.Settings.SpoutLoreMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Spout Lore"
  });

  // 위저드 무브 논리적/매우 논리적: 자세한 설계는 features/logical.js 참고.
  // 상황 파악 무브 이름은 DISCERN_REALITIES_MOVE_NAMES를 그대로 재사용한다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_LOGICAL_ASSISTANT, {
    name: "DWAUTO.Settings.EnableLogicalAssistant.Name",
    hint: "DWAUTO.Settings.EnableLogicalAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.LOGICAL_MOVE_NAMES, {
    name: "DWAUTO.Settings.LogicalMoveNames.Name",
    hint: "DWAUTO.Settings.LogicalMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Logical"
  });

  game.settings.register(MODULE_ID, SETTINGS.HIGHLY_LOGICAL_MOVE_NAMES, {
    name: "DWAUTO.Settings.HighlyLogicalMoveNames.Name",
    hint: "DWAUTO.Settings.HighlyLogicalMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Highly Logical"
  });

  // 주문 레벨 안전장치: 자세한 설계는 features/spell-level-guard.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SPELL_LEVEL_GUARD, {
    name: "DWAUTO.Settings.EnableSpellLevelGuard.Name",
    hint: "DWAUTO.Settings.EnableSpellLevelGuard.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // 바드 무브 쇳소리: 자세한 설계는 features/metal-hurlant.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_METAL_HURLANT_ASSISTANT, {
    name: "DWAUTO.Settings.EnableMetalHurlantAssistant.Name",
    hint: "DWAUTO.Settings.EnableMetalHurlantAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.METAL_HURLANT_MOVE_NAMES, {
    name: "DWAUTO.Settings.MetalHurlantMoveNames.Name",
    hint: "DWAUTO.Settings.MetalHurlantMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Metal Hurlant"
  });

  // 바드 무브 이계의 음률/치유의 노래/날카로운 불협화음: 마법의 곡조(Arcane
  // Art)의 효과를 강화하는 보조 무브라 별도 사용 스위치 없이
  // ENABLE_ARCANE_ART_ASSISTANT 하나로 같이 켜고 끈다. 자세한 설계는
  // features/arcane-art.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ELDRITCH_TONES_MOVE_NAMES, {
    name: "DWAUTO.Settings.EldritchTonesMoveNames.Name",
    hint: "DWAUTO.Settings.EldritchTonesMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Eldritch Tones"
  });

  game.settings.register(MODULE_ID, SETTINGS.HEALING_SONG_MOVE_NAMES, {
    name: "DWAUTO.Settings.HealingSongMoveNames.Name",
    hint: "DWAUTO.Settings.HealingSongMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Healing Song"
  });

  game.settings.register(MODULE_ID, SETTINGS.VICIOUS_CACOPHONY_MOVE_NAMES, {
    name: "DWAUTO.Settings.ViciousCacophonyMoveNames.Name",
    hint: "DWAUTO.Settings.ViciousCacophonyMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Vicious Cacophony"
  });

  // 바드 무브 결투사의 호신술: 자세한 설계는 features/duelist-parry.js 참고.
  // 근접 무브 이름은 MELEE_MOVE_NAMES를 그대로 재사용한다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_DUELIST_PARRY_ASSISTANT, {
    name: "DWAUTO.Settings.EnableDuelistParryAssistant.Name",
    hint: "DWAUTO.Settings.EnableDuelistParryAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DUELIST_PARRY_MOVE_NAMES, {
    name: "DWAUTO.Settings.DuelistParryMoveNames.Name",
    hint: "DWAUTO.Settings.DuelistParryMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Duelist’s Parry"
  });

  // 바드 무브 현란한 말솜씨: 자세한 설계는 features/bamboozle.js 참고.
  // 협상 무브 이름은 PARLEY_MOVE_NAMES를 그대로 재사용한다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_BAMBOOZLE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableBamboozleAssistant.Name",
    hint: "DWAUTO.Settings.EnableBamboozleAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.BAMBOOZLE_MOVE_NAMES, {
    name: "DWAUTO.Settings.BamboozleMoveNames.Name",
    hint: "DWAUTO.Settings.BamboozleMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Bamboozle, Con"
  });

  // 바드 무브 이계의 화음/치유의 합창/날카로운 폭발음: 각각 이계의 음률/
  // 치유의 노래/날카로운 불협화음의 6레벨 상위 무브라(무브 업그레이드
  // 자동화가 하위 무브를 대체해서 지운다) 별도 사용 스위치 없이
  // ENABLE_ARCANE_ART_ASSISTANT 하나로 같이 켜고 끈다. 자세한 설계는
  // features/arcane-art.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ELDRITCH_CHORD_MOVE_NAMES, {
    name: "DWAUTO.Settings.EldritchChordMoveNames.Name",
    hint: "DWAUTO.Settings.EldritchChordMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Eldritch Chord"
  });

  game.settings.register(MODULE_ID, SETTINGS.HEALING_CHORUS_MOVE_NAMES, {
    name: "DWAUTO.Settings.HealingChorusMoveNames.Name",
    hint: "DWAUTO.Settings.HealingChorusMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Healing Chorus"
  });

  game.settings.register(MODULE_ID, SETTINGS.VICIOUS_BLAST_MOVE_NAMES, {
    name: "DWAUTO.Settings.ViciousBlastMoveNames.Name",
    hint: "DWAUTO.Settings.ViciousBlastMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Vicious Blast"
  });

  game.settings.register(MODULE_ID, SETTINGS.CHARMING_OPEN_MOVE_NAMES, {
    name: "DWAUTO.Settings.CharmingOpenMoveNames.Name",
    hint: "DWAUTO.Settings.CharmingOpenMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Charming & Open"
  });

  // 바드 무브 교활: 자세한 설계는 features/devious.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_DEVIOUS_ASSISTANT, {
    name: "DWAUTO.Settings.EnableDeviousAssistant.Name",
    hint: "DWAUTO.Settings.EnableDeviousAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DEVIOUS_MOVE_NAMES, {
    name: "DWAUTO.Settings.DeviousMoveNames.Name",
    hint: "DWAUTO.Settings.DeviousMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Devious"
  });

  // 상급 무브를 새로 배우면(예: 치료사의 모범) 같은 액터가 갖고 있는 그 이전
  // 단계 무브(치료사)를 자동으로 삭제한다. 대상 쌍은 던전월드 8개 기본 직업
  // 컴펜디엄의 requiresMove 필드를 전수 조사해서 기본값으로 채워뒀다. 자세한
  // 설계는 features/move-upgrades.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_MOVE_UPGRADE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableMoveUpgradeAssistant.Name",
    hint: "DWAUTO.Settings.EnableMoveUpgradeAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.MOVE_UPGRADES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_MOVE_UPGRADES
  });

  game.settings.registerMenu(MODULE_ID, "moveUpgradesMenu", {
    name: "DWAUTO.Settings.MoveUpgradesMenu.Name",
    label: "DWAUTO.Settings.MoveUpgradesMenu.Label",
    hint: "DWAUTO.Settings.MoveUpgradesMenu.Hint",
    icon: "fas fa-arrow-up-right-dots",
    type: MoveUpgradesMenu,
    restricted: true
  });

  // Thief Underdog/Serious Underdog: "숫적으로 열세일 때 장갑 +N"이라는
  // 조건부 보너스. 숫적 열세 여부를 자동 판정할 수 없어서 피해를 입기
  // 직전에 Y/N으로 물어본다(hit-trigger.js가 담당). 대가 없이 매번 적용되는
  // 조건부 보너스라 위의 "피격 시 무효화 무브" 표와는 별도로 관리한다.
  game.settings.register(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_DAMAGE_REDUCTION_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "damageReductionMovesMenu", {
    name: "DWAUTO.Settings.DamageReductionMovesMenu.Name",
    label: "DWAUTO.Settings.DamageReductionMovesMenu.Label",
    hint: "DWAUTO.Settings.DamageReductionMovesMenu.Hint",
    icon: "fas fa-shield",
    type: DamageReductionMovesMenu,
    restricted: true
  });

  // Paladin Smite/Holy Smite/Exterminatus, Ranger Viper's Strike/Fangs처럼
  // "특정 조건을 만족하면 데미지 주사위를 추가로(또는 페널티로) 굴리는"
  // 무브들. 조건을 자동 판정할 수 없어서 데미지를 굴릴 때마다 Y/N으로
  // 묻는다. 자세한 설계는 features/attack-assistant.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.CONDITIONAL_DAMAGE_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_CONDITIONAL_DAMAGE_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "conditionalDamageMovesMenu", {
    name: "DWAUTO.Settings.ConditionalDamageMovesMenu.Name",
    label: "DWAUTO.Settings.ConditionalDamageMovesMenu.Label",
    hint: "DWAUTO.Settings.ConditionalDamageMovesMenu.Hint",
    icon: "fas fa-dice",
    type: ConditionalDamageMovesMenu,
    restricted: true
  });

  // Ranger Smaug's Belly처럼 "특정 조건을 만족하면 이번 공격에 데미지 태그
  // 원문(예: "2 piercing")을 하나 추가로 붙이는" 무브들. Conditional Damage
  // Moves와 같은 Y/N 질문 패턴이지만, 주사위 공식이 아니라 TAG_CATALOG의
  // "raw" 태그처럼 원문 문자열을 데미지 메시지에 그대로 노출시킨다는 점이
  // 다르다. 자세한 설계는 features/attack-assistant.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.CONDITIONAL_TAG_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_CONDITIONAL_TAG_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "conditionalTagMovesMenu", {
    name: "DWAUTO.Settings.ConditionalTagMovesMenu.Name",
    label: "DWAUTO.Settings.ConditionalTagMovesMenu.Label",
    hint: "DWAUTO.Settings.ConditionalTagMovesMenu.Hint",
    icon: "fas fa-dice",
    type: ConditionalTagMovesMenu,
    restricted: true
  });

  // Fighter Superior Warrior: Hack & Slash에서 12+(극단적 성공)가 나오면
  // 채팅에 별도로 알려준다. 극단적 성공 감지 자체는 Phase 1부터 이미 하고
  // 있었지만(move-card.js의 isExtreme), 이걸 소비하는 무브가 없어서 지금까지
  // 채팅 알림으로 연결되지 않았다.
  game.settings.register(MODULE_ID, SETTINGS.SUPERIOR_WARRIOR_MOVE_NAMES, {
    name: "DWAUTO.Settings.SuperiorWarriorMoveNames.Name",
    hint: "DWAUTO.Settings.SuperiorWarriorMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Superior Warrior"
  });

  // 바바리안 Smash!: "Hack & Slash에서 12+가 뜨면 데미지를 주고, 상대가 가진
  // 물리적인 것 하나를 골라 잃게 한다." 데미지 자체는 이미 정상적으로
  // 적용되므로, Superior Warrior와 같은 자리에서 "추가 효과를 잊지 말라"는
  // 알림만 남긴다.
  game.settings.register(MODULE_ID, SETTINGS.SMASH_MOVE_NAMES, {
    name: "DWAUTO.Settings.SmashMoveNames.Name",
    hint: "DWAUTO.Settings.SmashMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Smash!"
  });

  // 바바리안 Musclebound: "While you wield a weapon it gains the forceful
  // and messy tags." 무기 자체의 tagsString과 무관하게, 이 무브를 가진
  // 캐릭터가 굴리는 모든 데미지에 forceful/messy 참고 문구를 항상 덧붙인다
  // (attack-assistant.js의 getTagDisplay 참고). forceful/messy는 원래도
  // "참고 문구로만 표시"되는 태그라 무기가 실제로 갖고 있을 때와 완전히
  // 같은 방식으로 노출되며, 데미지 굴림 자체를 바꾸지는 않는다.
  game.settings.register(MODULE_ID, SETTINGS.MUSCLEBOUND_MOVE_NAMES, {
    name: "DWAUTO.Settings.MuscleboundMoveNames.Name",
    hint: "DWAUTO.Settings.MuscleboundMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Musclebound"
  });

  // Druid Balance(조화)/Shapeshifter(변신): 캐릭터 시트에 새 탭(자세한 설계는
  // features/class-info-tab.js, features/druid.js 참고)을 만들어 조화 예비
  // 카운터와 변신 상태를 보여준다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_DRUID_ASSISTANT, {
    name: "DWAUTO.Settings.EnableDruidAssistant.Name",
    hint: "DWAUTO.Settings.EnableDruidAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DRUID_BALANCE_MOVE_NAMES, {
    name: "DWAUTO.Settings.DruidBalanceMoveNames.Name",
    hint: "DWAUTO.Settings.DruidBalanceMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Balance"
  });

  game.settings.register(MODULE_ID, SETTINGS.DRUID_SHAPESHIFTER_MOVE_NAMES, {
    name: "DWAUTO.Settings.DruidShapeshifterMoveNames.Name",
    hint: "DWAUTO.Settings.DruidShapeshifterMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Shapeshifter"
  });

  // 변신에 의존하는 상급 무브들. 전부 "변신 중"이 아니면 자동화 자체가
  // 발동하지 않고, 대신 채팅에 "~가 없어 적용되지 않았음" 문구를 띄운다
  // (Shed/Formcrafter는 예외 — 자세한 이유는 features/druid.js 참고).
  // Red of Tooth and Claw/Blood and Thunder: 변신 중 데미지 주사위 상향.
  game.settings.register(MODULE_ID, SETTINGS.DRUID_DAMAGE_DIE_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_DRUID_DAMAGE_DIE_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "druidDamageDieMovesMenu", {
    name: "DWAUTO.Settings.DruidDamageDieMovesMenu.Name",
    label: "DWAUTO.Settings.DruidDamageDieMovesMenu.Label",
    hint: "DWAUTO.Settings.DruidDamageDieMovesMenu.Hint",
    icon: "fas fa-paw",
    type: DruidDamageDieMovesMenu,
    restricted: true
  });

  // Shed: 변신 중 피해를 입으면 변신을 풀어 그 피해를 무효화할 수 있다.
  game.settings.register(MODULE_ID, SETTINGS.DRUID_SHED_MOVE_NAMES, {
    name: "DWAUTO.Settings.DruidShedMoveNames.Name",
    hint: "DWAUTO.Settings.DruidShedMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Shed"
  });

  // Formcrafter: 변신할 때 능력치 하나를 골라 +1 온고잉, 마스터가 고른
  // 능력치 하나에 -1 온고잉(둘 다 변신 중에만 적용).
  game.settings.register(MODULE_ID, SETTINGS.DRUID_FORMCRAFTER_MOVE_NAMES, {
    name: "DWAUTO.Settings.DruidFormcrafterMoveNames.Name",
    hint: "DWAUTO.Settings.DruidFormcrafterMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Formcrafter"
  });

  // Formshaper: 변신할 때 장갑+1 또는 피해+1d4 중 하나를 선택.
  game.settings.register(MODULE_ID, SETTINGS.DRUID_FORMSHAPER_MOVE_NAMES, {
    name: "DWAUTO.Settings.DruidFormshaperMoveNames.Name",
    hint: "DWAUTO.Settings.DruidFormshaperMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Formshaper"
  });

  // Cleric Deity/Apotheosis, Druid Born of the Soil, Ranger Animal Companion
  // 처럼 이름/영역/증표 같은 걸 자유롭게 정해서 기록해두는 무브들. 자세한
  // 설계는 features/note-moves.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_NOTE_MOVES, {
    name: "DWAUTO.Settings.EnableNoteMoves.Name",
    hint: "DWAUTO.Settings.EnableNoteMoves.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES, {
    scope: "world",
    config: false,
    type: String,
    default: DEFAULT_NOTE_MOVE_NAMES.join(", ")
  });

  game.settings.registerMenu(MODULE_ID, "noteMovesMenu", {
    name: "DWAUTO.Settings.NoteMovesMenu.Name",
    label: "DWAUTO.Settings.NoteMovesMenu.Label",
    hint: "DWAUTO.Settings.NoteMovesMenu.Hint",
    icon: "fas fa-feather-pointed",
    type: NoteMovesMenu,
    restricted: true
  });

  // v0.24.0부터 대지의 아들/딸은 별도 기능이 아니라 "메모형 무브 이름"
  // 목록의 한 항목일 뿐이다(features/note-moves.js 참고 — 이제 모든 메모형
  // 무브가 발동해야 탭이 생기는 같은 방식으로 동작한다). 이 설정 자체는
  // 예전 세계의 값을 한 번 읽어 위 목록에 병합하는 마이그레이션에서만
  // 쓰이므로 등록은 유지하되 설정 화면에는 더 이상 노출하지 않는다.
  game.settings.register(MODULE_ID, SETTINGS.BORN_OF_THE_SOIL_MOVE_NAMES, {
    scope: "world",
    config: false,
    type: String,
    default: "Born of the Soil"
  });

  // 장갑(AC) 재계산 버튼: 캐릭터 시트의 '장갑' 라벨을 '피해'처럼 클릭 가능한
  // 버튼으로 바꿔서, 누르면 지금 장착 중인 방어구의 장갑 태그 합 + 변신 중
  // Formshaper 장갑 선택 같은 '현재 활성 보정'을 더해 장갑 값을 덮어쓴다.
  // 마우스를 올리면 그 계산에 들어가는 항목을 미리 보여준다. 자세한 설계는
  // features/armor-assistant.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_ARMOR_ASSISTANT, {
    name: "DWAUTO.Settings.EnableArmorAssistant.Name",
    hint: "DWAUTO.Settings.EnableArmorAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // "다른 직업의 액션을 얻는 액션": 팔라딘 Divine Favor/레인저 God Amidst The
  // Wastes처럼 발동하면 다른 직업의 특정 무브(들)를 그대로 부여받는 무브.
  // 자세한 설계는 features/class-grant.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_CLASS_GRANT_ASSISTANT, {
    name: "DWAUTO.Settings.EnableClassGrantAssistant.Name",
    hint: "DWAUTO.Settings.EnableClassGrantAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.CLASS_GRANT_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_CLASS_GRANT_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "classGrantMovesMenu", {
    name: "DWAUTO.Settings.ClassGrantMovesMenu.Name",
    label: "DWAUTO.Settings.ClassGrantMovesMenu.Label",
    hint: "DWAUTO.Settings.ClassGrantMovesMenu.Hint",
    icon: "fas fa-people-arrows",
    type: ClassGrantMovesMenu,
    restricted: true
  });

  // 위저드 Prepare Spells/클레릭 Commune: "명상/기원하면 준비된 주문을 전부
  // 잃고 새로 고른다"는 무브. 자세한 설계는 features/spell-preparation.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SPELL_PREPARATION_ASSISTANT, {
    name: "DWAUTO.Settings.EnableSpellPreparationAssistant.Name",
    hint: "DWAUTO.Settings.EnableSpellPreparationAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.PREPARE_SPELLS_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_PREPARE_SPELLS_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "prepareSpellsMovesMenu", {
    name: "DWAUTO.Settings.PrepareSpellsMovesMenu.Name",
    label: "DWAUTO.Settings.PrepareSpellsMovesMenu.Label",
    hint: "DWAUTO.Settings.PrepareSpellsMovesMenu.Hint",
    icon: "fas fa-book-sparkles",
    type: PrepareSpellsMovesMenu,
    restricted: true
  });

  // 위저드 천재(Prodigy)/대가(Master): 주문 하나(대가는 하나 더)를 골라, 그
  // 주문을 준비할 때 한 레벨 낮은 것처럼 취급한다. 자세한 설계는
  // features/spell-discount.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SPELL_DISCOUNT_ASSISTANT, {
    name: "DWAUTO.Settings.EnableSpellDiscountAssistant.Name",
    hint: "DWAUTO.Settings.EnableSpellDiscountAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DISCOUNT_SPELL_MOVE_NAMES, {
    name: "DWAUTO.Settings.DiscountSpellMoveNames.Name",
    hint: "DWAUTO.Settings.DiscountSpellMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    // 클레릭 선택받은 자(Chosen One)/성유 받은 자(Anointed) 원문이 위저드
    // 천재/대가와 완전히 같다("주문 하나를 골라 한 레벨 낮은 것처럼 받는다") —
    // 같은 자동화(features/spell-discount.js)를 그대로 쓴다.
    default: "Prodigy, Master, Chosen One, Anointed"
  });

  // 위저드 증보(Expanded Spellbook): 다른 어떤 직업의 주문 목록에서든 새
  // 주문 하나를 스펠북에 추가한다. 자세한 설계는 features/spellbook-expansion.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SPELLBOOK_EXPANSION_ASSISTANT, {
    name: "DWAUTO.Settings.EnableSpellbookExpansionAssistant.Name",
    hint: "DWAUTO.Settings.EnableSpellbookExpansionAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.EXPANDED_SPELLBOOK_MOVE_NAMES, {
    name: "DWAUTO.Settings.ExpandedSpellbookMoveNames.Name",
    hint: "DWAUTO.Settings.ExpandedSpellbookMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Expanded Spellbook"
  });

  // 위저드 주문 차단(Counterspell)/마법 차폐(Protective Counter): 준비된 주문
  // 하나를 걸고 굴리는데, 이 시스템 컴펜디엄 데이터에는 rollType이 비어있어
  // 시스템 자체의 굴림 경로를 탈 수 없다(직접 확인됨). 그래서 이 모듈이 직접
  // 2d6+INT을 굴려 결과를 판정한다. 자세한 설계는 features/counterspell.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_COUNTERSPELL_ASSISTANT, {
    name: "DWAUTO.Settings.EnableCounterspellAssistant.Name",
    hint: "DWAUTO.Settings.EnableCounterspellAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.COUNTERSPELL_MOVE_NAMES, {
    name: "DWAUTO.Settings.CounterspellMoveNames.Name",
    hint: "DWAUTO.Settings.CounterspellMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Counterspell, Protective Counter"
  });

  // 클레릭 평온(Serenity)/섭리(Providence): 주문 시전 시 지속 주문으로 인한
  // 페널티 합계에서 일정량을 항상 깎아준다. 자세한 설계는
  // lib/ongoing-spells-state.js의 computeCastPenalty 참고. features/spellcasting.js가
  // 이미 ENABLE_SPELLCASTING_ASSISTANT로 켜고 끄는 계산 경로 안에 들어가므로
  // 별도의 켬/끔 설정은 두지 않는다.
  game.settings.register(MODULE_ID, SETTINGS.ONGOING_PENALTY_REDUCTION_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_ONGOING_PENALTY_REDUCTION_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "ongoingPenaltyReductionMovesMenu", {
    name: "DWAUTO.Settings.OngoingPenaltyReductionMovesMenu.Name",
    label: "DWAUTO.Settings.OngoingPenaltyReductionMovesMenu.Label",
    hint: "DWAUTO.Settings.OngoingPenaltyReductionMovesMenu.Hint",
    icon: "fas fa-shield-heart",
    type: OngoingPenaltyReductionMovesMenu,
    restricted: true
  });

  // 위저드 주문 강화/상급 주문 강화, 클레릭 강화/상급 강화: 주문 시전 10+
  // 성공 시 추가 강화 효과를 선택적으로 적용한다. 자세한 설계는
  // features/spellcasting.js의 promptEmpowerFlow 참고. features/spellcasting.js가
  // 이미 ENABLE_SPELLCASTING_ASSISTANT로 켜고 끄는 흐름 안에 들어가므로
  // 별도의 켬/끔 설정은 두지 않는다.
  game.settings.register(MODULE_ID, SETTINGS.EMPOWER_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_EMPOWER_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "empowerMovesMenu", {
    name: "DWAUTO.Settings.EmpowerMovesMenu.Name",
    label: "DWAUTO.Settings.EmpowerMovesMenu.Label",
    hint: "DWAUTO.Settings.EmpowerMovesMenu.Hint",
    icon: "fas fa-wand-sparkles",
    type: EmpowerMovesMenu,
    restricted: true
  });

  // 클레릭 신의 개입(Divine Intervention)/신의 불멸(Divine Invincibility):
  // 기원(Commune)할 때 hold를 얻고(이전 hold는 소멸), 피격 시 hold를 써서
  // 피해를 완전 무효화한다. "얻는" 쪽은 이 표(features/spell-preparation.js가
  // 참조), "쓰는" 쪽은 HIT_TRIGGER_MOVES 표에 effect:"hold"로 등록한다.
  game.settings.register(MODULE_ID, SETTINGS.HOLD_GRANT_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_HOLD_GRANT_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "holdGrantMovesMenu", {
    name: "DWAUTO.Settings.HoldGrantMovesMenu.Name",
    label: "DWAUTO.Settings.HoldGrantMovesMenu.Label",
    hint: "DWAUTO.Settings.HoldGrantMovesMenu.Hint",
    icon: "fas fa-hand-holding-hand",
    type: HoldGrantMovesMenu,
    restricted: true
  });

  // 레인저 명령(Command): 동물 친구와 협력 중일 때 그 능력치(사나움/교활함/
  // 장갑)를 공격/추적·상황파악·협상/장갑에 더한다. "지금 정말 협력 중인지"는
  // 자동 감지할 수 없어서 캐릭터 시트의 수동 토글로 관리한다(features/command.js).
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_COMMAND_ASSISTANT, {
    name: "DWAUTO.Settings.EnableCommandAssistant.Name",
    hint: "DWAUTO.Settings.EnableCommandAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.COMMAND_MOVE_NAMES, {
    name: "DWAUTO.Settings.CommandMoveNames.Name",
    hint: "DWAUTO.Settings.CommandMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Command"
  });

  game.settings.register(MODULE_ID, SETTINGS.COMMAND_CUNNING_MOVE_NAMES, {
    name: "DWAUTO.Settings.CommandCunningMoveNames.Name",
    hint: "DWAUTO.Settings.CommandCunningMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Hunt & Track, Discern Realities, Parley"
  });

  // 재주꾼(Well-trained): "동물 친구에게 훈련 특성을 하나 추가하십시오."
  // 동물 친구 자신의 설명에서 훈련 특성 목록을 그대로 뽑아 쓰므로 별도
  // 목록 설정은 없다(features/well-trained.js 참고).
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_WELL_TRAINED_ASSISTANT, {
    name: "DWAUTO.Settings.EnableWellTrainedAssistant.Name",
    hint: "DWAUTO.Settings.EnableWellTrainedAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.WELL_TRAINED_MOVE_NAMES, {
    name: "DWAUTO.Settings.WellTrainedMoveNames.Name",
    hint: "DWAUTO.Settings.WellTrainedMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Well-trained"
  });

  // 레인저 Unnatural Ally(고급 무브): "동물 친구가 동물이 아니라 괴물입니다.
  // 사나움 +2, 본능 +1을 주고, 새 훈련 특성을 하나 추가하세요." 재주꾼과 같은
  // 방식으로 훈련 특성 목록을 재사용하고, 능력치 보너스는 note-moves.js가
  // 관리하는 동반 동물 기본 능력치 값에 직접 더한다(features/unnatural-ally.js
  // 참고). 별도 목록 설정은 없다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_UNNATURAL_ALLY_ASSISTANT, {
    name: "DWAUTO.Settings.EnableUnnaturalAllyAssistant.Name",
    hint: "DWAUTO.Settings.EnableUnnaturalAllyAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.UNNATURAL_ALLY_MOVE_NAMES, {
    name: "DWAUTO.Settings.UnnaturalAllyMoveNames.Name",
    hint: "DWAUTO.Settings.UnnaturalAllyMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Unnatural Ally"
  });

  // 원조/방해(Aid or Interfere, 던전월드 기본 무브): 성공(10+) 시 대상에게
  // +1 또는 -2를 "다음 판정 한 번" 자동으로 걸어준다(lib/roll-bonus-state.js
  // + lib/roll-wrapper.js 연동).
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_AID_OR_INTERFERE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableAidOrInterfereAssistant.Name",
    hint: "DWAUTO.Settings.EnableAidOrInterfereAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.AID_OR_INTERFERE_MOVE_NAMES, {
    name: "DWAUTO.Settings.AidOrInterfereMoveNames.Name",
    hint: "DWAUTO.Settings.AidOrInterfereMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Aid or Interfere"
  });

  // 바드 마법의 곡조(Arcane Art): 성공 시 아군 한 명 + 효과 하나(치유/다음
  // 피해 보너스/마법 해제/다음 원조 강화)를 고른다. 어느 효과가 몇 번째
  // 선택지인지는 텍스트로 판별하면 번역에 깨지므로(Cast a Spell 부분성공과
  // 같은 이유) 숫자로 지정한다. 던전월드 기본 문구 순서는 1=치유, 2=다음
  // 피해 보너스, 3=마법 해제, 4=다음 원조 강화.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_ARCANE_ART_ASSISTANT, {
    name: "DWAUTO.Settings.EnableArcaneArtAssistant.Name",
    hint: "DWAUTO.Settings.EnableArcaneArtAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.ARCANE_ART_MOVE_NAMES, {
    name: "DWAUTO.Settings.ArcaneArtMoveNames.Name",
    hint: "DWAUTO.Settings.ArcaneArtMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Arcane Art"
  });

  game.settings.register(MODULE_ID, SETTINGS.ARCANE_ART_HEAL_INDEX, {
    name: "DWAUTO.Settings.ArcaneArtHealIndex.Name",
    hint: "DWAUTO.Settings.ArcaneArtHealIndex.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 1
  });

  game.settings.register(MODULE_ID, SETTINGS.ARCANE_ART_DAMAGE_FORWARD_INDEX, {
    name: "DWAUTO.Settings.ArcaneArtDamageForwardIndex.Name",
    hint: "DWAUTO.Settings.ArcaneArtDamageForwardIndex.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 2
  });

  game.settings.register(MODULE_ID, SETTINGS.ARCANE_ART_CLEAR_ENCHANTMENT_INDEX, {
    name: "DWAUTO.Settings.ArcaneArtClearEnchantmentIndex.Name",
    hint: "DWAUTO.Settings.ArcaneArtClearEnchantmentIndex.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 3
  });

  game.settings.register(MODULE_ID, SETTINGS.ARCANE_ART_ENHANCE_AID_INDEX, {
    name: "DWAUTO.Settings.ArcaneArtEnhanceAidIndex.Name",
    hint: "DWAUTO.Settings.ArcaneArtEnhanceAidIndex.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 4
  });

  // Reaper(클레릭)/Quick Study(위저드)/An Ear For Magic(바드)/My Love For You
  // Is Like A Truck(바바리안)처럼 "판정 없이 특정 상황이 벌어지면 자기
  // 자신에게 +1 forward"인 무브들을 이름·무브 제한(선택) 표로 관리한다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SELF_FORWARD_ASSISTANT, {
    name: "DWAUTO.Settings.EnableSelfForwardAssistant.Name",
    hint: "DWAUTO.Settings.EnableSelfForwardAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.SELF_FORWARD_MOVES, {
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_SELF_FORWARD_MOVES
  });

  game.settings.registerMenu(MODULE_ID, "selfForwardMovesMenu", {
    name: "DWAUTO.Settings.SelfForwardMovesMenu.Name",
    label: "DWAUTO.Settings.SelfForwardMovesMenu.Label",
    hint: "DWAUTO.Settings.SelfForwardMovesMenu.Hint",
    icon: "fas fa-arrow-up-right-from-square",
    type: SelfForwardMovesMenu,
    restricted: true
  });

  // 바바리안 죽기 좋은 날(A Good Day To Die): 현재 HP가 CON 미만(또는 1,
  // 둘 중 큰 쪽)인 동안 모든 판정에 +1 ongoing. HP/CON은 액터 데이터에서
  // 바로 읽을 수 있어 수동 토글 없이 매 판정마다 자동으로 계산한다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_BARBARIAN_ASSISTANT, {
    name: "DWAUTO.Settings.EnableBarbarianAssistant.Name",
    hint: "DWAUTO.Settings.EnableBarbarianAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.GOOD_DAY_TO_DIE_MOVE_NAMES, {
    name: "DWAUTO.Settings.GoodDayToDieMoveNames.Name",
    hint: "DWAUTO.Settings.GoodDayToDieMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "A Good Day To Die"
  });

  // 바바리안 삼손(Samson): 약화를 하나 받고 즉시 구속에서 벗어난다. 판정이
  // 없는 자기 발동형 액션이라 무브를 클릭하면 바로 약화 선택 대화상자를
  // 띄운다. 위 EnableBarbarianAssistant 토글을 함께 쓴다(바바리안 무브
  // 전체의 공용 켜기/끄기).
  game.settings.register(MODULE_ID, SETTINGS.SAMSON_MOVE_NAMES, {
    name: "DWAUTO.Settings.SamsonMoveNames.Name",
    hint: "DWAUTO.Settings.SamsonMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Samson"
  });

  // 클레릭 소생(Invigorate): 남을 치유하면 대상이 다음 피해에 +2 forward.
  // features/healing.js의 applyHealAmount(모든 치유가 거쳐가는 공용 지점)에
  // 이미 연결되어 있다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_INVIGORATE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableInvigorateAssistant.Name",
    hint: "DWAUTO.Settings.EnableInvigorateAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.INVIGORATE_MOVE_NAMES, {
    name: "DWAUTO.Settings.InvigorateMoveNames.Name",
    hint: "DWAUTO.Settings.InvigorateMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Invigorate"
  });

  // 바드 친구여 고맙소(A Little Help From My Friends): 원조/방해에서 원조
  // (+1)를 성공시키면 자기 자신도 다음 판정에 +1 forward를 받는다.
  // features/aid-or-interfere.js가 원조 판정 결과를 처리할 때 이미
  // 연결되어 있다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_LITTLE_HELP_ASSISTANT, {
    name: "DWAUTO.Settings.EnableLittleHelpAssistant.Name",
    hint: "DWAUTO.Settings.EnableLittleHelpAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.LITTLE_HELP_MOVE_NAMES, {
    name: "DWAUTO.Settings.LittleHelpMoveNames.Name",
    hint: "DWAUTO.Settings.LittleHelpMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "A Little Help From My Friends"
  });

  // 팔라딘 I Am The Law: roll+CHA. 성공하면 그 NPC를 상대로 +1 forward,
  // 실패하면 -1 forward가 대기 상태로 걸리고, 이후 그 NPC 상대 판정인지
  // 매번 확인받아야 실제로 적용된다(features/i-am-the-law.js 참고).
  // 부분성공은 추가 효과가 없어 안내만 표시한다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_I_AM_THE_LAW_ASSISTANT, {
    name: "DWAUTO.Settings.EnableIAmTheLawAssistant.Name",
    hint: "DWAUTO.Settings.EnableIAmTheLawAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.I_AM_THE_LAW_MOVE_NAMES, {
    name: "DWAUTO.Settings.IAmTheLawMoveNames.Name",
    hint: "DWAUTO.Settings.IAmTheLawMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "I Am The Law"
  });

  // 위저드 Know-It-All: 다른 플레이어의 캐릭터에게 조언을 주면, 그 조언을
  // 따른 판정에 +1 forward를 주고 자신은 XP를 마크한다(features/
  // know-it-all.js 참고). 대상/조언자 둘 다 액터 쓰기 권한이 없을 수 있어
  // 접속 중인 GM에게 승인을 구한다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_KNOW_IT_ALL_ASSISTANT, {
    name: "DWAUTO.Settings.EnableKnowItAllAssistant.Name",
    hint: "DWAUTO.Settings.EnableKnowItAllAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.KNOW_IT_ALL_MOVE_NAMES, {
    name: "DWAUTO.Settings.KnowItAllMoveNames.Name",
    hint: "DWAUTO.Settings.KnowItAllMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Know-It-All"
  });

  // 최대 체력/기본 하중 재계산 버튼: 장갑 재계산과 같은 패턴으로 캐릭터
  // 시트의 '체력'/'무게' 라벨을 클릭 가능한 버튼으로 바꿔서, 누르면 직업별
  // 기본값(data/class-base-stats.js) + 체력(CON)/근력(STR) 점수로 최대 체력/
  // 기본 하중을 계산해 덮어쓴다. 직업이 인식되지 않으면(system.details.class가
  // 비어있거나 알 수 없는 값) 경고만 띄운다. 자세한 설계는 features/
  // vitals-assistant.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_VITALS_ASSISTANT, {
    name: "DWAUTO.Settings.EnableVitalsAssistant.Name",
    hint: "DWAUTO.Settings.EnableVitalsAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // 던전월드 기본 무브 짐(Encumbrance): 판정마다 현재 짐/최대 하중을 비교해서
  // 자동으로 페널티를 반영한다. 하중+1~+2면 조용히 -1(짐을 덜 때까지 계속),
  // +3 이상이면 판정 전에 짐을 버리라고 물어보고 버리지 않으면 판정 자체가
  // 자동으로 6(실패)으로 처리된다. 자세한 설계는 features/encumbrance.js
  // 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_ENCUMBRANCE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableEncumbranceAssistant.Name",
    hint: "DWAUTO.Settings.EnableEncumbranceAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // 던전월드 기본 무브 구인(Recruit): 실패(6-) 결과에서 제시된 지원자를
  // 모두 돌려보내면 다음 구인 판정에 -1 forward를 받는다. 구인은 유대(Bond)
  // rollType이라 rollMod로 자동 반영이 안 되고, 다음 판정 직전에 "유대
  // 입력창에 직접 -1을 입력하라"는 안내만 띄운다. 자세한 설계는 features/
  // recruit.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_RECRUIT_ASSISTANT, {
    name: "DWAUTO.Settings.EnableRecruitAssistant.Name",
    hint: "DWAUTO.Settings.EnableRecruitAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.RECRUIT_MOVE_NAMES, {
    name: "DWAUTO.Settings.RecruitMoveNames.Name",
    hint: "DWAUTO.Settings.RecruitMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Recruit"
  });

  // 던전월드 기본 무브 수련(Bolster): 발동하면 예비(최대 3점)를 얻고,
  // 나중에 판정 하나마다 예비 1점을 써서 +1을 받는다. 예비는 숫자
  // 카운터로 관리하고(시트에서 GM이 실시간 조정 가능), "매 판정마다
  // 물어볼지" 토글은 플레이어/GM 둘 다 조작할 수 있다. 자세한 설계는
  // features/bolster.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_BOLSTER_ASSISTANT, {
    name: "DWAUTO.Settings.EnableBolsterAssistant.Name",
    hint: "DWAUTO.Settings.EnableBolsterAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.BOLSTER_MOVE_NAMES, {
    name: "DWAUTO.Settings.BolsterMoveNames.Name",
    hint: "DWAUTO.Settings.BolsterMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Bolster"
  });

  // 소각술사 핵심 액션 불타는 낙인(Burning Brand): 발동하면 결과 등급에
  // 따라 추가 태그를 고르고(성공 2개/부분성공 1개/실패 0개), fiery/touch/
  // dangerous/3 uses 기본 태그에 반영해서 무기 아이템을 인벤토리에
  // 만들어준다. "N uses" 태그 소모는 attack-assistant.js가 담당한다(근접/
  // 사격 구분 없이 이 무기로 공격할 때마다 1씩 줄어든다). 자세한 설계는
  // features/burning-brand.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_BURNING_BRAND_ASSISTANT, {
    name: "DWAUTO.Settings.EnableBurningBrandAssistant.Name",
    hint: "DWAUTO.Settings.EnableBurningBrandAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.BURNING_BRAND_MOVE_NAMES, {
    name: "DWAUTO.Settings.BurningBrandMoveNames.Name",
    hint: "DWAUTO.Settings.BurningBrandMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Burning Brand"
  });

  // 기본액션 방어(Defend): 발동하면 결과 등급에 따라 예비(hold)를 얻고
  // 보호대상을 고른다. 예비가 남아있는 동안 자신이나 보호대상이 피격당할
  // 때마다 예비를 소모해서 여섯 가지 선택지 중 하나를 고를 수 있다. 자세한
  // 설계는 features/defend.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_DEFEND_ASSISTANT, {
    name: "DWAUTO.Settings.EnableDefendAssistant.Name",
    hint: "DWAUTO.Settings.EnableDefendAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFEND_MOVE_NAMES, {
    name: "DWAUTO.Settings.DefendMoveNames.Name",
    hint: "DWAUTO.Settings.DefendMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Defend"
  });

  // 소각술사 고급액션 곱절로 밝게 타올라/반절로 길게 타올라: 자세한 설계는
  // features/twice-as-bright.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_TWICE_AS_BRIGHT_ASSISTANT, {
    name: "DWAUTO.Settings.EnableTwiceAsBrightAssistant.Name",
    hint: "DWAUTO.Settings.EnableTwiceAsBrightAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.TWICE_AS_BRIGHT_MOVE_NAMES, {
    name: "DWAUTO.Settings.TwiceAsBrightMoveNames.Name",
    hint: "DWAUTO.Settings.TwiceAsBrightMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Burns Twice As Bright"
  });

  game.settings.register(MODULE_ID, SETTINGS.HALF_AS_LONG_MOVE_NAMES, {
    name: "DWAUTO.Settings.HalfAsLongMoveNames.Name",
    hint: "DWAUTO.Settings.HalfAsLongMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Burns Half As Long"
  });

  // 소각술사 고급액션 죽어주는 불꽃(This Killing Fire): 이 무브를 가진 채로
  // 불타는 낙인을 쓰면 선택지에 태그 5개(messy/forceful/reach/near/far)가
  // 추가된다. 자세한 설계는 features/burning-brand.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_THIS_KILLING_FIRE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableThisKillingFireAssistant.Name",
    hint: "DWAUTO.Settings.EnableThisKillingFireAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.THIS_KILLING_FIRE_MOVE_NAMES, {
    name: "DWAUTO.Settings.ThisKillingFireMoveNames.Name",
    hint: "DWAUTO.Settings.ThisKillingFireMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "This Killing Fire"
  });

  // 소각술사 고급액션 사그라지는 인연(Burning Bridges): 자세한 설계는
  // features/burning-bridges.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_BURNING_BRIDGES_ASSISTANT, {
    name: "DWAUTO.Settings.EnableBurningBridgesAssistant.Name",
    hint: "DWAUTO.Settings.EnableBurningBridgesAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.BURNING_BRIDGES_MOVE_NAMES, {
    name: "DWAUTO.Settings.BurningBridgesMoveNames.Name",
    hint: "DWAUTO.Settings.BurningBridgesMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Burning Bridges"
  });

  game.settings.register(MODULE_ID, SETTINGS.LAST_BREATH_MOVE_NAMES, {
    name: "DWAUTO.Settings.LastBreathMoveNames.Name",
    hint: "DWAUTO.Settings.LastBreathMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Last Breath"
  });

  // 소각술사 고급액션(6레벨 이후) 쌍각의 들불: 자세한 설계는
  // features/twin-horn-wildfire.js 참고. "생각의 발신"/"쌍각의 들불" 둘 다
  // 공식 컴펜디엄에서 확인되지 않는 이름이라 기본값을 한국어 원문으로 둔다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_TWIN_HORN_WILDFIRE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableTwinHornWildfireAssistant.Name",
    hint: "DWAUTO.Settings.EnableTwinHornWildfireAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.TWIN_HORN_WILDFIRE_MOVE_NAMES, {
    name: "DWAUTO.Settings.TwinHornWildfireMoveNames.Name",
    hint: "DWAUTO.Settings.TwinHornWildfireMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "쌍각의 들불"
  });

  game.settings.register(MODULE_ID, SETTINGS.SEND_THOUGHTS_MOVE_NAMES, {
    name: "DWAUTO.Settings.SendThoughtsMoveNames.Name",
    hint: "DWAUTO.Settings.SendThoughtsMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "생각의 발신"
  });

  // 소각술사 고급액션(6레벨 이후) 불로 맺은 언약: 자세한 설계는
  // features/burning-ring-of-fire.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_BURNING_RING_OF_FIRE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableBurningRingOfFireAssistant.Name",
    hint: "DWAUTO.Settings.EnableBurningRingOfFireAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.BURNING_RING_OF_FIRE_MOVE_NAMES, {
    name: "DWAUTO.Settings.BurningRingOfFireMoveNames.Name",
    hint: "DWAUTO.Settings.BurningRingOfFireMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Burning Ring Of Fire"
  });

  // 전사 핵심액션 고유병기: 자세한 설계는 features/signature-weapon.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SIGNATURE_WEAPON_ASSISTANT, {
    name: "DWAUTO.Settings.EnableSignatureWeaponAssistant.Name",
    hint: "DWAUTO.Settings.EnableSignatureWeaponAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.SIGNATURE_WEAPON_MOVE_NAMES, {
    name: "DWAUTO.Settings.SignatureWeaponMoveNames.Name",
    hint: "DWAUTO.Settings.SignatureWeaponMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Signature Weapon"
  });

  // 전사 고급액션 무쇠의 몸: 자세한 설계는 features/iron-hide.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_IRON_HIDE_ASSISTANT, {
    name: "DWAUTO.Settings.EnableIronHideAssistant.Name",
    hint: "DWAUTO.Settings.EnableIronHideAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.IRON_HIDE_MOVE_NAMES, {
    name: "DWAUTO.Settings.IronHideMoveNames.Name",
    hint: "DWAUTO.Settings.IronHideMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Iron Hide"
  });

  // 전사 고급액션 무자비: 자세한 설계는 features/merciless.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_MERCILESS_ASSISTANT, {
    name: "DWAUTO.Settings.EnableMercilessAssistant.Name",
    hint: "DWAUTO.Settings.EnableMercilessAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.MERCILESS_MOVE_NAMES, {
    name: "DWAUTO.Settings.MercilessMoveNames.Name",
    hint: "DWAUTO.Settings.MercilessMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Merciless"
  });

  // 전사 고급액션 협박: 자세한 설계는 features/interrogator.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_INTERROGATOR_ASSISTANT, {
    name: "DWAUTO.Settings.EnableInterrogatorAssistant.Name",
    hint: "DWAUTO.Settings.EnableInterrogatorAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.INTERROGATOR_MOVE_NAMES, {
    name: "DWAUTO.Settings.InterrogatorMoveNames.Name",
    hint: "DWAUTO.Settings.InterrogatorMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Interrogator"
  });

  game.settings.register(MODULE_ID, SETTINGS.PARLEY_MOVE_NAMES, {
    name: "DWAUTO.Settings.ParleyMoveNames.Name",
    hint: "DWAUTO.Settings.ParleyMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Parley"
  });

  // 무기 태그 정밀(Precise): 자세한 설계는 features/precise-weapon.js
  // 참고. 근접 무브 이름(MELEE_MOVE_NAMES)/근접 무기 태그(MELEE_WEAPON_TAGS)
  // 설정을 그대로 재사용하므로 별도 무브 이름 설정은 없다.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_PRECISE_WEAPON_ASSISTANT, {
    name: "DWAUTO.Settings.EnablePreciseWeaponAssistant.Name",
    hint: "DWAUTO.Settings.EnablePreciseWeaponAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // 전사 고급액션 전사의 눈: 자세한 설계는 features/seeing-red.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SEEING_RED_ASSISTANT, {
    name: "DWAUTO.Settings.EnableSeeingRedAssistant.Name",
    hint: "DWAUTO.Settings.EnableSeeingRedAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.SEEING_RED_MOVE_NAMES, {
    name: "DWAUTO.Settings.SeeingRedMoveNames.Name",
    hint: "DWAUTO.Settings.SeeingRedMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Seeing Red"
  });

  game.settings.register(MODULE_ID, SETTINGS.DISCERN_REALITIES_MOVE_NAMES, {
    name: "DWAUTO.Settings.DiscernRealitiesMoveNames.Name",
    hint: "DWAUTO.Settings.DiscernRealitiesMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Discern Realities"
  });

  // 전사 고급액션 무기 강화: 자세한 설계는 features/improved-weapon.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_IMPROVED_WEAPON_ASSISTANT, {
    name: "DWAUTO.Settings.EnableImprovedWeaponAssistant.Name",
    hint: "DWAUTO.Settings.EnableImprovedWeaponAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.IMPROVED_WEAPON_MOVE_NAMES, {
    name: "DWAUTO.Settings.ImprovedWeaponMoveNames.Name",
    hint: "DWAUTO.Settings.ImprovedWeaponMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Improved Weapon"
  });

  // 강철의 몸(Steel Hide, 무쇠의 몸 대체)/살기등등(Bloodthirsty, 무자비
  // 대체)은 각각 features/iron-hide.js, features/merciless.js가 그대로
  // 재사용해서 별도 사용/미사용 설정 없이 이름 설정만 둔다.
  game.settings.register(MODULE_ID, SETTINGS.STEEL_HIDE_MOVE_NAMES, {
    name: "DWAUTO.Settings.SteelHideMoveNames.Name",
    hint: "DWAUTO.Settings.SteelHideMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Steel Hide"
  });

  game.settings.register(MODULE_ID, SETTINGS.BLOODTHIRSTY_MOVE_NAMES, {
    name: "DWAUTO.Settings.BloodthirstyMoveNames.Name",
    hint: "DWAUTO.Settings.BloodthirstyMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Bloodthirsty"
  });

  // 전사 고급액션 죽음의 예감: 자세한 설계는 features/through-deaths-eyes.js
  // 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_THROUGH_DEATHS_EYES_ASSISTANT, {
    name: "DWAUTO.Settings.EnableThroughDeathsEyesAssistant.Name",
    hint: "DWAUTO.Settings.EnableThroughDeathsEyesAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.THROUGH_DEATHS_EYES_MOVE_NAMES, {
    name: "DWAUTO.Settings.ThroughDeathsEyesMoveNames.Name",
    hint: "DWAUTO.Settings.ThroughDeathsEyesMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Through Death’s Eyes"
  });

  // 도적 핵심액션 덫 전문가: 자세한 설계는 features/trap-expert.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_TRAP_EXPERT_ASSISTANT, {
    name: "DWAUTO.Settings.EnableTrapExpertAssistant.Name",
    hint: "DWAUTO.Settings.EnableTrapExpertAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.TRAP_EXPERT_MOVE_NAMES, {
    name: "DWAUTO.Settings.TrapExpertMoveNames.Name",
    hint: "DWAUTO.Settings.TrapExpertMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Trap Expert"
  });

  // 도적 고급액션 신중함(Cautious, 덫 전문가 대상 예비 보정)은
  // features/trap-expert.js가 그대로 재사용해서 별도 사용/미사용 설정 없이
  // 이름 설정만 둔다(강철의 몸/살기등등과 같은 패턴).
  game.settings.register(MODULE_ID, SETTINGS.CAUTIOUS_MOVE_NAMES, {
    name: "DWAUTO.Settings.CautiousMoveNames.Name",
    hint: "DWAUTO.Settings.CautiousMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Cautious"
  });

  // 도적 고급액션 급소 가격: 자세한 설계는 features/cheap-shot.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_CHEAP_SHOT_ASSISTANT, {
    name: "DWAUTO.Settings.EnableCheapShotAssistant.Name",
    hint: "DWAUTO.Settings.EnableCheapShotAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.CHEAP_SHOT_MOVE_NAMES, {
    name: "DWAUTO.Settings.CheapShotMoveNames.Name",
    hint: "DWAUTO.Settings.CheapShotMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Cheap Shot"
  });

  game.settings.register(MODULE_ID, SETTINGS.BACKSTAB_MOVE_NAMES, {
    name: "DWAUTO.Settings.BackstabMoveNames.Name",
    hint: "DWAUTO.Settings.BackstabMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Backstab"
  });

  // 도적 핵심액션 독의 기술: 자세한 설계는 features/poisoner.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_POISONER_ASSISTANT, {
    name: "DWAUTO.Settings.EnablePoisonerAssistant.Name",
    hint: "DWAUTO.Settings.EnablePoisonerAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.POISONER_MOVE_NAMES, {
    name: "DWAUTO.Settings.PoisonerMoveNames.Name",
    hint: "DWAUTO.Settings.PoisonerMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Poisoner"
  });

  // 도적 고급액션 독의 달인/독제사: 자세한 설계는 features/poison-tab.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_POISON_TRACKER_ASSISTANT, {
    name: "DWAUTO.Settings.EnablePoisonTrackerAssistant.Name",
    hint: "DWAUTO.Settings.EnablePoisonTrackerAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.POISON_MASTER_MOVE_NAMES, {
    name: "DWAUTO.Settings.PoisonMasterMoveNames.Name",
    hint: "DWAUTO.Settings.PoisonMasterMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Poison Master"
  });

  game.settings.register(MODULE_ID, SETTINGS.BREWER_MOVE_NAMES, {
    name: "DWAUTO.Settings.BrewerMoveNames.Name",
    hint: "DWAUTO.Settings.BrewerMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Brewer"
  });

  // 치사한 수법(Dirty Fighter, 급소 가격 대체)은 features/cheap-shot.js가
  // 그대로 재사용해서 별도 사용/미사용 설정 없이 이름 설정만 둔다(강철의
  // 몸/살기등등과 같은 패턴).
  game.settings.register(MODULE_ID, SETTINGS.DIRTY_FIGHTER_MOVE_NAMES, {
    name: "DWAUTO.Settings.DirtyFighterMoveNames.Name",
    hint: "DWAUTO.Settings.DirtyFighterMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Dirty Fighter"
  });

  // 도적 고급액션 철완의 투척: 자세한 설계는 features/strong-arm.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_STRONG_ARM_ASSISTANT, {
    name: "DWAUTO.Settings.EnableStrongArmAssistant.Name",
    hint: "DWAUTO.Settings.EnableStrongArmAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.STRONG_ARM_MOVE_NAMES, {
    name: "DWAUTO.Settings.StrongArmMoveNames.Name",
    hint: "DWAUTO.Settings.StrongArmMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Strong Arm, True Aim"
  });

  // 사격(Volley) 7-9 선택지 중 "발수 소비" 항목이 몇 번째인지(던전월드
  // 기본 문구 기준 3번째). 텍스트로 판별하면 번역에 따라 깨질 수 있어
  // 숫자로 지정한다(Cast a Spell 부분성공과 같은 이유).
  game.settings.register(MODULE_ID, SETTINGS.STRONG_ARM_AMMO_CHOICE_INDEX, {
    name: "DWAUTO.Settings.StrongArmAmmoChoiceIndex.Name",
    hint: "DWAUTO.Settings.StrongArmAmmoChoiceIndex.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 3
  });

  // 도적 고급액션 대도적: 자세한 설계는 features/heist.js 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_HEIST_ASSISTANT, {
    name: "DWAUTO.Settings.EnableHeistAssistant.Name",
    hint: "DWAUTO.Settings.EnableHeistAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.HEIST_MOVE_NAMES, {
    name: "DWAUTO.Settings.HeistMoveNames.Name",
    hint: "DWAUTO.Settings.HeistMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Heist"
  });

  // 독학박사(Alchemist, 독제사 대체)는 features/poison-tab.js가 그대로
  // 재사용해서 별도 사용/미사용 설정 없이 이름 설정만 둔다.
  game.settings.register(MODULE_ID, SETTINGS.ALCHEMIST_MOVE_NAMES, {
    name: "DWAUTO.Settings.AlchemistMoveNames.Name",
    hint: "DWAUTO.Settings.AlchemistMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Alchemist"
  });

  // 극도로 신중함(Extremely Cautious, 신중함 대체)은 features/trap-expert.js가
  // 그대로 재사용해서 별도 사용/미사용 설정 없이 이름 설정만 둔다.
  game.settings.register(MODULE_ID, SETTINGS.EXTREMELY_CAUTIOUS_MOVE_NAMES, {
    name: "DWAUTO.Settings.ExtremelyCautiousMoveNames.Name",
    hint: "DWAUTO.Settings.ExtremelyCautiousMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Extremely Cautious"
  });

  // 클레릭 고급액션 응급처치/상급 응급처치: 자세한 설계는 features/first-aid.js
  // 참고.
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_FIRST_AID_ASSISTANT, {
    name: "DWAUTO.Settings.EnableFirstAidAssistant.Name",
    hint: "DWAUTO.Settings.EnableFirstAidAssistant.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.FIRST_AID_MOVE_NAMES, {
    name: "DWAUTO.Settings.FirstAidMoveNames.Name",
    hint: "DWAUTO.Settings.FirstAidMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "First Aid"
  });

  game.settings.register(MODULE_ID, SETTINGS.FIRST_AID_SPELL_NAME, {
    name: "DWAUTO.Settings.FirstAidSpellName.Name",
    hint: "DWAUTO.Settings.FirstAidSpellName.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Cure Light Wounds"
  });

  // 상급 응급처치(Greater First Aid, 응급처치 대체)는 별도 무브 이름 설정을
  // 두되(대상 주문이 소치유가 아니라 치유로 바뀌므로) 자동화 기능 자체는
  // 같은 파일이 재사용한다.
  game.settings.register(MODULE_ID, SETTINGS.GREATER_FIRST_AID_MOVE_NAMES, {
    name: "DWAUTO.Settings.GreaterFirstAidMoveNames.Name",
    hint: "DWAUTO.Settings.GreaterFirstAidMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Greater First Aid"
  });

  game.settings.register(MODULE_ID, SETTINGS.GREATER_FIRST_AID_SPELL_NAME, {
    name: "DWAUTO.Settings.GreaterFirstAidSpellName.Name",
    hint: "DWAUTO.Settings.GreaterFirstAidSpellName.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Cure Moderate Wounds"
  });
}
