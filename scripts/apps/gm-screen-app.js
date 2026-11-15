import { MODULE_ID } from "../constants.js";
import { GM_MOVES, DUNGEON_MOVES } from "../data/gm-moves.js";
import { getAutomationLog, getSavedErrors, clearAutomationLog, formatLog } from "../lib/automation-log.js";
import { getFailures, clearFailures, dismissFailure } from "../features/gm-screen.js";
import { createInstantNpc } from "../features/npc-generator.js";
import { createMonsterAndBuild } from "../features/monster-generator.js";

const { ApplicationV2 } = foundry.applications.api;

const L = (key, data) => (data ? game.i18n.format(`DWAUTO.GmScreen.${key}`, data) : game.i18n.localize(`DWAUTO.GmScreen.${key}`));
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const timeOf = (t) => new Date(t).toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// 무작위 표: 던전월드 시스템의 표 컴펜디엄 + 월드에 있는 표
const TABLE_PACKS = ["dungeonworld.tables", "dungeonworld.rollable-tables"];

/**
 * GM 스크린(ApplicationV2). 세션 중에 GM이 옆에 띄워 두는 창.
 * - 진행: 6- 결과 알림과 GM 무브·던전 무브 뽑기
 * - 도구: 인스턴트 NPC, 괴물 만들기, 무작위 표, 다른 창 바로 열기
 * - 기록: 자동화 기록과 오류(lib/automation-log.js), 복사 버튼
 */
export class GmScreenApp extends ApplicationV2 {
  #tab = "progress";
  #logFilter = "all";
  #suggestions = new Map(); // failure id -> 뽑은 무브
  #hookId = null;

  static DEFAULT_OPTIONS = {
    id: "dwauto-gm-screen",
    classes: ["dwauto-gm-screen"],
    window: { title: "DWAUTO.GmScreen.Title", icon: "fas fa-book-open", resizable: true },
    position: { width: 520, height: 620 },
    actions: {
      // "tab"은 ApplicationV2가 원래 쓰는 탭 전환 동작 이름이라 겹치지 않게 다른 이름을 쓴다
      switchTab: GmScreenApp.#onTab,
      suggest: GmScreenApp.#onSuggest,
      dismiss: GmScreenApp.#onDismiss,
      clearFailures: GmScreenApp.#onClearFailures,
      createNpc: GmScreenApp.#onCreateNpc,
      createMonster: GmScreenApp.#onCreateMonster,
      drawTable: GmScreenApp.#onDrawTable,
      openMenu: GmScreenApp.#onOpenMenu,
      openBgm: GmScreenApp.#onOpenBgm,
      logFilter: GmScreenApp.#onLogFilter,
      copyLog: GmScreenApp.#onCopyLog,
      clearLog: GmScreenApp.#onClearLog
    }
  };

  /** 이미 열려 있으면 앞으로, 아니면 연다. tab을 주면 그 탭으로. */
  static open(tab = null) {
    const existing = foundry.applications.instances.get("dwauto-gm-screen");
    const app = existing ?? new GmScreenApp();
    if (tab) app.#tab = tab;
    if (app.rendered) {
      app.bringToFront?.();
      app.render();
    } else app.render({ force: true });
    return app;
  }

  async _renderHTML() {
    const tabs = [
      ["progress", "fa-dice", L("TabProgress"), getFailures().length],
      ["tools", "fa-toolbox", L("TabTools"), 0],
      ["log", "fa-list", L("TabLog"), getAutomationLog().filter((e) => e.level === "error").length]
    ]
      .map(
        ([key, icon, label, count]) =>
          `<button type="button" class="dwauto-gs-tab${this.#tab === key ? " active" : ""}" data-action="switchTab" data-tab="${key}">
            <i class="fas ${icon}"></i> ${esc(label)}${count ? ` <span class="badge">${count}</span>` : ""}</button>`
      )
      .join("");
    let body = "";
    if (this.#tab === "progress") body = this.#renderProgress();
    else if (this.#tab === "tools") body = await this.#renderTools();
    else body = this.#renderLog();
    return `<nav class="dwauto-gs-tabs">${tabs}</nav><section class="dwauto-gs-body">${body}</section>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector(".dwauto-gs-body")?.scrollTop ?? 0;
    content.innerHTML = result;
    const body = content.querySelector(".dwauto-gs-body");
    if (body) body.scrollTop = scroll;
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    // 기록·6- 알림이 바뀌면 열린 창을 다시 그린다
    this.#hookId = Hooks.on("dwAutomationLogChanged", () => {
      if (this.rendered && this.#tab !== "tools") this.render();
    });
  }

  _onClose(options) {
    super._onClose(options);
    if (this.#hookId !== null) Hooks.off("dwAutomationLogChanged", this.#hookId);
    this.#hookId = null;
  }

  // ---- 진행 ----
  #renderProgress() {
    const failures = getFailures();
    const list = failures.length
      ? failures
          .map((f) => {
            const suggestion = this.#suggestions.get(f.id);
            return `<li class="dwauto-gs-fail">
              <div class="head"><b>${esc(f.actor)}</b> · ${esc(f.move)} <span class="total">${esc(f.total ?? "")}</span>
                <span class="time">${timeOf(f.time)}</span>
                <button type="button" class="icon" data-action="dismiss" data-id="${f.id}" title="${esc(L("Dismiss"))}"><i class="fas fa-xmark"></i></button></div>
              <div class="actions">
                <button type="button" data-action="suggest" data-id="${f.id}" data-kind="gm"><i class="fas fa-dice"></i> ${esc(L("SuggestGm"))}</button>
                <button type="button" data-action="suggest" data-id="${f.id}" data-kind="dungeon"><i class="fas fa-dungeon"></i> ${esc(L("SuggestDungeon"))}</button>
              </div>
              ${suggestion ? `<div class="suggestion"><i class="fas fa-arrow-right"></i> ${esc(suggestion)}</div>` : ""}
            </li>`;
          })
          .join("")
      : `<p class="empty">${esc(L("NoFailures"))}</p>`;
    const moveList = (title, moves) =>
      `<details class="dwauto-gs-moves"><summary>${esc(title)}</summary><ol>${moves.map((m) => `<li>${esc(m)}</li>`).join("")}</ol></details>`;
    return `<div class="dwauto-gs-section">
        <div class="dwauto-gs-row"><h3>${esc(L("FailuresTitle"))}</h3>
          ${failures.length ? `<button type="button" data-action="clearFailures">${esc(L("ClearAll"))}</button>` : ""}</div>
        <p class="hint">${esc(L("FailuresHint"))}</p>
        <ul class="dwauto-gs-list">${list}</ul>
      </div>
      ${moveList(L("GmMovesTitle"), GM_MOVES)}
      ${moveList(L("DungeonMovesTitle"), DUNGEON_MOVES)}`;
  }

  // ---- 도구 ----
  async #renderTools() {
    const tables = [];
    for (const id of TABLE_PACKS) {
      const pack = game.packs.get(id);
      if (!pack) continue;
      try {
        for (const e of await pack.getIndex()) tables.push({ uuid: e.uuid ?? `Compendium.${id}.RollTable.${e._id}`, name: e.name, from: pack.title });
      } catch (err) {
        console.warn(`${MODULE_ID} | gm screen: table index failed for ${id}`, err);
      }
    }
    for (const t of game.tables) tables.push({ uuid: t.uuid, name: t.name, from: L("WorldTables") });
    const tableButtons = tables.length
      ? tables
          .map((t) => `<button type="button" data-action="drawTable" data-uuid="${esc(t.uuid)}" title="${esc(t.from)}"><i class="fas fa-dice-d20"></i> ${esc(t.name)}</button>`)
          .join("")
      : `<p class="empty">${esc(L("NoTables"))}</p>`;
    const bgm = game.modules.get("bgm-master")?.active && game.bgmMaster;
    return `<div class="dwauto-gs-section">
        <h3>${esc(L("CreateTitle"))}</h3>
        <div class="dwauto-gs-buttons">
          <button type="button" data-action="createNpc"><i class="fas fa-user-plus"></i> ${esc(L("CreateNpc"))}</button>
          <button type="button" data-action="createMonster"><i class="fas fa-dragon"></i> ${esc(L("CreateMonster"))}</button>
        </div>
        <p class="hint">${esc(L("CreateHint"))}</p>
      </div>
      <div class="dwauto-gs-section">
        <h3>${esc(L("TablesTitle"))}</h3>
        <div class="dwauto-gs-buttons">${tableButtons}</div>
      </div>
      <div class="dwauto-gs-section">
        <h3>${esc(L("OpenTitle"))}</h3>
        <div class="dwauto-gs-buttons">
          <button type="button" data-action="openMenu" data-menu="classAutomationMenu"><i class="fas fa-list-check"></i> ${esc(L("OpenClassAutomation"))}</button>
          ${bgm ? `<button type="button" data-action="openBgm"><i class="fas fa-music"></i> ${esc(L("OpenBgm"))}</button>` : ""}
        </div>
      </div>`;
  }

  // ---- 기록 ----
  #logEntries() {
    if (this.#logFilter === "saved") return getSavedErrors().slice().reverse();
    const all = getAutomationLog().slice().reverse();
    return this.#logFilter === "errors" ? all.filter((e) => e.level === "error" || e.level === "warn") : all;
  }

  #renderLog() {
    const icons = { info: "fa-circle-check", warn: "fa-triangle-exclamation", error: "fa-circle-xmark", fail: "fa-dice" };
    const entries = this.#logEntries();
    const filters = [
      ["all", L("FilterAll")],
      ["errors", L("FilterErrors")],
      ["saved", L("FilterSaved")]
    ]
      .map(([k, label]) => `<button type="button" class="${this.#logFilter === k ? "active" : ""}" data-action="logFilter" data-filter="${k}">${esc(label)}</button>`)
      .join("");
    const rows = entries.length
      ? entries
          .map(
            (e) => `<li class="dwauto-gs-log ${esc(e.level)}">
              <i class="fas ${icons[e.level] ?? "fa-circle"}"></i>
              <span class="time">${timeOf(e.time)}</span>
              ${e.actor ? `<b>${esc(e.actor)}</b>` : ""}
              <span class="text">${esc(e.text)}</span></li>`
          )
          .join("")
      : `<p class="empty">${esc(L("NoLog"))}</p>`;
    return `<div class="dwauto-gs-row dwauto-gs-filters">${filters}
        <span class="spacer"></span>
        <button type="button" data-action="copyLog"><i class="fas fa-copy"></i> ${esc(L("Copy"))}</button>
        <button type="button" data-action="clearLog"><i class="fas fa-trash"></i> ${esc(L("Clear"))}</button></div>
      <p class="hint">${esc(L(this.#logFilter === "saved" ? "SavedHint" : "LogHint"))}</p>
      <ul class="dwauto-gs-list">${rows}</ul>`;
  }

  // ---- 동작 ----
  static #onTab(event, target) {
    this.#tab = target.dataset.tab;
    this.render();
  }

  static #onSuggest(event, target) {
    const list = target.dataset.kind === "dungeon" ? DUNGEON_MOVES : GM_MOVES;
    this.#suggestions.set(target.dataset.id, pick(list));
    this.render();
  }

  static #onDismiss(event, target) {
    dismissFailure(target.dataset.id);
    this.#suggestions.delete(target.dataset.id);
  }

  static #onClearFailures() {
    clearFailures();
    this.#suggestions.clear();
  }

  static async #onCreateNpc() {
    await createInstantNpc();
  }

  static async #onCreateMonster() {
    await createMonsterAndBuild();
  }

  static async #onDrawTable(event, target) {
    try {
      const table = await fromUuid(target.dataset.uuid);
      await table?.draw();
    } catch (err) {
      console.error(`${MODULE_ID} | gm screen: table draw failed`, err);
    }
  }

  static #onOpenMenu(event, target) {
    const menu = game.settings.menus.get(`${MODULE_ID}.${target.dataset.menu}`);
    if (menu?.type) new menu.type().render({ force: true });
  }

  static #onOpenBgm() {
    const app = game.bgmMaster;
    if (!app) return;
    if (app.minimized) app.maximize();
    app.render({ force: true });
  }

  static #onLogFilter(event, target) {
    this.#logFilter = target.dataset.filter;
    this.render();
  }

  static async #onCopyLog() {
    const text = formatLog(this.#logEntries().slice().reverse());
    try {
      await navigator.clipboard.writeText(text);
      ui.notifications.info(L("Copied"));
    } catch (err) {
      // 클립보드 권한이 없으면 고를 수 있는 창으로 보여준다
      foundry.applications.api.DialogV2.prompt({
        window: { title: L("Copy") },
        content: `<textarea style="width:100%;height:300px">${esc(text)}</textarea>`,
        rejectClose: false
      });
    }
  }

  static #onClearLog() {
    clearAutomationLog({ savedErrors: this.#logFilter === "saved" });
  }
}
