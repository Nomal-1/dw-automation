import { MODULE_ID } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { logAutomation } from "../lib/automation-log.js";

// GM 스크린(apps/gm-screen-app.js)을 여는 버튼·단축키와, "진행" 탭의 6- 알림을 맡는다.
//
// 6- 알림: 캐릭터의 무브 판정 카드가 실패(6-)면 목록에 올린다. 던전월드에서 6-는 GM이 무브를
// 할 기회라, GM 스크린에서 바로 GM 무브·던전 무브를 뽑아 볼 수 있게 한다. 원하면 GM에게만 보이는
// 작은 알림도 띄운다(설정 "6- 알림 띄우기").

export const GM_SCREEN_SETTINGS = {
  ENABLED: "enableGmScreen",
  FAILURE_TOAST: "gmScreenFailureToast",
  FRONTS: "gmScreenFronts"
};

// ---- 전선(Front)·위험 ----
// 월드 설정에 저장한다(GM끼리 공유, 세션이 바뀌어도 남음). 형식:
//   [{ id, name, stakes, dangers: [{ id, name, impulse, doom, portents: [{ id, text, done }] }] }]
export function getFronts() {
  try {
    const value = game.settings.get(MODULE_ID, GM_SCREEN_SETTINGS.FRONTS);
    return Array.isArray(value) ? foundry.utils.deepClone(value) : [];
  } catch (err) {
    return [];
  }
}

export async function saveFronts(fronts) {
  if (!game.user.isGM) return;
  await game.settings.set(MODULE_ID, GM_SCREEN_SETTINGS.FRONTS, fronts);
}

const MAX_FAILURES = 20;
const failures = [];

export function getFailures() {
  return failures.slice().reverse();
}

export function dismissFailure(id) {
  const index = failures.findIndex((f) => f.id === id);
  if (index >= 0) failures.splice(index, 1);
  Hooks.callAll("dwAutomationLogChanged");
}

export function clearFailures() {
  failures.length = 0;
  Hooks.callAll("dwAutomationLogChanged");
}

function isEnabled() {
  try {
    return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, GM_SCREEN_SETTINGS.ENABLED);
  } catch (err) {
    return false;
  }
}

async function openGmScreen(tab = null) {
  const { GmScreenApp } = await import("../apps/gm-screen-app.js");
  return GmScreenApp.open(tab);
}

// 스포트라이트: 캐릭터별로 마지막 무브 판정 시각과 이번 접속의 판정 횟수
const spotlight = new Map(); // actorId -> { last, count }

export function getSpotlight(actorId) {
  return spotlight.get(actorId) ?? null;
}

function onCreateChatMessage(message) {
  if (!game.user.isGM || !isEnabled()) return;
  // 메시지는 모든 클라이언트에 오므로 GM 화면마다 따로 쌓는다(그 GM 화면에서만 보인다)
  const info = getMoveCardInfo(message);
  if (!info || info.actor?.type !== "character") return;
  const spot = spotlight.get(info.actor.id) ?? { last: 0, count: 0 };
  spotlight.set(info.actor.id, { last: Date.now(), count: spot.count + 1 });
  if (info.result !== "failure") {
    Hooks.callAll("dwAutomationLogChanged");
    return;
  }
  const entry = {
    id: foundry.utils.randomID(),
    time: Date.now(),
    actor: info.actor.name,
    move: info.title,
    total: Number.isFinite(info.rollTotal) ? String(info.rollTotal) : ""
  };
  failures.push(entry);
  if (failures.length > MAX_FAILURES) failures.shift();
  logAutomation("fail", game.i18n.format("DWAUTO.GmScreen.FailureLog", { move: entry.move }), { actorName: entry.actor, source: "failure" });
  if (game.settings.get(MODULE_ID, GM_SCREEN_SETTINGS.FAILURE_TOAST)) {
    ui.notifications.info(game.i18n.format("DWAUTO.GmScreen.FailureToast", { actor: entry.actor, move: entry.move }));
  }
}

function onGetSceneControlButtons(controls) {
  if (!game.user.isGM || !isEnabled()) return;
  const tool = {
    name: "dwautoGmScreen",
    title: "DWAUTO.GmScreen.Title",
    icon: "fas fa-book-open",
    visible: true,
    button: true,
    onChange: () => openGmScreen()
  };
  const group = controls.tokens ?? controls.token;
  if (!group?.tools) return;
  tool.order = Object.keys(group.tools).length;
  group.tools[tool.name] = tool;
}

/** init에서 부른다(설정·단축키는 init에서 등록해야 한다). */
export function registerGmScreenSettings() {
  game.settings.register(MODULE_ID, GM_SCREEN_SETTINGS.ENABLED, {
    name: "DWAUTO.GmScreen.EnableName",
    hint: "DWAUTO.GmScreen.EnableHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });
  game.settings.register(MODULE_ID, GM_SCREEN_SETTINGS.FAILURE_TOAST, {
    name: "DWAUTO.GmScreen.ToastName",
    hint: "DWAUTO.GmScreen.ToastHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, GM_SCREEN_SETTINGS.FRONTS, {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });
  game.keybindings.register(MODULE_ID, "openGmScreen", {
    name: "DWAUTO.GmScreen.KeybindName",
    hint: "DWAUTO.GmScreen.KeybindHint",
    editable: [{ key: "KeyG", modifiers: ["Alt"] }],
    restricted: true,
    onDown: () => {
      if (!isEnabled()) return false;
      openGmScreen();
      return true;
    }
  });
}

export function registerGmScreen() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("getSceneControlButtons", onGetSceneControlButtons);
}
