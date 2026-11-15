import { MODULE_ID } from "../constants.js";

// GM 스크린의 "기록" 탭이 보여주는 자동화 기록.
//
// - 자동화가 채팅에 "액션 적용!" 같은 안내를 남길 때(lib/announce.js) 한 줄씩 기록한다.
// - 이 모듈이 콘솔에 남기는 오류·경고(`dw-automation | …`로 시작)와, 이 모듈 파일에서 난
//   처리되지 않은 오류도 기록한다. 세션 중에 F12 콘솔을 열지 않아도 무엇이 실패했는지 보인다.
// - 기록은 이 브라우저의 메모리에만 있다(새로고침하면 사라짐). 오류·경고만은 다시 볼 수 있게
//   이 브라우저의 localStorage에 최근 100개를 남긴다. 서버·월드 데이터에는 쓰지 않는다.

const MAX_ENTRIES = 500;
const MAX_SAVED_ERRORS = 100;
const STORAGE_KEY = `${MODULE_ID}.errorLog`;
const entries = [];

const stripHtml = (html) =>
  String(html ?? "")
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function loadSavedErrors() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (err) {
    return [];
  }
}

function saveError(entry) {
  try {
    const saved = loadSavedErrors();
    saved.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(-MAX_SAVED_ERRORS)));
  } catch (err) {
    // 저장 공간이 없으면 메모리 기록만 쓴다
  }
}

let notifyTimer = null;
function notifyChange() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    Hooks.callAll("dwAutomationLogChanged");
  }, 150);
}

/**
 * 기록을 한 줄 남긴다.
 * @param {"info"|"warn"|"error"|"fail"} level  fail = 6- 결과(GM 무브 기회)
 * @param {string} text   HTML이 섞여 있어도 글자만 남긴다
 * @param {object} [extra] { actor, source }
 */
export function logAutomation(level, text, extra = {}) {
  const entry = {
    time: Date.now(),
    level,
    text: stripHtml(text).slice(0, 600),
    actor: extra.actor?.name ?? extra.actorName ?? null,
    source: extra.source ?? null
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  if (level === "error" || level === "warn") saveError(entry);
  notifyChange();
  return entry;
}

export function getAutomationLog() {
  return entries.slice();
}

/** 지난 세션까지 포함해 이 브라우저에 남아 있는 오류·경고(최근 100개) */
export function getSavedErrors() {
  return loadSavedErrors();
}

export function clearAutomationLog({ savedErrors = false } = {}) {
  entries.length = 0;
  if (savedErrors) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // 무시
    }
  }
  notifyChange();
}

/** 기록을 글자로(복사해서 붙여 넣기용) */
export function formatLog(list) {
  return list
    .map((e) => {
      const t = new Date(e.time).toLocaleTimeString(game.i18n.lang);
      return `[${t}] ${e.level.toUpperCase()}${e.actor ? ` ${e.actor}` : ""}: ${e.text}`;
    })
    .join("\n");
}

function describeArgs(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.message}${a.stack ? ` (${String(a.stack).split("\n")[1]?.trim() ?? ""})` : ""}`;
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a).slice(0, 200);
      } catch (err) {
        return String(a);
      }
    })
    .join(" ");
}

let installed = false;

/** init에서 한 번 부른다. 콘솔 오류·경고와 처리되지 않은 오류를 기록에 넣는다. */
export function registerAutomationLog() {
  if (installed) return;
  installed = true;
  const prefix = `${MODULE_ID} |`;

  for (const [method, level] of [
    ["error", "error"],
    ["warn", "warn"]
  ]) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
      try {
        if (typeof args[0] === "string" && args[0].startsWith(prefix)) {
          logAutomation(level, describeArgs(args).slice(prefix.length).trim(), { source: "console" });
        }
      } catch (err) {
        // 기록이 실패해도 원래 출력은 해야 한다
      }
      return original(...args);
    };
  }

  const fromThisModule = (stack) => String(stack ?? "").includes(`/modules/${MODULE_ID}/`);
  window.addEventListener("error", (event) => {
    if (fromThisModule(event.error?.stack ?? event.filename)) logAutomation("error", describeArgs([event.error ?? event.message]), { source: "uncaught" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (fromThisModule(event.reason?.stack)) logAutomation("error", describeArgs([event.reason]), { source: "uncaught" });
  });
}
