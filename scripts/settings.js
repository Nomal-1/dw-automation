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
import { MoveUpgradesMenu } from "./apps/move-upgrades-menu.js";
import { DEFAULT_MOVE_UPGRADES } from "./data/move-upgrades.js";
import { DamageReductionMovesMenu } from "./apps/damage-reduction-moves-menu.js";
import { DEFAULT_DAMAGE_REDUCTION_MOVES } from "./data/hit-trigger-moves.js";
import { DruidDamageDieMovesMenu } from "./apps/druid-damage-die-moves-menu.js";
import { DEFAULT_DRUID_DAMAGE_DIE_MOVES } from "./data/druid-damage-die-moves.js";
import { ConditionalDamageMovesMenu } from "./apps/conditional-damage-moves-menu.js";
import { DEFAULT_CONDITIONAL_DAMAGE_MOVES } from "./data/conditional-damage-moves.js";
import { DEFAULT_HIT_TRIGGER_MOVES } from "./data/hit-trigger-moves.js";

export function registerSettings() {
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
  // 기본값은 그에 맞춰뒀다.
  game.settings.register(MODULE_ID, SETTINGS.MELEE_WEAPON_TAGS, {
    name: "DWAUTO.Settings.MeleeWeaponTags.Name",
    hint: "DWAUTO.Settings.MeleeWeaponTags.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "hand, close, reach"
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
    name: "DWAUTO.Settings.NoteMoveNames.Name",
    hint: "DWAUTO.Settings.NoteMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Deity, Apotheosis, Born of the Soil, Animal Companion"
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
}
