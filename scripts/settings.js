import { MODULE_ID, SETTINGS } from "./constants.js";
import { TagSettingsMenu } from "./apps/tag-settings-menu.js";
import { AttackMovesMenu } from "./apps/attack-moves-menu.js";
import { DEFAULT_SPECIAL_ATTACK_MOVES } from "./data/attack-moves.js";
import { OngoingSpellsMenu } from "./apps/ongoing-spells-menu.js";
import { DEFAULT_ONGOING_SPELLS } from "./data/ongoing-spells.js";

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
}
