import { MODULE_ID } from "../constants.js";
import { GM_MOVES, DUNGEON_MOVES, GM_AGENDA, GM_PRINCIPLES, WHEN_TO_MOVE } from "../data/gm-moves.js";
import { PARTY_STATUS_FLAGS } from "../data/party-status.js";
import { getAutomationLog, getSavedErrors, clearAutomationLog, formatLog } from "../lib/automation-log.js";
import { getFailures, clearFailures, dismissFailure, getSpotlight } from "../features/gm-screen.js";
import { confirmDialog } from "../lib/dialogs.js";
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
 * - 파티: 캐릭터별 HP·장갑·XP·약화·대기 상태와 스포트라이트(마지막 판정 시각)
 * - 전투: 지금 씬의 NPC 토큰 HP 판(피해·회복, 장갑 자동 반영)
 * - 도구: 인스턴트 NPC, 괴물 만들기, 무작위 표, 다른 창 바로 열기
 * - 참고: GM 강령·원칙·무브
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
    position: { width: 600, height: 640 },
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
      openSheet: GmScreenApp.#onOpenSheet,
      clearPending: GmScreenApp.#onClearPending,
      applyHp: GmScreenApp.#onApplyHp,
      focusToken: GmScreenApp.#onFocusToken,
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
      ["party", "fa-users", L("TabParty"), 0],
      ["combat", "fa-skull", L("TabCombat"), 0],
      ["tools", "fa-toolbox", L("TabTools"), 0],
      ["reference", "fa-book", L("TabReference"), 0],
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
    else if (this.#tab === "party") body = this.#renderParty();
    else if (this.#tab === "combat") body = this.#renderCombat();
    else if (this.#tab === "tools") body = await this.#renderTools();
    else if (this.#tab === "reference") body = this.#renderReference();
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
      if (this.rendered && ["progress", "party", "log"].includes(this.#tab)) this.render();
    });
    // 파티·전투 탭은 액터·토큰이 바뀌면 다시 그린다(잦은 갱신은 묶어서 한 번)
    const refresh = () => {
      if (!this.rendered || !["party", "combat"].includes(this.#tab)) return;
      clearTimeout(this.#refreshTimer);
      this.#refreshTimer = setTimeout(() => this.render(), 200);
    };
    this.#docHooks = ["updateActor", "updateToken", "createToken", "deleteToken", "canvasReady"].map((name) => [name, Hooks.on(name, refresh)]);
  }

  _onClose(options) {
    super._onClose(options);
    if (this.#hookId !== null) Hooks.off("dwAutomationLogChanged", this.#hookId);
    this.#hookId = null;
    for (const [name, id] of this.#docHooks) Hooks.off(name, id);
    this.#docHooks = [];
  }

  #docHooks = [];
  #refreshTimer = null;

  // ---- 파티 ----
  #partyActors() {
    const chars = game.actors.filter((a) => a.type === "character");
    const owned = chars.filter((a) => a.hasPlayerOwner);
    return (owned.length ? owned : chars).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  #statusChips(actor) {
    const flags = actor.flags?.[MODULE_ID] ?? {};
    const chips = [];
    for (const def of PARTY_STATUS_FLAGS) {
      const value = flags[def.flag];
      if (value === undefined || value === null || value === false || value === 0) continue;
      const label = L(`Status.${def.flag}`);
      if (def.kind === "number") {
        if (Number(value) > 0) chips.push({ text: `${label} ${value}`, clear: def.clear });
      } else if (def.kind === "bonus") {
        const amount = Number(value?.amount) || 0;
        if (amount) chips.push({ text: `${label} ${amount > 0 ? "+" : ""}${amount}${value?.source ? ` (${value.source})` : ""}`, clear: def.clear });
      } else chips.push({ text: label, clear: def.clear });
    }
    return chips;
  }

  #renderParty() {
    const actors = this.#partyActors();
    if (!actors.length) return `<p class="empty">${esc(L("NoParty"))}</p>`;
    const now = Date.now();
    const spots = actors.map((a) => getSpotlight(a.id));
    const anyActed = spots.some(Boolean);
    const oldest = anyActed ? Math.min(...spots.map((sp) => sp?.last ?? 0)) : null;
    const rows = actors
      .map((a, i) => {
        const sys = a.system ?? {};
        const hp = sys.attributes?.hp ?? {};
        const xp = sys.attributes?.xp ?? {};
        const debilities = Object.entries(sys.abilities ?? {})
          .filter(([, v]) => v?.debility)
          .map(([k, v]) => v.debilityLabel ?? CONFIG.DW?.debilities?.[k] ?? k);
        const chips = this.#statusChips(a);
        const spot = spots[i];
        const quiet = anyActed && (spot?.last ?? 0) === oldest;
        const spotText = spot ? L("SpotlightAgo", { min: Math.floor((now - spot.last) / 60000), count: spot.count }) : L("SpotlightNone");
        const lowHp = Number(hp.max) > 0 && Number(hp.value) <= Number(hp.max) / 3;
        return `<li class="dwauto-gs-pc${quiet ? " quiet" : ""}">
          <div class="head">
            <a data-action="openSheet" data-actor="${a.id}"><b>${esc(a.name)}</b></a>
            <span class="${lowHp ? "low" : ""}"><i class="fas fa-heart"></i> ${esc(hp.value ?? "?")}/${esc(hp.max ?? "?")}</span>
            <span><i class="fas fa-shield"></i> ${esc(sys.attributes?.ac?.value ?? 0)}</span>
            <span><i class="fas fa-star"></i> ${esc(xp.value ?? 0)}/${esc(xp.max ?? "?")}</span>
            <span class="spot${quiet ? " quiet" : ""}" title="${esc(L("SpotlightHint"))}"><i class="fas fa-lightbulb"></i> ${esc(spotText)}</span>
          </div>
          ${debilities.length ? `<div class="debility"><i class="fas fa-user-injured"></i> ${esc(debilities.join(", "))}</div>` : ""}
          ${
            chips.length
              ? `<div class="chips">${chips.map((c) => `<span class="chip${c.clear ? " pending" : ""}">${esc(c.text)}</span>`).join("")}
                 ${chips.some((c) => c.clear) ? `<button type="button" class="icon" data-action="clearPending" data-actor="${a.id}" title="${esc(L("ClearPending"))}"><i class="fas fa-eraser"></i></button>` : ""}</div>`
              : ""
          }
        </li>`;
      })
      .join("");
    return `<p class="hint">${esc(L("PartyHint"))}</p><ul class="dwauto-gs-list">${rows}</ul>`;
  }

  // ---- 전투 ----
  #renderCombat() {
    const scene = canvas?.scene;
    if (!scene) return `<p class="empty">${esc(L("NoScene"))}</p>`;
    const tokens = scene.tokens.filter((t) => t.actor && t.actor.type === "npc");
    if (!tokens.length) return `<p class="empty">${esc(L("NoEnemies", { scene: scene.name }))}</p>`;
    const rows = tokens
      .map((t) => {
        const sys = t.actor.system ?? {};
        const hp = sys.attributes?.hp ?? {};
        const armor = Number(sys.attributes?.ac?.value) || 0;
        const dead = Number(hp.value) <= 0;
        return `<li class="dwauto-gs-enemy${dead ? " dead" : ""}${t.hidden ? " hidden" : ""}">
          <a data-action="focusToken" data-token="${t.id}" title="${esc(L("FocusToken"))}"><b>${esc(t.name)}</b></a>
          ${t.hidden ? `<i class="fas fa-eye-slash" title="${esc(L("HiddenToken"))}"></i>` : ""}
          <span><i class="fas fa-heart"></i> ${esc(hp.value ?? "?")}/${esc(hp.max ?? "?")}</span>
          <span><i class="fas fa-shield"></i> ${armor}</span>
          <span class="hp-controls">
            <input type="number" min="0" value="" placeholder="0" data-hp-input="${t.id}">
            <label title="${esc(L("IgnoreArmorHint"))}"><input type="checkbox" data-ignore-armor="${t.id}"> ${esc(L("IgnoreArmor"))}</label>
            <button type="button" data-action="applyHp" data-token="${t.id}" data-mode="damage">${esc(L("Damage"))}</button>
            <button type="button" data-action="applyHp" data-token="${t.id}" data-mode="heal">${esc(L("Heal"))}</button>
          </span>
        </li>`;
      })
      .join("");
    return `<p class="hint">${esc(L("CombatHint", { scene: scene.name }))}</p><ul class="dwauto-gs-list">${rows}</ul>`;
  }

  // ---- 참고 ----
  #renderReference() {
    const block = (title, items, open = false) =>
      `<details class="dwauto-gs-moves"${open ? " open" : ""}><summary>${esc(title)}</summary><ol>${items.map((m) => `<li>${esc(m)}</li>`).join("")}</ol></details>`;
    return `${block(L("AgendaTitle"), GM_AGENDA, true)}
      ${block(L("PrinciplesTitle"), GM_PRINCIPLES, true)}
      ${block(L("WhenToMoveTitle"), WHEN_TO_MOVE)}
      ${block(L("GmMovesTitle"), GM_MOVES)}
      ${block(L("DungeonMovesTitle"), DUNGEON_MOVES)}
      <p class="hint">${esc(L("ReferenceCredit"))}</p>`;
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

  static #onOpenSheet(event, target) {
    game.actors.get(target.dataset.actor)?.sheet?.render(true);
  }

  static async #onClearPending(event, target) {
    const actor = game.actors.get(target.dataset.actor);
    if (!actor) return;
    const ok = await confirmDialog({ title: L("ClearPending"), content: `<p>${esc(L("ClearPendingConfirm", { name: actor.name }))}</p>`, defaultYes: false });
    if (!ok) return;
    for (const def of PARTY_STATUS_FLAGS) {
      if (def.clear && actor.getFlag(MODULE_ID, def.flag) !== undefined) await actor.unsetFlag(MODULE_ID, def.flag);
    }
  }

  static async #onApplyHp(event, target) {
    const token = canvas?.scene?.tokens.get(target.dataset.token);
    const actor = token?.actor;
    if (!actor) return;
    const input = this.element.querySelector(`input[data-hp-input="${target.dataset.token}"]`);
    const amount = Math.max(0, parseInt(input?.value, 10) || 0);
    if (!amount) return;
    const hp = actor.system?.attributes?.hp ?? {};
    const current = Number(hp.value) || 0;
    const max = Number(hp.max) || current;
    let next;
    if (target.dataset.mode === "heal") next = Math.min(max, current + amount);
    else {
      const ignoreArmor = this.element.querySelector(`input[data-ignore-armor="${target.dataset.token}"]`)?.checked;
      const armor = ignoreArmor ? 0 : Number(actor.system?.attributes?.ac?.value) || 0;
      next = Math.max(0, current - Math.max(0, amount - armor));
    }
    await actor.update({ "system.attributes.hp.value": next });
  }

  static #onFocusToken(event, target) {
    const token = canvas?.scene?.tokens.get(target.dataset.token);
    if (!token?.object) return;
    token.object.control({ releaseOthers: true });
    canvas.animatePan({ x: token.object.center.x, y: token.object.center.y });
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
