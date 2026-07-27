import { MODULE_ID, SETTINGS } from "./constants.js";
import { TagSettingsMenu } from "./apps/tag-settings-menu.js";
import { AttackMovesMenu } from "./apps/attack-moves-menu.js";
import { DEFAULT_SPECIAL_ATTACK_MOVES } from "./data/attack-moves.js";

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
}
