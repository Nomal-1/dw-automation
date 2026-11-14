import { MODULE_ID, SETTINGS } from "../constants.js";
import { SETTING_CATEGORIES } from "../data/settings-categories.js";
import { RACE_CORE_MOVES } from "../data/race-core-moves.js";
import { DEFAULT_MOVE_UPGRADES } from "../data/move-upgrades.js";

// 직업별 자동화 창(apps/class-automation-app.js)이 보여줄 "액션 ↔ 자동화" 연결표를
// 그때그때 계산한다. 손으로 쓴 목록을 따로 두지 않는 이유: 기능을 추가할 때마다
// 이 표를 같이 고치는 걸 잊으면 창이 거짓말을 하게 된다. 대신 이미 있는 정보만 쓴다.
//
// 1) 기능(자동화) 묶음: Foundry는 이 모듈의 설정을 등록 순서대로 보관한다
//    (game.settings.settings는 Map이라 넣은 순서가 유지됨). settings.js는 기능마다
//    "켜기 설정(enableX, Boolean)"을 먼저 등록하고 그 기능이 쓰는 이름 목록·표를
//    바로 뒤에 등록하므로, 켜기 설정 하나부터 다음 켜기 설정 전까지를 한 기능으로 본다.
// 2) 기능에 걸린 액션: 그 묶음의 이름 목록(…Names)과 표 설정 행의 이름을 모은다.
//    영문 기본값과 지금 저장된 값(번역된 이름일 수 있음)을 모두 쓴다.
// 3) 액션 목록: 던전월드 무브 컴펜디엄(기본 액션 + 직업별 팩)과 종족 액션 데이터,
//    그리고 월드 캐릭터가 가진 무브 중 어느 팩에도 없는 것(홈브루 등).
// 4) 액션의 "자기 자동화"와 "반응하는 자동화": 기능이 속한 설정 탭 분류
//    (SETTING_CATEGORIES)가 액션의 직업과 같거나 general/shared면 그 액션 자체의
//    자동화로 보고 창에서 켜고 끌 수 있게 한다. 다르면(예: 사냥꾼 기능이 기본 액션
//    "위험 돌파"에 반응) 그 액션을 굴렸을 때 반응하는 다른 직업의 자동화로 보여주기만 한다.

const parse = (value) =>
  String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// 컴펜디엄마다 어퍼스트로피(’)와 작은따옴표(')가 섞여 있다(ARCHITECTURE.md 2장)
export const normalizeName = (name) => String(name ?? "").replace(/[’‘]/g, "'").trim();

function namesInSetting(setting) {
  const out = [];
  const collect = (value) => {
    if (typeof value === "string") {
      if (setting.key.endsWith("Names") || setting.key.endsWith("Name")) out.push(...parse(value));
    } else if (Array.isArray(value)) {
      for (const row of value) {
        for (const field of ["name", "replacesName", "upgradeName"]) {
          if (typeof row?.[field] === "string" && row[field].trim()) out.push(row[field].trim());
        }
      }
    }
  };
  collect(setting.default);
  try {
    collect(game.settings.get(MODULE_ID, setting.key));
  } catch (err) {
    // 등록만 되고 아직 값을 읽을 수 없는 설정은 기본값만 쓴다
  }
  return out;
}

// 등록 순서 규칙의 예외: 다른 기능의 켜기 설정 뒤에 등록돼 있지만 실제로는 다른 기능이
// 쓰는 이름 목록·표 → 실제 주인 기능의 켜기 설정. 값이 null이면 켜기 설정이 따로 없는
// 공통 규칙이라 어느 기능에도 넣지 않는다. 2026-11-14에 코드 전체를 분석해(이름 목록을 쓰는
// 파일이 확인하는 켜기 설정 ↔ 등록 순서상 묶인 켜기 설정) 어긋난 24개를 모두 적었다.
// 새 설정을 다른 기능 사이에 끼워 등록했다면 여기에 한 줄 더한다.
const SETTING_OWNER_OVERRIDES = {
  [SETTINGS.SPELL_AUGMENTATION_MOVE_NAMES]: SETTINGS.ENABLE_ATTACK_ASSISTANT,
  [SETTINGS.STAUNCH_DEFENDER_MOVE_NAMES]: SETTINGS.ENABLE_DEFEND_ASSISTANT,
  [SETTINGS.IMPERVIOUS_DEFENDER_MOVE_NAMES]: SETTINGS.ENABLE_DEFEND_ASSISTANT,
  [SETTINGS.ELDRITCH_TONES_MOVE_NAMES]: SETTINGS.ENABLE_ARCANE_ART_ASSISTANT,
  [SETTINGS.HEALING_SONG_MOVE_NAMES]: SETTINGS.ENABLE_ARCANE_ART_ASSISTANT,
  [SETTINGS.VICIOUS_CACOPHONY_MOVE_NAMES]: SETTINGS.ENABLE_ARCANE_ART_ASSISTANT,
  [SETTINGS.ELDRITCH_CHORD_MOVE_NAMES]: SETTINGS.ENABLE_ARCANE_ART_ASSISTANT,
  [SETTINGS.HEALING_CHORUS_MOVE_NAMES]: SETTINGS.ENABLE_ARCANE_ART_ASSISTANT,
  [SETTINGS.VICIOUS_BLAST_MOVE_NAMES]: SETTINGS.ENABLE_ARCANE_ART_ASSISTANT,
  [SETTINGS.CHARMING_OPEN_MOVE_NAMES]: SETTINGS.ENABLE_DEVIOUS_ASSISTANT,
  [SETTINGS.DAMAGE_REDUCTION_MOVES]: SETTINGS.ENABLE_HIT_TRIGGER_ASSISTANT,
  [SETTINGS.CONDITIONAL_DAMAGE_MOVES]: SETTINGS.ENABLE_ATTACK_ASSISTANT,
  [SETTINGS.CONDITIONAL_TAG_MOVES]: SETTINGS.ENABLE_ATTACK_ASSISTANT,
  [SETTINGS.SUPERIOR_WARRIOR_MOVE_NAMES]: SETTINGS.ENABLE_ATTACK_ASSISTANT,
  [SETTINGS.SMASH_MOVE_NAMES]: SETTINGS.ENABLE_ATTACK_ASSISTANT,
  [SETTINGS.MUSCLEBOUND_MOVE_NAMES]: SETTINGS.ENABLE_ATTACK_ASSISTANT,
  [SETTINGS.ONGOING_PENALTY_REDUCTION_MOVES]: null,
  [SETTINGS.EMPOWER_MOVES]: SETTINGS.ENABLE_SPELLCASTING_ASSISTANT,
  [SETTINGS.HOLD_GRANT_MOVES]: SETTINGS.ENABLE_SPELL_PREPARATION_ASSISTANT,
  [SETTINGS.STEEL_HIDE_MOVE_NAMES]: SETTINGS.ENABLE_IRON_HIDE_ASSISTANT,
  [SETTINGS.BLOODTHIRSTY_MOVE_NAMES]: SETTINGS.ENABLE_MERCILESS_ASSISTANT,
  [SETTINGS.DIRTY_FIGHTER_MOVE_NAMES]: SETTINGS.ENABLE_CHEAP_SHOT_ASSISTANT,
  [SETTINGS.ALCHEMIST_MOVE_NAMES]: SETTINGS.ENABLE_POISON_TRACKER_ASSISTANT,
  [SETTINGS.EXTREMELY_CAUTIOUS_MOVE_NAMES]: SETTINGS.ENABLE_TRAP_EXPERT_ASSISTANT,
};

// 액션 업그레이드는 액션 자체의 자동화가 아니라 "상급 액션을 배우면 이전 단계 액션을
// 시트에서 정리"하는 규칙이다. 43쌍이 모든 직업에 걸쳐 있어 일반 자동화처럼 보여주면
// 거의 모든 줄에 같은 스위치가 붙는다. 그래서 이 기능은 연결표에서 빼고, 해당 액션
// 줄에 "배우면 무엇이 지워지는지/남는지" 안내로 따로 보여준다(buildUpgradeNotes).
export const MOVE_UPGRADE_FEATURE = SETTINGS.ENABLE_MOVE_UPGRADE_ASSISTANT;

/** 등록 순서로 기능 묶음을 만든다. */
export function getFeatureGroups() {
  const groups = [];
  const byKey = new Map();
  const pendingOverrides = [];
  let current = null;
  for (const setting of game.settings.settings.values()) {
    if (setting.namespace !== MODULE_ID) continue;
    if (setting.key in SETTING_OWNER_OVERRIDES) {
      const owner = SETTING_OWNER_OVERRIDES[setting.key];
      if (owner) pendingOverrides.push([owner, setting]);
      continue;
    }
    if (setting.type === Boolean && /^enable[A-Z]/.test(setting.key)) {
      current = {
        enableKey: setting.key,
        label: game.i18n.localize(setting.name ?? setting.key),
        hint: game.i18n.localize(setting.hint ?? ""),
        category: SETTING_CATEGORIES[setting.key] ?? "general",
        names: new Set(),
        // 켜기 설정 바로 뒤에 처음 등록된 이름 목록 = 그 기능 자신의 액션(대개).
        // 뒤에 오는 목록은 그 기능이 반응하는 다른 액션(예: 위험 돌파)인 경우가 많다.
        primary: null
      };
      groups.push(current);
      byKey.set(setting.key, current);
      continue;
    }
    if (!current) continue;
    const names = namesInSetting(setting).map(normalizeName);
    for (const name of names) current.names.add(name);
    if (!current.primary && typeof setting.default === "string" && setting.key.endsWith("Names") && names.length) {
      current.primary = new Set(names);
    }
  }
  // 주인 기능이 뒤에 등록돼 있을 수도 있어서 다 모은 뒤에 넣는다
  for (const [owner, setting] of pendingOverrides) {
    const group = byKey.get(owner);
    if (group) for (const name of namesInSetting(setting).map(normalizeName)) group.names.add(name);
  }
  return groups.filter((g) => g.names.size > 0 && g.enableKey !== MOVE_UPGRADE_FEATURE);
}

/**
 * 액션 업그레이드 안내: 원문 이름(정규화) → [{kind, other, deletes}]
 * kind "upgrade": 이 액션이 상급 단계 — 배우면 other(이전 단계)를 지우거나(deletes) 남긴다.
 * kind "replaced": 이 액션이 이전 단계 — other(상급 단계)를 배우면 지워지거나 남는다.
 */
function buildUpgradeNotes() {
  const notes = new Map();
  let rows = DEFAULT_MOVE_UPGRADES;
  try {
    const saved = game.settings.get(MODULE_ID, SETTINGS.MOVE_UPGRADES);
    if (Array.isArray(saved) && saved.length) rows = [...DEFAULT_MOVE_UPGRADES, ...saved];
  } catch (err) {
    // 기본 표만 쓴다
  }
  const add = (key, note) => {
    const k = normalizeName(key);
    if (!k) return;
    if (!notes.has(k)) notes.set(k, []);
    if (!notes.get(k).some((n) => n.kind === note.kind && normalizeName(n.other) === normalizeName(note.other))) notes.get(k).push(note);
  };
  for (const row of rows) {
    if (!row?.upgradeName || !row?.replacesName) continue;
    const deletes = row.deletesPrevious !== false;
    add(row.upgradeName, { kind: "upgrade", other: row.replacesName, deletes });
    add(row.replacesName, { kind: "replaced", other: row.upgradeName, deletes });
  }
  return notes;
}

function classKeyFromPack(pack) {
  const name = pack.metadata.name ?? "";
  if (name === "basic-moves") return "basic";
  const m = name.match(/^the-(.+)-moves$/);
  if (m) return m[1];
  return name.replace(/-moves$/, "");
}

const GROUP_ORDER = ["basic", "barbarian", "bard", "cleric", "druid", "fighter", "immolator", "paladin", "ranger", "thief", "wizard"];

/** 무브 컴펜디엄 팩들 (던전월드 시스템 + 다른 모듈이 더한 무브 팩) */
function getMovePacks() {
  return game.packs.filter(
    (p) => p.documentName === "Item" && /(^|-)moves$/.test(p.metadata.name ?? "") && (p.metadata.packageName === "dungeonworld" || p.metadata.packageType === "module")
  );
}

/**
 * 창에 보여줄 전체 표를 만든다.
 * @returns {Promise<{groups: Array<{key: string, label: string, moves: Array}>}>}
 */
export async function buildAutomationCatalog() {
  const featureGroups = getFeatureGroups();
  const characters = game.actors.filter((a) => a.type === "character");

  const makeMove = ({ name, original, classKey, img }) => {
    const keys = new Set([normalizeName(name), normalizeName(original)].filter(Boolean));
    const own = [];
    const reacting = [];
    for (const g of featureGroups) {
      if (![...keys].some((k) => g.names.has(k))) continue;
      const isOwn =
        g.category === classKey ||
        g.category === "general" ||
        g.category === "shared" ||
        classKey === "other" ||
        classKey === "race" ||
        [...keys].some((k) => g.primary?.has(k));
      (isOwn ? own : reacting).push(g);
    }
    const owners = characters
      .filter((a) =>
        a.items.some(
          (i) => (i.type === "move" || i.type === "spell") && (keys.has(normalizeName(i.name)) || keys.has(normalizeName(i.flags?.babele?.originalName)))
        )
      )
      .map((a) => a.name);
    return { name, original: original ?? null, classKey, img: img ?? null, own, reacting, owners };
  };

  const groups = new Map();
  const ensureGroup = (key, label) => {
    if (!groups.has(key)) groups.set(key, { key, label, moves: [] });
    return groups.get(key);
  };
  const seen = new Set();

  // 1) 컴펜디엄 무브
  for (const pack of getMovePacks()) {
    const classKey = classKeyFromPack(pack);
    let docs = [];
    try {
      docs = await pack.getDocuments();
    } catch (err) {
      console.warn(`${MODULE_ID} | automation-catalog: failed to load ${pack.collection}`, err);
      continue;
    }
    const label = classKey === "basic" ? game.i18n.localize("DWAUTO.ClassAutomation.BasicGroup") : pack.title ?? classKey;
    const group = ensureGroup(classKey, label);
    for (const doc of docs) {
      if (doc.type !== "move") continue;
      const original = doc.flags?.babele?.originalName ?? null;
      group.moves.push(makeMove({ name: doc.name, original, classKey, img: doc.img }));
      seen.add(normalizeName(doc.name));
      if (original) seen.add(normalizeName(original));
    }
  }

  // 2) 종족 액션 (컴펜디엄에 없고 이 모듈이 데이터로 들고 있다)
  const raceGroup = ensureGroup("race", game.i18n.localize("DWAUTO.ClassAutomation.RaceGroup"));
  for (const cls of Object.values(RACE_CORE_MOVES)) {
    for (const race of cls.races ?? []) {
      raceGroup.moves.push(makeMove({ name: race.name, original: null, classKey: "race" }));
      seen.add(normalizeName(race.name));
    }
  }

  // 3) 월드 캐릭터가 가진 무브 중 어느 팩에도 없는 것(홈브루·직접 만든 액션)
  const otherGroup = ensureGroup("other", game.i18n.localize("DWAUTO.ClassAutomation.OtherGroup"));
  const otherSeen = new Set();
  for (const actor of characters) {
    for (const item of actor.items) {
      if (item.type !== "move") continue;
      const n = normalizeName(item.name);
      const o = normalizeName(item.flags?.babele?.originalName);
      if (seen.has(n) || (o && seen.has(o)) || otherSeen.has(n)) continue;
      otherSeen.add(n);
      otherGroup.moves.push(makeMove({ name: item.name, original: item.flags?.babele?.originalName ?? null, classKey: "other", img: item.img }));
    }
  }

  const ordered = [...groups.values()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a.key);
    const ib = GROUP_ORDER.indexOf(b.key);
    const ra = a.key === "race" ? 100 : a.key === "other" ? 101 : ia === -1 ? 50 : ia;
    const rb = b.key === "race" ? 100 : b.key === "other" ? 101 : ib === -1 ? 50 : ib;
    return ra - rb;
  });
  for (const g of ordered) g.moves.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  // 액션 업그레이드 안내(상대 액션 이름은 번역된 이름으로 보여준다)
  const translatedByOriginal = new Map();
  for (const g of ordered) for (const m of g.moves) {
    if (m.original) translatedByOriginal.set(normalizeName(m.original), m.name);
  }
  const upgradeNotes = buildUpgradeNotes();
  const upgradeOn = !!game.settings.get(MODULE_ID, MOVE_UPGRADE_FEATURE);
  for (const g of ordered) for (const m of g.moves) {
    const found = upgradeNotes.get(normalizeName(m.original)) ?? upgradeNotes.get(normalizeName(m.name)) ?? [];
    m.upgrades = found.map((n) => ({ ...n, otherName: translatedByOriginal.get(normalizeName(n.other)) ?? n.other, featureOn: upgradeOn }));
  }

  // 같은 기능이 걸린 다른 "자기 자동화" 액션(함께 켜지고 꺼지는 액션)
  const ownersOfFeature = new Map();
  for (const g of ordered) for (const m of g.moves) for (const f of m.own) {
    if (!ownersOfFeature.has(f.enableKey)) ownersOfFeature.set(f.enableKey, []);
    ownersOfFeature.get(f.enableKey).push(m.name);
  }

  return { groups: ordered, ownersOfFeature };
}
