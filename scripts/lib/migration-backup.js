import { MODULE_ID, SETTINGS } from "../constants.js";

// 월드를 열 때마다 이 모듈의 여러 기능이 "설정표에 새 기본값 추가", "옛 필드 변환",
// "중복 행 삭제", "액터 플래그 보정" 같은 마이그레이션을 자동으로 돌린다. 한 번
// 저장되고 나면 변경 전 값으로 되돌릴 방법이 없었으므로, 모듈 버전이 바뀐 뒤 처음
// 월드를 열 때(마이그레이션이 돌기 직전) 이 모듈의 월드 설정값과 캐릭터 액터의
// 이 모듈 플래그를 월드 설정에 한 부 백업해 둔다. GM은 모듈 설정의 "마이그레이션
// 백업 복원" 도구에서 되돌릴 수 있고, 변경된 내용은 GM에게 한 번 요약해서 알려준다.

// 최근 몇 개의 백업만 남긴다(설정값 전체를 담으므로 무한정 쌓지 않는다).
const MAX_BACKUPS = 3;

// 백업 자체와 버전 기록은 백업 대상에서 뺀다(자기 자신을 중첩해서 담지 않도록).
const INTERNAL_KEYS = new Set([SETTINGS.MIGRATION_BACKUPS, SETTINGS.LAST_SEEN_VERSION]);

// 마이그레이션이 설정을 바꾼 뒤 이 시간(ms) 동안 추가 변경이 없으면 요약을 보낸다.
const REPORT_QUIET_MS = 8000;
const REPORT_FIRST_WAIT_MS = 20000;

function currentVersion() {
  return game.modules.get(MODULE_ID)?.version ?? "unknown";
}

// 설정값과 플래그는 전부 JSON으로 저장되는 값이라 JSON 복사로 충분하다(버전별로
// 이름이 바뀌는 deepClone 대신 어느 버전에서나 동작하는 방식).
function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function backedUpSettingKeys() {
  const keys = [];
  for (const [fullKey, setting] of game.settings.settings) {
    if (setting.namespace !== MODULE_ID) continue;
    if (setting.scope !== "world") continue;
    const key = fullKey.slice(MODULE_ID.length + 1);
    if (INTERNAL_KEYS.has(key)) continue;
    keys.push(key);
  }
  return keys;
}

// 동기적으로 읽는다(마이그레이션이 비동기로 값을 바꾸기 시작하기 전에 확정하기 위해).
export function captureSnapshot(label = "") {
  const settings = {};
  for (const key of backedUpSettingKeys()) {
    try {
      settings[key] = clone(game.settings.get(MODULE_ID, key));
    } catch (err) {
      // 읽을 수 없는 설정은 건너뛴다.
    }
  }

  const actorFlags = {};
  for (const actor of game.actors) {
    const flags = actor.flags?.[MODULE_ID];
    if (flags && Object.keys(flags).length > 0) actorFlags[actor.id] = clone(flags);
  }

  return {
    takenAt: Date.now(),
    label,
    fromVersion: game.settings.get(MODULE_ID, SETTINGS.LAST_SEEN_VERSION) || "unknown",
    toVersion: currentVersion(),
    settings,
    actorFlags
  };
}

export function getBackups() {
  const raw = game.settings.get(MODULE_ID, SETTINGS.MIGRATION_BACKUPS);
  return Array.isArray(raw) ? raw : [];
}

async function storeBackup(snapshot) {
  const next = [...getBackups(), snapshot].slice(-MAX_BACKUPS);
  await game.settings.set(MODULE_ID, SETTINGS.MIGRATION_BACKUPS, next);
}

function settingTitle(key) {
  const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
  const name = setting?.name ? game.i18n.localize(setting.name) : "";
  return name && name !== setting?.name ? name : key;
}

function describeChange(before, after) {
  const rowName = (row) => (row && typeof row === "object" ? (row.name ?? row.key ?? JSON.stringify(row)) : String(row));

  if (Array.isArray(before) && Array.isArray(after)) {
    const beforeNames = before.map(rowName);
    const afterNames = after.map(rowName);
    const added = afterNames.filter((n) => !beforeNames.includes(n));
    const removed = beforeNames.filter((n) => !afterNames.includes(n));
    const parts = [];
    if (added.length) parts.push(`+${added.length} (${added.slice(0, 4).join(", ")}${added.length > 4 ? ", …" : ""})`);
    if (removed.length) parts.push(`-${removed.length} (${removed.slice(0, 4).join(", ")}${removed.length > 4 ? ", …" : ""})`);
    if (!parts.length) parts.push(game.i18n.localize("DWAUTO.MigrationBackup.ValuesChanged"));
    return parts.join(" ");
  }
  return game.i18n.localize("DWAUTO.MigrationBackup.ValuesChanged");
}

export function diffAgainstSnapshot(snapshot) {
  const changes = [];
  for (const [key, before] of Object.entries(snapshot.settings)) {
    let after;
    try {
      after = game.settings.get(MODULE_ID, key);
    } catch (err) {
      continue;
    }
    if (foundry.utils.objectsEqual(before, after)) continue;
    changes.push({ key, title: settingTitle(key), detail: describeChange(before, after) });
  }

  let actorCount = 0;
  for (const actor of game.actors) {
    const before = snapshot.actorFlags[actor.id] ?? {};
    const after = actor.flags?.[MODULE_ID] ?? {};
    if (!foundry.utils.objectsEqual(before, after)) actorCount++;
  }

  return { changes, actorCount };
}

async function reportChanges(snapshot) {
  const { changes, actorCount } = diffAgainstSnapshot(snapshot);
  if (changes.length === 0 && actorCount === 0) return;

  console.log(`${MODULE_ID} | migration changes since ${snapshot.fromVersion}:`, changes, `actors changed: ${actorCount}`);

  const lines = changes.slice(0, 12).map((c) => `<li><b>${esc(c.title)}</b>: ${esc(c.detail)}</li>`);
  if (changes.length > 12) lines.push(`<li>… +${changes.length - 12}</li>`);
  if (actorCount > 0) {
    lines.push(`<li>${game.i18n.format("DWAUTO.MigrationBackup.ActorsChanged", { count: actorCount })}</li>`);
  }

  await ChatMessage.create({
    whisper: [game.user.id],
    speaker: { alias: game.i18n.localize("DWAUTO.MigrationBackup.Alias") },
    content:
      `<p>${game.i18n.format("DWAUTO.MigrationBackup.ReportIntro", { from: snapshot.fromVersion, to: snapshot.toVersion })}</p>` +
      `<ul>${lines.join("")}</ul>` +
      `<p>${game.i18n.localize("DWAUTO.MigrationBackup.ReportFooter")}</p>`
  });
}

// 마이그레이션 변경이 잠잠해질 때까지 기다렸다가 한 번만 요약한다.
function scheduleReport(snapshot) {
  let timer = null;
  let done = false;

  const fire = async () => {
    if (done) return;
    done = true;
    Hooks.off("updateSetting", onSettingChange);
    try {
      await reportChanges(snapshot);
    } catch (err) {
      console.warn(`${MODULE_ID} | migration report failed`, err);
    }
  };

  const arm = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(fire, ms);
  };

  const onSettingChange = (setting) => {
    if (done) return;
    const key = setting?.key ?? "";
    if (!key.startsWith(`${MODULE_ID}.`)) return;
    arm(REPORT_QUIET_MS);
  };

  Hooks.on("updateSetting", onSettingChange);
  arm(REPORT_FIRST_WAIT_MS);
}

// main.js에서 다른 기능들의 ready 훅보다 먼저 등록해야 한다 — 같은 ready 안에서
// 먼저 등록된 훅이 먼저 실행되므로, 여기서 설정값을 동기적으로 읽어 두면 다른
// 마이그레이션이 첫 await 뒤에 쓰기 시작하기 전의 값이 잡힌다.
export function registerMigrationBackup() {
  Hooks.once("ready", () => {
    if (!game.user.isGM) return;

    const last = game.settings.get(MODULE_ID, SETTINGS.LAST_SEEN_VERSION);
    const current = currentVersion();
    if (last === current) return;

    const snapshot = captureSnapshot();

    (async () => {
      try {
        await storeBackup(snapshot);
        // 백업이 저장된 뒤에만 버전을 기록한다 — 저장에 실패하면 다음 로드에서 다시 시도한다.
        await game.settings.set(MODULE_ID, SETTINGS.LAST_SEEN_VERSION, current);
        scheduleReport(snapshot);
      } catch (err) {
        console.warn(`${MODULE_ID} | could not store the pre-migration backup`, err);
      }
    })();
  });
}

// 복원: 현재 상태를 먼저 "복원 직전" 백업으로 남긴 뒤(되돌릴 수 있게), 선택한
// 백업의 설정값과 액터 플래그를 덮어쓴다.
export async function restoreBackup(takenAt) {
  const backup = getBackups().find((b) => b.takenAt === takenAt);
  if (!backup) throw new Error("backup not found");

  const before = captureSnapshot(game.i18n.localize("DWAUTO.MigrationBackup.PreRestoreLabel"));
  await storeBackup(before);

  let settingsRestored = 0;
  for (const [key, value] of Object.entries(backup.settings)) {
    if (!game.settings.settings.has(`${MODULE_ID}.${key}`)) continue;
    await game.settings.set(MODULE_ID, key, clone(value));
    settingsRestored++;
  }

  let actorsRestored = 0;
  for (const [actorId, flags] of Object.entries(backup.actorFlags ?? {})) {
    const actor = game.actors.get(actorId);
    if (!actor) continue;

    // 병합이 아니라 교체여야 한다 — 먼저 지금 있는 이 모듈 플래그 키를 지우고, 백업 값을 다시 쓴다.
    const current = actor.flags?.[MODULE_ID] ?? {};
    const removal = {};
    for (const key of Object.keys(current)) removal[`flags.${MODULE_ID}.-=${key}`] = null;
    if (Object.keys(removal).length) await actor.update(removal);
    await actor.update({ [`flags.${MODULE_ID}`]: clone(flags) });
    actorsRestored++;
  }

  return { settingsRestored, actorsRestored };
}
