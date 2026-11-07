import { MODULE_ID, SETTINGS } from "../constants.js";

// 한글화(dungeonworld-ko)에서 오타가 나 있던 액션 이름을 바로잡을 때, 이미 그 이름으로
// 저장된 이 모듈의 설정값과 캐릭터/월드 아이템 이름이 새 이름과 어긋나 자동화가 끊긴다.
// 옛 이름 -> 새 이름 표를 두고, 월드를 열 때 정확히 일치하는 이름만 새 이름으로 바꾼다.
// (마이그레이션 직전 백업은 lib/migration-backup.js가 먼저 만들어 둔다.)
export const LEGACY_NAME_FIXES = {
  "시그라지는 인언": "사그라지는 인연"
};

const INTERNAL_KEYS = new Set([SETTINGS.MIGRATION_BACKUPS, SETTINGS.LAST_SEEN_VERSION]);

function fixString(text) {
  if (Object.hasOwn(LEGACY_NAME_FIXES, text)) return LEGACY_NAME_FIXES[text];
  if (!text.includes(",")) return text;

  // 쉼표로 이어진 이름 목록 설정: 항목 하나하나를 정확히 비교한다.
  let changed = false;
  const parts = text.split(",").map((part) => {
    const trimmed = part.trim();
    if (Object.hasOwn(LEGACY_NAME_FIXES, trimmed)) {
      changed = true;
      return LEGACY_NAME_FIXES[trimmed];
    }
    return part;
  });
  return changed ? parts.join(",") : text;
}

function fixDeep(value) {
  if (typeof value === "string") {
    const next = fixString(value);
    return { value: next, changed: next !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = fixDeep(item);
      if (result.changed) changed = true;
      return result.value;
    });
    return { value: changed ? next : value, changed };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      const result = fixDeep(item);
      if (result.changed) changed = true;
      next[key] = result.value;
    }
    return { value: changed ? next : value, changed };
  }
  return { value, changed: false };
}

export async function applyLegacyNameFixes() {
  if (!game.user.isGM) return;

  let settingsFixed = 0;
  for (const [fullKey, setting] of game.settings.settings) {
    if (setting.namespace !== MODULE_ID || setting.scope !== "world") continue;
    const key = fullKey.slice(MODULE_ID.length + 1);
    if (INTERNAL_KEYS.has(key)) continue;

    const current = game.settings.get(MODULE_ID, key);
    const result = fixDeep(current);
    if (!result.changed) continue;
    await game.settings.set(MODULE_ID, key, result.value);
    settingsFixed++;
  }

  let itemsFixed = 0;
  const renameIn = async (parent, items) => {
    const updates = items
      .filter((item) => Object.hasOwn(LEGACY_NAME_FIXES, item.name))
      .map((item) => ({ _id: item.id, name: LEGACY_NAME_FIXES[item.name] }));
    if (!updates.length) return;
    await parent.updateEmbeddedDocuments("Item", updates);
    itemsFixed += updates.length;
  };
  for (const actor of game.actors) await renameIn(actor, actor.items.contents);
  const worldUpdates = game.items.filter((item) => Object.hasOwn(LEGACY_NAME_FIXES, item.name));
  for (const item of worldUpdates) {
    await item.update({ name: LEGACY_NAME_FIXES[item.name] });
    itemsFixed++;
  }

  if (settingsFixed || itemsFixed) {
    console.log(`${MODULE_ID} | legacy names fixed: ${settingsFixed} setting(s), ${itemsFixed} item(s)`);
  }
}

export function registerLegacyNameFixes() {
  Hooks.once("ready", () => {
    applyLegacyNameFixes().catch((err) => console.warn(`${MODULE_ID} | legacy name fix failed`, err));
  });
}
