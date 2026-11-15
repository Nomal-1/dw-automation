import { MODULE_ID } from "../constants.js";
import { GM_MOVES, DUNGEON_MOVES, GM_AGENDA, GM_PRINCIPLES, WHEN_TO_MOVE } from "../data/gm-moves.js";
import { PARTY_STATUS_FLAGS } from "../data/party-status.js";
import { getAutomationLog, getSavedErrors, clearAutomationLog, formatLog } from "../lib/automation-log.js";
import { getFailures, clearFailures, dismissFailure, getSpotlight, getFronts, saveFronts } from "../features/gm-screen.js";
import { confirmDialog } from "../lib/dialogs.js";
import { getPendingRequests } from "../lib/gm-query.js";
import { announceActionApplied } from "../lib/announce.js";
import { createInstantNpc } from "../features/npc-generator.js";
import { createMonsterAndBuild } from "../features/monster-generator.js";

const { ApplicationV2 } = foundry.applications.api;

const L = (key, data) => (data ? game.i18n.format(`DWAUTO.GmScreen.${key}`, data) : game.i18n.localize(`DWAUTO.GmScreen.${key}`));
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const timeOf = (t) => new Date(t).toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const pick = (list) => list[Math.floor(Math.random() * list.length)];
// HP 막대: 남은 비율에 따라 색이 바뀐다(1/3 이하 위험, 2/3 이하 주의)
const hpBar = (hp) => {
  const max = Number(hp?.max) || 0;
  const value = Math.max(0, Number(hp?.value) || 0);
  if (!max) return "";
  const pct = Math.min(100, Math.round((value / max) * 100));
  const level = value <= max / 3 ? "low" : value <= (max * 2) / 3 ? "mid" : "ok";
  return `<span class="dwauto-gs-hpbar ${level}"><span style="width:${pct}%"></span></span>`;
};

// 무작위 표: 던전월드 시스템의 표 컴펜디엄 + 월드에 있는 표
const TABLE_PACKS = ["dungeonworld.tables", "dungeonworld.rollable-tables"];

/**
 * GM 스크린(ApplicationV2). 세션 중에 GM이 옆에 띄워 두는 창.
 * - 진행: 6- 결과 알림과 GM 무브·던전 무브 뽑기
 * - 진행 탭 위쪽에는 답을 기다리는 플레이어 요청(GM 요청함)도 보여준다
 * - 파티: 캐릭터별 HP·장갑·XP·약화·대기 상태·인연과 스포트라이트(마지막 판정 시각)
 * - 세션: 세션 종료 도우미(질문·성향·인연 체크 → 경험치 한 번에)와 세션 기록 시작·종료
 * - 프론트: 던전월드 프론트(위험·충동·불길한 징조·다가오는 파멸·판돈 질문) 추적
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
      showRequest: GmScreenApp.#onShowRequest,
      sessionCheck: GmScreenApp.#onSessionCheck,
      awardXp: GmScreenApp.#onAwardXp,
      sessionLog: GmScreenApp.#onSessionLog,
      frontAdd: GmScreenApp.#onFrontAdd,
      frontRemove: GmScreenApp.#onFrontRemove,
      portentToggle: GmScreenApp.#onPortentToggle,
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
      ["progress", "fa-dice", L("TabProgress"), getFailures().length + getPendingRequests().length],
      ["party", "fa-users", L("TabParty"), 0],
      ["combat", "fa-skull", L("TabCombat"), 0],
      ["session", "fa-flag-checkered", L("TabSession"), 0],
      ["fronts", "fa-chess-rook", L("TabFronts"), 0],
      ["tools", "fa-toolbox", L("TabTools"), 0],
      ["reference", "fa-book", L("TabReference"), 0],
      ["log", "fa-list", L("TabLog"), getAutomationLog().filter((e) => e.level === "error").length]
    ]
      .map(
        ([key, icon, label, count]) =>
          `<button type="button" class="dwauto-gs-tab${this.#tab === key ? " active" : ""}" data-action="switchTab" data-tab="${key}">
            <i class="fas ${icon}"></i><span class="label">${esc(label)}</span>${count ? `<span class="badge">${count}</span>` : ""}</button>`
      )
      .join("");
    let body = "";
    if (this.#tab === "progress") body = this.#renderProgress();
    else if (this.#tab === "party") body = this.#renderParty();
    else if (this.#tab === "combat") body = this.#renderCombat();
    else if (this.#tab === "session") body = this.#renderSession();
    else if (this.#tab === "fronts") body = this.#renderFronts();
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

  // 프론트 탭의 글자 칸은 고칠 때마다 다시 그리지 않고(입력 중 커서가 튀지 않게) 바로 저장만 한다
  _onRender(context, options) {
    super._onRender?.(context, options);
    for (const el of this.element.querySelectorAll("[data-front-field]")) {
      el.addEventListener("change", (event) => this.#onFrontField(event));
    }
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    // 기록·6- 알림이 바뀌면 열린 창을 다시 그린다
    this.#hookId = Hooks.on("dwAutomationLogChanged", () => {
      if (this.rendered && ["progress", "party", "log"].includes(this.#tab)) this.render();
      else if (this.rendered) this.#refreshBadges();
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

  // ---- GM 요청함 ----
  #renderInbox() {
    const requests = getPendingRequests();
    if (!requests.length) return "";
    const rows = requests
      .map((r) => {
        const from = game.users.get(r.from)?.name ?? L("UnknownUser");
        const label = game.i18n.has(`DWAUTO.GmScreen.Query.${r.name}`) ? L(`Query.${r.name}`) : r.name;
        return `<li class="dwauto-gs-request">
          <i class="fas fa-hand"></i> <b>${esc(from)}</b> · ${esc(label)} <span class="time">${timeOf(r.time)}</span>
          <button type="button" data-action="showRequest" data-id="${r.id}"><i class="fas fa-window-restore"></i> ${esc(L("ShowRequest"))}</button>
        </li>`;
      })
      .join("");
    return `<div class="dwauto-gs-section dwauto-gs-inbox"><h3>${esc(L("InboxTitle"))}</h3>
      <p class="hint">${esc(L("InboxHint"))}</p><ul class="dwauto-gs-list">${rows}</ul></div>`;
  }

  // 다른 탭을 보고 있을 때는 탭 숫자만 고친다
  #refreshBadges() {
    const btn = this.element?.querySelector('.dwauto-gs-tab[data-tab="progress"]');
    if (!btn) return;
    const count = getFailures().length + getPendingRequests().length;
    btn.querySelector(".badge")?.remove();
    if (count) btn.insertAdjacentHTML("beforeend", `<span class="badge">${count}</span>`);
  }

  // ---- 인연 ----
  #renderBonds(actor) {
    const bonds = actor.items.filter((i) => i.type === "bond");
    if (!bonds.length) return "";
    const text = (b) => (b.name || "").trim() || String(b.system?.description ?? "").replace(/<[^>]+>/g, " ").trim();
    return `<details class="dwauto-gs-bonds"><summary><i class="fas fa-link"></i> ${esc(L("BondsCount", { count: bonds.length }))}</summary>
      <ul>${bonds.map((b) => `<li>${esc(text(b))}</li>`).join("")}</ul></details>`;
  }

  // ---- 세션 ----
  #session = new Map(); // actorId -> { q1, q2, q3, alignment, bonds: Set<itemId> }

  #sessionState(actorId) {
    if (!this.#session.has(actorId)) this.#session.set(actorId, { q1: false, q2: false, q3: false, alignment: false, bonds: new Set() });
    return this.#session.get(actorId);
  }

  #sessionXp(actorId) {
    const st = this.#sessionState(actorId);
    return (st.q1 ? 1 : 0) + (st.q2 ? 1 : 0) + (st.q3 ? 1 : 0) + (st.alignment ? 1 : 0) + st.bonds.size;
  }

  #renderSession() {
    const actors = this.#partyActors();
    const check = (actorId, key, label, checked, extra = "") =>
      `<label class="dwauto-gs-check"><input type="checkbox" data-action="sessionCheck" data-actor="${actorId}" data-key="${key}" ${extra} ${checked ? "checked" : ""}> ${esc(label)}</label>`;
    const cards = actors
      .map((a) => {
        const st = this.#sessionState(a.id);
        const align = a.system?.details?.alignment ?? {};
        const alignText = [align.value, align.description].filter(Boolean).join(" — ");
        const bonds = a.items.filter((i) => i.type === "bond");
        const bondText = (b) => (b.name || "").trim() || String(b.system?.description ?? "").replace(/<[^>]+>/g, " ").trim();
        const xp = this.#sessionXp(a.id);
        return `<li class="dwauto-gs-pc">
          <div class="head"><b>${esc(a.name)}</b><span class="spot">${esc(L("SessionXpPreview", { xp }))}</span></div>
          <div class="dwauto-gs-checks">
            ${check(a.id, "q1", L("SessionQ1"), st.q1)}
            ${check(a.id, "q2", L("SessionQ2"), st.q2)}
            ${check(a.id, "q3", L("SessionQ3"), st.q3)}
            ${check(a.id, "alignment", alignText ? L("SessionAlignment", { text: alignText }) : L("SessionAlignmentNone"), st.alignment)}
            ${bonds.map((b) => check(a.id, "bond", L("SessionBond", { text: bondText(b) }), st.bonds.has(b.id), `data-bond="${b.id}"`)).join("")}
          </div>
        </li>`;
      })
      .join("");
    const total = actors.reduce((sum, a) => sum + this.#sessionXp(a.id), 0);
    const sgl = game.modules.get("gm-session-log");
    let logSection = "";
    if (sgl?.active && sgl.api) {
      let recording = false;
      try {
        recording = !!game.settings.get("gm-session-log", "recordingState")?.active;
      } catch (err) {
        recording = false;
      }
      logSection = `<div class="dwauto-gs-section"><h3>${esc(L("SessionLogTitle"))}</h3>
        <div class="dwauto-gs-buttons">
          ${recording
            ? `<button type="button" data-action="sessionLog" data-op="stop"><i class="fas fa-stop"></i> ${esc(L("SessionLogStop"))}</button>`
            : `<button type="button" data-action="sessionLog" data-op="start"><i class="fas fa-circle"></i> ${esc(L("SessionLogStart"))}</button>`}
          <button type="button" data-action="sessionLog" data-op="export"><i class="fas fa-file-export"></i> ${esc(L("SessionLogExport"))}</button>
        </div>
        <p class="hint">${esc(L(recording ? "SessionLogRecording" : "SessionLogIdle"))}</p></div>`;
    }
    return `${logSection}<div class="dwauto-gs-section"><h3>${esc(L("SessionEndTitle"))}</h3>
        <p class="hint">${esc(L("SessionEndHint"))}</p>
        ${actors.length ? `<ul class="dwauto-gs-list">${cards}</ul>` : `<p class="empty">${esc(L("NoParty"))}</p>`}
        <div class="dwauto-gs-row"><span class="spacer"></span>
          <button type="button" data-action="awardXp" ${total ? "" : "disabled"}><i class="fas fa-star"></i> ${esc(L("AwardXp", { xp: total }))}</button></div>
      </div>`;
  }

  // ---- 프론트 ----
  #renderFronts() {
    const fronts = getFronts();
    const field = (path, value, placeholder, tag = "input") =>
      tag === "textarea"
        ? `<textarea data-front-field="${path}" rows="2" placeholder="${esc(placeholder)}">${esc(value ?? "")}</textarea>`
        : `<input type="text" data-front-field="${path}" value="${esc(value ?? "")}" placeholder="${esc(placeholder)}">`;
    const del = (kind, ids, title) =>
      `<button type="button" class="icon" data-action="frontRemove" data-kind="${kind}" ${ids} title="${esc(title)}"><i class="fas fa-trash"></i></button>`;
    const body = fronts
      .map((f) => {
        const dangers = (f.dangers ?? [])
          .map((d) => {
            const portents = d.portents ?? [];
            const done = portents.filter((x) => x.done).length;
            const doomed = portents.length > 0 && done === portents.length;
            const items = portents
              .map(
                (x, i) => `<li class="${x.done ? "done" : ""}">
                  <input type="checkbox" data-action="portentToggle" data-front="${f.id}" data-danger="${d.id}" data-portent="${x.id}" ${x.done ? "checked" : ""}>
                  <span class="num">${i + 1}.</span>
                  ${field(`${f.id}.${d.id}.p.${x.id}`, x.text, L("PortentPlaceholder"))}
                  ${del("portent", `data-front="${f.id}" data-danger="${d.id}" data-portent="${x.id}"`, L("Remove"))}
                </li>`
              )
              .join("");
            return `<div class="dwauto-gs-danger${doomed ? " doomed" : ""}">
              <div class="dwauto-gs-row">
                <i class="fas fa-skull-crossbones"></i>
                ${field(`${f.id}.${d.id}.name`, d.name, L("DangerName"))}
                <span class="progress">${esc(L("PortentProgress", { done, total: portents.length }))}</span>
                ${del("danger", `data-front="${f.id}" data-danger="${d.id}"`, L("Remove"))}
              </div>
              <label class="dwauto-gs-field"><span>${esc(L("Impulse"))}</span>${field(`${f.id}.${d.id}.impulse`, d.impulse, L("ImpulsePlaceholder"))}</label>
              <div class="dwauto-gs-subtitle">${esc(L("Portents"))}</div>
              <ol class="dwauto-gs-portents">${items}</ol>
              <button type="button" data-action="frontAdd" data-kind="portent" data-front="${f.id}" data-danger="${d.id}"><i class="fas fa-plus"></i> ${esc(L("AddPortent"))}</button>
              <label class="dwauto-gs-field doom"><span>${esc(L("Doom"))}</span>${field(`${f.id}.${d.id}.doom`, d.doom, L("DoomPlaceholder"))}</label>
              ${doomed ? `<div class="doom-alert"><i class="fas fa-triangle-exclamation"></i> ${esc(L("DoomArrived"))}</div>` : ""}
            </div>`;
          })
          .join("");
        return `<details class="dwauto-gs-front" open>
          <summary>${esc(f.name || L("FrontUntitled"))}</summary>
          <div class="dwauto-gs-row">
            ${field(`${f.id}.name`, f.name, L("FrontName"))}
            ${del("front", `data-front="${f.id}"`, L("RemoveFront"))}
          </div>
          <label class="dwauto-gs-field"><span>${esc(L("Stakes"))}</span>${field(`${f.id}.stakes`, f.stakes, L("StakesPlaceholder"), "textarea")}</label>
          ${dangers}
          <button type="button" data-action="frontAdd" data-kind="danger" data-front="${f.id}"><i class="fas fa-plus"></i> ${esc(L("AddDanger"))}</button>
        </details>`;
      })
      .join("");
    return `<p class="hint">${esc(L("FrontsHint"))}</p>
      ${fronts.length ? body : `<p class="empty">${esc(L("NoFronts"))}</p>`}
      <div class="dwauto-gs-buttons"><button type="button" data-action="frontAdd" data-kind="front"><i class="fas fa-plus"></i> ${esc(L("AddFront"))}</button></div>`;
  }

  async #onFrontField(event) {
    const el = event.currentTarget;
    const [frontId, dangerId, third, fourth] = el.dataset.frontField.split(".");
    const fronts = getFronts();
    const front = fronts.find((f) => f.id === frontId);
    if (!front) return;
    const value = el.value.trim();
    if (dangerId === "name" || dangerId === "stakes") front[dangerId] = value;
    else {
      const danger = front.dangers?.find((d) => d.id === dangerId);
      if (!danger) return;
      if (third === "p") {
        const portent = danger.portents?.find((x) => x.id === fourth);
        if (portent) portent.text = value;
      } else danger[third] = value;
    }
    await saveFronts(fronts);
    // 프론트 이름은 접힌 제목에도 보이므로 그것만 고쳐 준다
    if (dangerId === "name") {
      const summary = el.closest("details")?.querySelector("summary");
      if (summary) summary.textContent = value || L("FrontUntitled");
    }
  }

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
            <span class="stat hp${lowHp ? " low" : ""}"><i class="fas fa-heart"></i> ${esc(hp.value ?? "?")}/${esc(hp.max ?? "?")}${hpBar(hp)}</span>
            <span class="stat"><i class="fas fa-shield"></i> ${esc(sys.attributes?.ac?.value ?? 0)}</span>
            <span class="stat"><i class="fas fa-star"></i> ${esc(xp.value ?? 0)}/${esc(xp.max ?? "?")}</span>
            <span class="spot${quiet ? " quiet" : ""}" title="${esc(L("SpotlightHint"))}"><i class="fas fa-lightbulb"></i> ${esc(spotText)}</span>
          </div>
          ${debilities.length ? `<div class="debility"><i class="fas fa-user-injured"></i> ${esc(debilities.join(", "))}</div>` : ""}
          ${this.#renderBonds(a)}
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
          <span class="stat hp"><i class="fas fa-heart"></i> ${esc(hp.value ?? "?")}/${esc(hp.max ?? "?")}${hpBar(hp)}</span>
          <span class="stat"><i class="fas fa-shield"></i> ${armor}</span>
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
    return `${this.#renderInbox()}<div class="dwauto-gs-section">
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

  static async #onFrontAdd(event, target) {
    const { kind, front: frontId, danger: dangerId } = target.dataset;
    const fronts = getFronts();
    const newId = () => foundry.utils.randomID();
    if (kind === "front") fronts.push({ id: newId(), name: "", stakes: "", dangers: [] });
    else {
      const front = fronts.find((f) => f.id === frontId);
      if (!front) return;
      front.dangers ??= [];
      if (kind === "danger") front.dangers.push({ id: newId(), name: "", impulse: "", doom: "", portents: [] });
      else {
        const danger = front.dangers.find((d) => d.id === dangerId);
        if (!danger) return;
        (danger.portents ??= []).push({ id: newId(), text: "", done: false });
      }
    }
    await saveFronts(fronts);
    this.render();
  }

  static async #onFrontRemove(event, target) {
    const { kind, front: frontId, danger: dangerId, portent: portentId } = target.dataset;
    let fronts = getFronts();
    if (kind === "front") {
      const front = fronts.find((f) => f.id === frontId);
      const ok = await confirmDialog({ title: L("RemoveFront"), content: `<p>${esc(L("RemoveFrontConfirm", { name: front?.name || L("FrontUntitled") }))}</p>`, defaultYes: false });
      if (!ok) return;
      fronts = fronts.filter((f) => f.id !== frontId);
    } else {
      const front = fronts.find((f) => f.id === frontId);
      if (!front) return;
      if (kind === "danger") front.dangers = (front.dangers ?? []).filter((d) => d.id !== dangerId);
      else {
        const danger = front.dangers?.find((d) => d.id === dangerId);
        if (danger) danger.portents = (danger.portents ?? []).filter((x) => x.id !== portentId);
      }
    }
    await saveFronts(fronts);
    this.render();
  }

  static async #onPortentToggle(event, target) {
    const fronts = getFronts();
    const danger = fronts.find((f) => f.id === target.dataset.front)?.dangers?.find((d) => d.id === target.dataset.danger);
    const portent = danger?.portents?.find((x) => x.id === target.dataset.portent);
    if (!portent) return;
    portent.done = target.checked;
    await saveFronts(fronts);
    this.render();
  }

  static #onShowRequest(event, target) {
    const entry = getPendingRequests().find((r) => r.id === target.dataset.id);
    const dialog = entry?.dialog;
    if (!dialog) return;
    if (dialog.minimized) dialog.maximize?.();
    if (dialog.rendered) dialog.bringToFront?.();
    else dialog.render({ force: true });
  }

  static #onSessionCheck(event, target) {
    const st = this.#sessionState(target.dataset.actor);
    const key = target.dataset.key;
    if (key === "bond") {
      if (target.checked) st.bonds.add(target.dataset.bond);
      else st.bonds.delete(target.dataset.bond);
    } else st[key] = target.checked;
    this.render();
  }

  static async #onAwardXp() {
    const actors = this.#partyActors().filter((a) => this.#sessionXp(a.id) > 0);
    if (!actors.length) return;
    const summary = actors.map((a) => `${a.name} +${this.#sessionXp(a.id)}`).join(", ");
    const ok = await confirmDialog({ title: L("AwardXpTitle"), content: `<p>${esc(L("AwardXpConfirm", { summary }))}</p>`, defaultYes: true });
    if (!ok) return;
    for (const a of actors) {
      const gain = this.#sessionXp(a.id);
      const current = Number(a.system?.attributes?.xp?.value) || 0;
      await a.update({ "system.attributes.xp.value": current + gain });
      announceActionApplied(a, L("SessionEndTitle"), L("AwardXpDone", { xp: gain, total: current + gain }));
      this.#session.delete(a.id);
    }
    this.render();
  }

  static async #onSessionLog(event, target) {
    const api = game.modules.get("gm-session-log")?.api;
    if (!api) return;
    try {
      if (target.dataset.op === "start") await api.startRecording();
      else if (target.dataset.op === "stop") await api.stopRecording();
      else await api.runExport();
    } catch (err) {
      console.error(`${MODULE_ID} | gm screen: session log ${target.dataset.op} failed`, err);
    }
    setTimeout(() => this.render(), 500);
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
