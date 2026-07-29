import { MODULE_ID, SETTINGS } from "../constants.js";

// Nomal-1/dungeonworld-ko (Babele 기반 한글화 모듈)를 대상으로 한 자동 채우기.
// Babele 팩 JSON은 표준적으로 entries: [{id: "영문 원본 이름", name: "번역명", ...}]
// 구조를 쓰며, entries[].id가 곧 컴펜디엄 아이템의 원래 영문 이름이다. Babele API
// (game.babele)를 거치지 않고 이 모듈이 배포하는 정적 JSON 파일을 직접 fetch해서
// "영문 이름 -> 한글 이름" 맵을 만든다 — 무브/주문 이름 설정을 채우는 1회성 조회일
// 뿐이라 Babele이 실제로 초기화됐는지에 의존할 필요가 없다.
export const TRANSLATION_MODULE_ID = "dungeonworld-ko";

// 이 모듈이 자동화하는 8개 기본 직업 + 기본 무브 팩만 대상으로 한다.
// features/level-up-info.js도 이 파일명 목록에서 ".json"만 뗀 값을 컴펜디엄
// 팩 id로 재사용한다(무브 데이터를 fetch가 아니라 game.packs에서 직접 읽을
// 때도 같은 9개 팩이면 되므로).
export const MOVE_PACK_FILES = [
  "dungeonworld.basic-moves.json",
  "dungeonworld.the-fighter-moves.json",
  "dungeonworld.the-cleric-moves.json",
  "dungeonworld.the-thief-moves.json",
  "dungeonworld.the-wizard-moves.json",
  "dungeonworld.the-ranger-moves.json",
  "dungeonworld.the-paladin-moves.json",
  "dungeonworld.the-bard-moves.json",
  "dungeonworld.the-druid-moves.json"
];

const SPELL_PACK_FILES = ["dungeonworld.the-cleric-spells.json", "dungeonworld.the-wizard-spells.json"];

export function isTranslationModuleActive() {
  return game.modules.get(TRANSLATION_MODULE_ID)?.active ?? false;
}

async function fetchPackEntries(file) {
  try {
    const response = await fetch(`modules/${TRANSLATION_MODULE_ID}/compendium/${file}`);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.entries) ? data.entries : [];
  } catch (err) {
    console.warn(`${MODULE_ID} | failed to read translation pack: ${file}`, err);
    return [];
  }
}

async function buildNameMap(files) {
  const map = new Map();
  const packs = await Promise.all(files.map(fetchPackEntries));
  for (const entries of packs) {
    for (const entry of entries) {
      if (entry?.id && entry?.name) map.set(entry.id, entry.name);
    }
  }
  return map;
}

// features/level-up-info.js가 레벨업 창의 무브 선행조건(requiresMove, 항상
// 영문 원본)을 화면에 표시할 번역명으로 바꿀 때 재사용한다. dungeonworld-ko가
// 없거나 응답이 실패하면 빈 맵을 반환하고, 호출부가 영문 원본으로 대체 표시한다.
export async function getMoveNameMap() {
  return buildNameMap(MOVE_PACK_FILES);
}

function translateOne(map, rawName, stats) {
  const name = (rawName ?? "").trim();
  if (!name) return name;
  const translated = map.get(name);
  if (translated) {
    stats.matched++;
    return translated;
  }
  stats.unmatched++;
  return name;
}

// 쉼표 목록 설정(근접/사격/시전 무브 이름 등)을 번역하고, 같은 한글 이름으로
// 겹치는 항목(예: "Cast A Spell"/"Cast a Spell"이 둘 다 "주문 시전"으로 번역되는
// 경우)은 중복 제거한다.
function translateCommaList(map, raw, stats) {
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set();
  const result = [];
  for (const name of names) {
    const translated = translateOne(map, name, stats);
    if (!seen.has(translated)) {
      seen.add(translated);
      result.push(translated);
    }
  }
  return result.join(", ");
}

// 이름(name) 필드를 가진 테이블 설정(특수 공격 무브, 지속 주문)을 번역한다.
function translateRows(map, rows, stats) {
  return rows.map((row) => ({ ...row, name: translateOne(map, row.name, stats) }));
}

// 현재 설정값(영문 기본값이든 GM이 이미 편집해둔 값이든)의 이름을 번역 맵에서
// 찾을 수 있는 것만 바꾸고, 못 찾은 이름(서드파티 확장 무브, 이미 한글로
// 고쳐둔 값 등)은 그대로 둔다 — 되돌릴 수 없는 손실 없이 항상 안전하게 동작한다.
export async function runTranslationImport() {
  const moveMap = await buildNameMap(MOVE_PACK_FILES);
  const spellMap = await buildNameMap(SPELL_PACK_FILES);
  const stats = { matched: 0, unmatched: 0 };

  const melee = game.settings.get(MODULE_ID, SETTINGS.MELEE_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.MELEE_MOVE_NAMES, translateCommaList(moveMap, melee, stats));

  const ranged = game.settings.get(MODULE_ID, SETTINGS.RANGED_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.RANGED_MOVE_NAMES, translateCommaList(moveMap, ranged, stats));

  const castNames = game.settings.get(MODULE_ID, SETTINGS.CAST_SPELL_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.CAST_SPELL_MOVE_NAMES, translateCommaList(moveMap, castNames, stats));

  const augNames = game.settings.get(MODULE_ID, SETTINGS.SPELL_AUGMENTATION_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.SPELL_AUGMENTATION_MOVE_NAMES,
    translateCommaList(moveMap, augNames, stats)
  );

  const specialMoves = game.settings.get(MODULE_ID, SETTINGS.SPECIAL_ATTACK_MOVES);
  await game.settings.set(MODULE_ID, SETTINGS.SPECIAL_ATTACK_MOVES, translateRows(moveMap, specialMoves, stats));

  const ongoingSpells = game.settings.get(MODULE_ID, SETTINGS.ONGOING_SPELLS);
  await game.settings.set(MODULE_ID, SETTINGS.ONGOING_SPELLS, translateRows(spellMap, ongoingSpells, stats));

  const hitTriggerMoves = game.settings.get(MODULE_ID, SETTINGS.HIT_TRIGGER_MOVES);
  await game.settings.set(MODULE_ID, SETTINGS.HIT_TRIGGER_MOVES, translateRows(moveMap, hitTriggerMoves, stats));

  const indomitableNames = game.settings.get(MODULE_ID, SETTINGS.INDOMITABLE_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.INDOMITABLE_MOVE_NAMES,
    translateCommaList(moveMap, indomitableNames, stats)
  );

  // 치유 무브 표는 무브(Lay On Hands)와 주문(Cure Light/Moderate/Critical
  // Wounds, Heal) 이름이 섞여 있어서 두 맵을 합쳐서 찾는다.
  const combinedMap = new Map([...moveMap, ...spellMap]);
  const healingMoves = game.settings.get(MODULE_ID, SETTINGS.HEALING_MOVES);
  await game.settings.set(MODULE_ID, SETTINGS.HEALING_MOVES, translateRows(combinedMap, healingMoves, stats));

  const hospitallerMoves = game.settings.get(MODULE_ID, SETTINGS.HOSPITALLER_MOVES);
  await game.settings.set(MODULE_ID, SETTINGS.HOSPITALLER_MOVES, translateRows(moveMap, hospitallerMoves, stats));

  // 무브 업그레이드 표는 upgradeName/replacesName 둘 다 무브 이름이다.
  // deletesPrevious(대체/필요 구분)는 이름과 무관한 GM 설정이라 그대로
  // 옮겨야 한다 — 여기서 새 객체를 이름 두 필드만으로 다시 만들면 매번
  // 자동 채우기를 돌릴 때마다 그 설정이 사라진다.
  const moveUpgrades = game.settings.get(MODULE_ID, SETTINGS.MOVE_UPGRADES);
  const translatedUpgrades = moveUpgrades.map((row) => ({
    ...row,
    upgradeName: translateOne(moveMap, row.upgradeName, stats),
    replacesName: translateOne(moveMap, row.replacesName, stats)
  }));
  await game.settings.set(MODULE_ID, SETTINGS.MOVE_UPGRADES, translatedUpgrades);

  const damageReductionMoves = game.settings.get(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.DAMAGE_REDUCTION_MOVES,
    translateRows(moveMap, damageReductionMoves, stats)
  );

  const conditionalDamageMoves = game.settings.get(MODULE_ID, SETTINGS.CONDITIONAL_DAMAGE_MOVES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.CONDITIONAL_DAMAGE_MOVES,
    translateRows(moveMap, conditionalDamageMoves, stats)
  );

  const superiorWarriorNames = game.settings.get(MODULE_ID, SETTINGS.SUPERIOR_WARRIOR_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.SUPERIOR_WARRIOR_MOVE_NAMES,
    translateCommaList(moveMap, superiorWarriorNames, stats)
  );

  const druidBalanceNames = game.settings.get(MODULE_ID, SETTINGS.DRUID_BALANCE_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.DRUID_BALANCE_MOVE_NAMES,
    translateCommaList(moveMap, druidBalanceNames, stats)
  );

  const druidShapeshifterNames = game.settings.get(MODULE_ID, SETTINGS.DRUID_SHAPESHIFTER_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.DRUID_SHAPESHIFTER_MOVE_NAMES,
    translateCommaList(moveMap, druidShapeshifterNames, stats)
  );

  // v0.24.0부터 대지의 아들/딸은 "메모형 무브 이름" 목록의 한 항목일 뿐이라
  // (features/note-moves.js 참고) 위 NOTE_MOVE_NAMES 번역만으로 충분하다.
  const noteMoveNames = game.settings.get(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES, translateCommaList(moveMap, noteMoveNames, stats));

  const druidDamageDieMoves = game.settings.get(MODULE_ID, SETTINGS.DRUID_DAMAGE_DIE_MOVES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.DRUID_DAMAGE_DIE_MOVES,
    translateRows(moveMap, druidDamageDieMoves, stats)
  );

  const druidShedNames = game.settings.get(MODULE_ID, SETTINGS.DRUID_SHED_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.DRUID_SHED_MOVE_NAMES, translateCommaList(moveMap, druidShedNames, stats));

  const druidFormcrafterNames = game.settings.get(MODULE_ID, SETTINGS.DRUID_FORMCRAFTER_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.DRUID_FORMCRAFTER_MOVE_NAMES,
    translateCommaList(moveMap, druidFormcrafterNames, stats)
  );

  const druidFormshaperNames = game.settings.get(MODULE_ID, SETTINGS.DRUID_FORMSHAPER_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.DRUID_FORMSHAPER_MOVE_NAMES,
    translateCommaList(moveMap, druidFormshaperNames, stats)
  );

  return stats;
}
