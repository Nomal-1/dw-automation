import { MODULE_ID } from "../constants.js";
import { SETTING_CATEGORIES } from "../data/settings-categories.js";
import { RACE_CORE_MOVES } from "../data/race-core-moves.js";

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

/** 등록 순서로 기능 묶음을 만든다. */
export function getFeatureGroups() {
  const groups = [];
  let current = null;
  for (const setting of game.settings.settings.values()) {
    if (setting.namespace !== MODULE_ID) continue;
    if (setting.type === Boolean && /^enable[A-Z]/.test(setting.key)) {
      current = {
        enableKey: setting.key,
        label: game.i18n.localize(setting.name ?? setting.key),
        hint: game.i18n.localize(setting.hint ?? ""),
        category: SETTING_CATEGORIES[setting.key] ?? "general",
        names: new Set()
      };
      groups.push(current);
      continue;
    }
    if (!current) continue;
    for (const name of namesInSetting(setting)) current.names.add(normalizeName(name));
  }
  return groups.filter((g) => g.names.size > 0);
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
      const isOwn = g.category === classKey || g.category === "general" || g.category === "shared" || classKey === "other";
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
    const group = ensureGroup(classKey, pack.title ?? classKey);
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

  // 같은 기능이 걸린 다른 "자기 자동화" 액션(함께 켜지고 꺼지는 액션)
  const ownersOfFeature = new Map();
  for (const g of ordered) for (const m of g.moves) for (const f of m.own) {
    if (!ownersOfFeature.has(f.enableKey)) ownersOfFeature.set(f.enableKey, []);
    ownersOfFeature.get(f.enableKey).push(m.name);
  }

  return { groups: ordered, ownersOfFeature };
}
