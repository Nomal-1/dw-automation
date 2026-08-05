import { MODULE_ID, SETTINGS } from "../constants.js";

// Nomal-1/dungeonworld-ko (Babele 기반 한글화 모듈)를 대상으로 한 자동 채우기.
// Babele 팩 JSON은 표준적으로 entries: [{id: "영문 원본 이름", name: "번역명", ...}]
// 구조를 쓰며, entries[].id가 곧 컴펜디엄 아이템의 원래 영문 이름이다. Babele API
// (game.babele)를 거치지 않고 이 모듈이 배포하는 정적 JSON 파일을 직접 fetch해서
// "영문 이름 -> 한글 이름" 맵을 만든다 — 무브/주문 이름 설정을 채우는 1회성 조회일
// 뿐이라 Babele이 실제로 초기화됐는지에 의존할 필요가 없다.
export const TRANSLATION_MODULE_ID = "dungeonworld-ko";

// 이 모듈이 자동화하는 직업 + 기본 무브 팩을 대상으로 한다. features/level-up-info.js와
// features/class-grant.js도 이 파일명 목록에서 ".json"만 뗀 값을 컴펜디엄
// 팩 id로 재사용한다(무브 데이터를 fetch가 아니라 game.packs에서 직접 읽을
// 때도 같은 팩이면 되므로). 던전월드 룰북 기본 8개 직업(파이터/클레릭/시프/
// 위저드/레인저/팔라딘/바드/드루이드)만 넣어뒀다가, 바바리안/이몰레이터
// (시스템에 같이 딸려오는 추가 직업)의 무브(예: Unencumbered, Unharmed)가
// 자동 번역이 전혀 안 되는 걸 뒤늦게 발견해서 이 둘도 추가했다.
export const MOVE_PACK_FILES = [
  "dungeonworld.basic-moves.json",
  "dungeonworld.the-fighter-moves.json",
  "dungeonworld.the-cleric-moves.json",
  "dungeonworld.the-thief-moves.json",
  "dungeonworld.the-wizard-moves.json",
  "dungeonworld.the-ranger-moves.json",
  "dungeonworld.the-paladin-moves.json",
  "dungeonworld.the-bard-moves.json",
  "dungeonworld.the-druid-moves.json",
  "dungeonworld.the-barbarian-moves.json",
  "dungeonworld.the-immolator-moves.json"
];

// features/spellbook-expansion.js도 이 목록에서 ".json"만 뗀 값을 컴펜디엄
// 팩 id로 재사용한다(증보(Expanded Spellbook)가 "다른 어떤 직업의 주문
// 목록에서든" 고를 수 있게 하려면 클레릭/위저드 주문 팩 전체가 필요하다).
export const SPELL_PACK_FILES = ["dungeonworld.the-cleric-spells.json", "dungeonworld.the-wizard-spells.json"];

// features/vitals-assistant.js(최대 체력/하중 자동계산)가 캐릭터 시트의
// system.details.class(자유 입력 텍스트라 "Fighter"/"The Fighter"/번역명 등
// 무엇이 들어있을지 모른다)를 실제 직업 키와 매칭할 때 쓴다.
const CLASS_PACK_FILE = "dungeonworld.classes.json";

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

// 팩 파일별로 (entry.id -> 번역명) 맵을 따로 유지한다 — mergeNameMaps처럼
// 합치지 않으므로, 같은 영문 이름을 여러 클래스가 같이 쓰더라도 어느 팩(클래스)의
// 번역인지 구분해서 나중에 정확히 골라 쓸 수 있다.
async function buildPackNameMaps(files) {
  const maps = new Map();
  const results = await Promise.all(files.map(fetchPackEntries));
  files.forEach((file, i) => {
    const map = new Map();
    for (const entry of results[i]) {
      if (entry?.id && entry?.name) map.set(entry.id, entry.name);
    }
    maps.set(file, map);
  });
  return maps;
}

// 실제로 확인된 사례: 클레릭과 팔라딘이 둘 다 "Divine Protection"이라는
// 영문 이름을 쓰는데(원작 자체가 그렇다), 한글 번역은 "믿음의 갑옷"/"신의
// 갑옷"으로 서로 다르다. 팩을 순서대로 훑으면서 하나의 맵에 그대로 쌓으면
// 나중에 처리되는 팩의 번역이 먼저 것을 조용히 덮어써버려서, 클레릭용으로
// 등록해둔 설정 행이 실제로는 팔라딘 이름으로 잘못 번역되는 사고가 났다.
// 같은 영문 이름인데 번역명이 서로 다른 경우를 "모호함"으로 표시해 아예
// 맵에서 빼버린다 — 틀린 번역을 조용히 적용하는 것보다, 그 이름만 자동
// 번역하지 않고 그대로 두는 편이 안전하다(아래 AMBIGUOUS_NAME_BY_LINK에
// 등록해둔 이름은 예외 — resolveAmbiguousName이 별도로 정확히 구분한다).
function mergeNameMaps(packMaps) {
  const map = new Map();
  const ambiguous = new Set();
  for (const packMap of packMaps.values()) {
    for (const [id, name] of packMap) {
      if (ambiguous.has(id)) continue;

      const existing = map.get(id);
      if (existing !== undefined && existing !== name) {
        ambiguous.add(id);
        map.delete(id);
        console.warn(
          `${MODULE_ID} | translation-import: "${id}" has different translations across classes ("${existing}" vs "${name}") — skipping auto-translate for this name, enter it manually.`
        );
        continue;
      }
      map.set(id, name);
    }
  }
  return map;
}

async function buildNameMap(files) {
  return mergeNameMaps(await buildPackNameMaps(files));
}

// features/level-up-info.js가 레벨업 창의 무브 선행조건(requiresMove, 항상
// 영문 원본)을 화면에 표시할 번역명으로 바꿀 때 재사용한다. dungeonworld-ko가
// 없거나 응답이 실패하면 빈 맵을 반환하고, 호출부가 영문 원본으로 대체 표시한다.
export async function getMoveNameMap() {
  return buildNameMap(MOVE_PACK_FILES);
}

// features/vitals-assistant.js가 재사용한다. "The Fighter" -> "전사"처럼
// 직업 아이템 이름 그대로 매핑한다(무브 이름과 겹칠 일이 없는 별도 컴펜디엄
// 이라 mergeNameMaps의 모호함 처리는 필요 없다).
export async function getClassNameMap() {
  return buildNameMap([CLASS_PACK_FILE]);
}

// DAMAGE_REDUCTION_MOVES(조건부 장갑 보너스 무브)에서만 쓰는 모호한 이름
// 구분표. 각 행에 이미 linkedMoveName 유무로 "독립 조건"(클레릭 Divine
// Protection)인지 "다른 무브 발동에 연동"(팔라딘 Divine Protection, Holy
// Protection의 업그레이드)인지가 구분돼 있으므로, 그 정보로 어느 클래스
// 팩의 번역을 써야 하는지 정확히 고를 수 있다 — mergeNameMaps처럼 그냥
// 건너뛰지 않고 실제로 자동 번역한다.
const AMBIGUOUS_NAME_BY_LINK = {
  "Divine Protection": {
    linked: "dungeonworld.the-paladin-moves.json",
    unlinked: "dungeonworld.the-cleric-moves.json"
  }
};

function resolveAmbiguousName(packMaps, englishName, hasLink) {
  const resolution = AMBIGUOUS_NAME_BY_LINK[englishName];
  if (!resolution) return null;
  const packFile = hasLink ? resolution.linked : resolution.unlinked;
  return packMaps.get(packFile)?.get(englishName) ?? null;
}

// MOVE_UPGRADES 표는 DAMAGE_REDUCTION_MOVES와 달리 linkedMoveName이 없어서
// hasLink 신호를 쓸 수 없다. 대신 같은 행에 항상 같이 붙어다니는 "짝" 이름
// (Holy Protection/Divine Armor처럼 그 자체는 겹치지 않는 이름)이 어느 팩에만
// 있는지로 구분한다 — Holy Protection은 팔라딘 팩에만 있으니 그 행의
// "Divine Protection"(업그레이드 이름)도 팔라딘 번역으로, Divine Armor는
// 클레릭 팩에만 있으니 그 행의 "Divine Protection"(대체 대상)도 클레릭
// 번역으로 고른다. ambiguousName이 애초에 AMBIGUOUS_NAME_BY_LINK에 없으면
// (겹치지 않는 평범한 이름이면) null을 돌려줘서 평범한 translateOne으로
// 넘어가게 한다.
function resolveAmbiguousBySiblingName(packMaps, ambiguousName, siblingName) {
  if (!AMBIGUOUS_NAME_BY_LINK[ambiguousName]) return null;
  for (const map of packMaps.values()) {
    if (map.has(siblingName)) return map.get(ambiguousName) ?? null;
  }
  return null;
}

// features/underdog.js의 migrateAddSurveyedDefaults(새로 발견된 기본값을
// 이미 저장된 표에 추가하는 마이그레이션)가 "이 이름, 이미 있나?"를 정확히
// 비교하려면 runTranslationImport과 완전히 같은 규칙(resolveAmbiguousName,
// linkedMoveName 유무로 구분)으로 번역명을 알아야 한다. 이 함수 없이 그냥
// getMoveNameMap()(모호한 이름은 통째로 빠진 맵)만 쓰면 "Divine Protection"
// 같은 이름은 항상 미번역 취급되어, 이미 번역되어 저장된 행("믿음의 갑옷"/
// "신의 갑옷")과 다르다고 착각해 중복 행을 추가해버린다(실제로 발생했던 버그).
export async function resolveDamageReductionMoveName(englishName, linkedMoveName) {
  const packMaps = await buildPackNameMaps(MOVE_PACK_FILES);
  const resolved = resolveAmbiguousName(packMaps, englishName, Boolean(linkedMoveName));
  if (resolved) return resolved;
  return mergeNameMaps(packMaps).get(englishName) ?? null;
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
  const movePackMaps = await buildPackNameMaps(MOVE_PACK_FILES);
  const moveMap = mergeNameMaps(movePackMaps);
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
  // "Divine Protection"처럼 클레릭/팔라딘이 이름을 공유하는 경우는 moveMap에서
  // 아예 빠져있으므로(mergeNameMaps), 같은 행의 짝 이름으로 어느 팩인지 먼저
  // 알아내 그 팩의 번역을 쓴다(resolveAmbiguousBySiblingName) — 안 그러면
  // 이 이름만 번역이 안 돼서, 번역된 세계에서 실제 캐릭터가 가진 한글 이름과
  // 표의 영문 이름이 어긋나 업그레이드 자동 삭제가 조용히 멈춘다.
  const moveUpgrades = game.settings.get(MODULE_ID, SETTINGS.MOVE_UPGRADES);
  const translatedUpgrades = moveUpgrades.map((row) => {
    const resolvedUpgrade = resolveAmbiguousBySiblingName(movePackMaps, row.upgradeName, row.replacesName);
    const resolvedReplaces = resolveAmbiguousBySiblingName(movePackMaps, row.replacesName, row.upgradeName);
    const upgradeName = resolvedUpgrade ?? translateOne(moveMap, row.upgradeName, stats);
    const replacesName = resolvedReplaces ?? translateOne(moveMap, row.replacesName, stats);
    if (resolvedUpgrade) stats.matched++;
    if (resolvedReplaces) stats.matched++;
    return { ...row, upgradeName, replacesName };
  });
  await game.settings.set(MODULE_ID, SETTINGS.MOVE_UPGRADES, translatedUpgrades);

  // linkedMoveName(팔라딘 Holy Protection의 "Quest" 등)도 무브 이름이라
  // 같이 번역해야 features/underdog.js가 그 이름으로 다른 메모형 무브의
  // 발동 상태를 정확히 찾을 수 있다. name 자체는 클레릭/팔라딘이 똑같이
  // "Divine Protection"을 쓰는 것처럼 모호한 경우가 있는데, linkedMoveName
  // 유무로 어느 쪽인지 구분해서(resolveAmbiguousName) 정확한 번역을 고른다.
  const damageReductionMoves = game.settings.get(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES);
  const translatedDamageReductionMoves = damageReductionMoves.map((row) => {
    const hasLink = Boolean(row.linkedMoveName);
    const resolved = resolveAmbiguousName(movePackMaps, row.name, hasLink);
    let name;
    if (resolved) {
      stats.matched++;
      name = resolved;
    } else {
      name = translateOne(moveMap, row.name, stats);
    }
    return {
      ...row,
      name,
      linkedMoveName: row.linkedMoveName ? translateOne(moveMap, row.linkedMoveName, stats) : row.linkedMoveName
    };
  });
  await game.settings.set(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES, translatedDamageReductionMoves);

  const conditionalDamageMoves = game.settings.get(MODULE_ID, SETTINGS.CONDITIONAL_DAMAGE_MOVES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.CONDITIONAL_DAMAGE_MOVES,
    translateRows(moveMap, conditionalDamageMoves, stats)
  );

  const conditionalTagMoves = game.settings.get(MODULE_ID, SETTINGS.CONDITIONAL_TAG_MOVES);
  await game.settings.set(MODULE_ID, SETTINGS.CONDITIONAL_TAG_MOVES, translateRows(moveMap, conditionalTagMoves, stats));

  const superiorWarriorNames = game.settings.get(MODULE_ID, SETTINGS.SUPERIOR_WARRIOR_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.SUPERIOR_WARRIOR_MOVE_NAMES,
    translateCommaList(moveMap, superiorWarriorNames, stats)
  );

  const smashMoveNames = game.settings.get(MODULE_ID, SETTINGS.SMASH_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.SMASH_MOVE_NAMES, translateCommaList(moveMap, smashMoveNames, stats));

  const muscleboundNames = game.settings.get(MODULE_ID, SETTINGS.MUSCLEBOUND_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.MUSCLEBOUND_MOVE_NAMES,
    translateCommaList(moveMap, muscleboundNames, stats)
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

  // 클래스 부여 무브 표는 name(발동하는 무브 자체)과 grantedMoveNames(부여할
  // 다른 직업 무브들, 쉼표 목록) 둘 다 무브 이름이다.
  const classGrantMoves = game.settings.get(MODULE_ID, SETTINGS.CLASS_GRANT_MOVES);
  const translatedClassGrantMoves = classGrantMoves.map((row) => ({
    ...row,
    name: translateOne(moveMap, row.name, stats),
    grantedMoveNames: translateCommaList(moveMap, row.grantedMoveNames, stats)
  }));
  await game.settings.set(MODULE_ID, SETTINGS.CLASS_GRANT_MOVES, translatedClassGrantMoves);

  const prepareSpellsMoves = game.settings.get(MODULE_ID, SETTINGS.PREPARE_SPELLS_MOVES);
  await game.settings.set(MODULE_ID, SETTINGS.PREPARE_SPELLS_MOVES, translateRows(moveMap, prepareSpellsMoves, stats));

  const discountSpellNames = game.settings.get(MODULE_ID, SETTINGS.DISCOUNT_SPELL_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.DISCOUNT_SPELL_MOVE_NAMES,
    translateCommaList(moveMap, discountSpellNames, stats)
  );

  const expandedSpellbookNames = game.settings.get(MODULE_ID, SETTINGS.EXPANDED_SPELLBOOK_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.EXPANDED_SPELLBOOK_MOVE_NAMES,
    translateCommaList(moveMap, expandedSpellbookNames, stats)
  );

  const counterspellNames = game.settings.get(MODULE_ID, SETTINGS.COUNTERSPELL_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.COUNTERSPELL_MOVE_NAMES,
    translateCommaList(moveMap, counterspellNames, stats)
  );

  const ongoingPenaltyReductionMoves = game.settings.get(MODULE_ID, SETTINGS.ONGOING_PENALTY_REDUCTION_MOVES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.ONGOING_PENALTY_REDUCTION_MOVES,
    translateRows(moveMap, ongoingPenaltyReductionMoves, stats)
  );

  const empowerMoves = game.settings.get(MODULE_ID, SETTINGS.EMPOWER_MOVES);
  await game.settings.set(MODULE_ID, SETTINGS.EMPOWER_MOVES, translateRows(moveMap, empowerMoves, stats));

  const holdGrantMoves = game.settings.get(MODULE_ID, SETTINGS.HOLD_GRANT_MOVES);
  await game.settings.set(MODULE_ID, SETTINGS.HOLD_GRANT_MOVES, translateRows(moveMap, holdGrantMoves, stats));

  const commandMoveNames = game.settings.get(MODULE_ID, SETTINGS.COMMAND_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.COMMAND_MOVE_NAMES, translateCommaList(moveMap, commandMoveNames, stats));

  const commandCunningMoveNames = game.settings.get(MODULE_ID, SETTINGS.COMMAND_CUNNING_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.COMMAND_CUNNING_MOVE_NAMES,
    translateCommaList(moveMap, commandCunningMoveNames, stats)
  );

  const wellTrainedMoveNames = game.settings.get(MODULE_ID, SETTINGS.WELL_TRAINED_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.WELL_TRAINED_MOVE_NAMES,
    translateCommaList(moveMap, wellTrainedMoveNames, stats)
  );

  const unnaturalAllyMoveNames = game.settings.get(MODULE_ID, SETTINGS.UNNATURAL_ALLY_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.UNNATURAL_ALLY_MOVE_NAMES,
    translateCommaList(moveMap, unnaturalAllyMoveNames, stats)
  );

  const aidOrInterfereMoveNames = game.settings.get(MODULE_ID, SETTINGS.AID_OR_INTERFERE_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.AID_OR_INTERFERE_MOVE_NAMES,
    translateCommaList(moveMap, aidOrInterfereMoveNames, stats)
  );

  const arcaneArtMoveNames = game.settings.get(MODULE_ID, SETTINGS.ARCANE_ART_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.ARCANE_ART_MOVE_NAMES, translateCommaList(moveMap, arcaneArtMoveNames, stats));

  // 일반 name 필드 말고 restrictToMoveNames(쉼표 목록)도 무브 이름이라 같이
  // 번역해야 한다(My Love For You Is Like A Truck의 "Parley" 제한 등) —
  // translateRows는 name만 다루므로 이 표만 직접 처리한다.
  const selfForwardMoves = game.settings.get(MODULE_ID, SETTINGS.SELF_FORWARD_MOVES);
  const translatedSelfForwardMoves = selfForwardMoves.map((row) => ({
    name: translateOne(moveMap, row.name, stats),
    restrictToMoveNames: row.restrictToMoveNames
      ? translateCommaList(moveMap, row.restrictToMoveNames, stats)
      : row.restrictToMoveNames
  }));
  await game.settings.set(MODULE_ID, SETTINGS.SELF_FORWARD_MOVES, translatedSelfForwardMoves);

  const goodDayToDieMoveNames = game.settings.get(MODULE_ID, SETTINGS.GOOD_DAY_TO_DIE_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.GOOD_DAY_TO_DIE_MOVE_NAMES,
    translateCommaList(moveMap, goodDayToDieMoveNames, stats)
  );

  const samsonMoveNames = game.settings.get(MODULE_ID, SETTINGS.SAMSON_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.SAMSON_MOVE_NAMES, translateCommaList(moveMap, samsonMoveNames, stats));

  const invigorateMoveNames = game.settings.get(MODULE_ID, SETTINGS.INVIGORATE_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.INVIGORATE_MOVE_NAMES,
    translateCommaList(moveMap, invigorateMoveNames, stats)
  );

  const littleHelpMoveNames = game.settings.get(MODULE_ID, SETTINGS.LITTLE_HELP_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.LITTLE_HELP_MOVE_NAMES,
    translateCommaList(moveMap, littleHelpMoveNames, stats)
  );

  const iAmTheLawMoveNames = game.settings.get(MODULE_ID, SETTINGS.I_AM_THE_LAW_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.I_AM_THE_LAW_MOVE_NAMES,
    translateCommaList(moveMap, iAmTheLawMoveNames, stats)
  );

  const knowItAllMoveNames = game.settings.get(MODULE_ID, SETTINGS.KNOW_IT_ALL_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.KNOW_IT_ALL_MOVE_NAMES,
    translateCommaList(moveMap, knowItAllMoveNames, stats)
  );

  const recruitMoveNames = game.settings.get(MODULE_ID, SETTINGS.RECRUIT_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.RECRUIT_MOVE_NAMES, translateCommaList(moveMap, recruitMoveNames, stats));

  const bolsterMoveNames = game.settings.get(MODULE_ID, SETTINGS.BOLSTER_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.BOLSTER_MOVE_NAMES, translateCommaList(moveMap, bolsterMoveNames, stats));

  const burningBrandMoveNames = game.settings.get(MODULE_ID, SETTINGS.BURNING_BRAND_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.BURNING_BRAND_MOVE_NAMES,
    translateCommaList(moveMap, burningBrandMoveNames, stats)
  );

  const defendMoveNames = game.settings.get(MODULE_ID, SETTINGS.DEFEND_MOVE_NAMES);
  await game.settings.set(MODULE_ID, SETTINGS.DEFEND_MOVE_NAMES, translateCommaList(moveMap, defendMoveNames, stats));

  const twiceAsBrightMoveNames = game.settings.get(MODULE_ID, SETTINGS.TWICE_AS_BRIGHT_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.TWICE_AS_BRIGHT_MOVE_NAMES,
    translateCommaList(moveMap, twiceAsBrightMoveNames, stats)
  );

  const halfAsLongMoveNames = game.settings.get(MODULE_ID, SETTINGS.HALF_AS_LONG_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.HALF_AS_LONG_MOVE_NAMES,
    translateCommaList(moveMap, halfAsLongMoveNames, stats)
  );

  const thisKillingFireMoveNames = game.settings.get(MODULE_ID, SETTINGS.THIS_KILLING_FIRE_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.THIS_KILLING_FIRE_MOVE_NAMES,
    translateCommaList(moveMap, thisKillingFireMoveNames, stats)
  );

  const burningBridgesMoveNames = game.settings.get(MODULE_ID, SETTINGS.BURNING_BRIDGES_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.BURNING_BRIDGES_MOVE_NAMES,
    translateCommaList(moveMap, burningBridgesMoveNames, stats)
  );

  const lastBreathMoveNames = game.settings.get(MODULE_ID, SETTINGS.LAST_BREATH_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.LAST_BREATH_MOVE_NAMES,
    translateCommaList(moveMap, lastBreathMoveNames, stats)
  );

  const burningRingOfFireMoveNames = game.settings.get(MODULE_ID, SETTINGS.BURNING_RING_OF_FIRE_MOVE_NAMES);
  await game.settings.set(
    MODULE_ID,
    SETTINGS.BURNING_RING_OF_FIRE_MOVE_NAMES,
    translateCommaList(moveMap, burningRingOfFireMoveNames, stats)
  );

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
