import { MODULE_ID } from "../constants.js";
import { buildAutomationCatalog } from "../lib/automation-catalog.js";

// 직업별 자동화 창(1차). 왼쪽에서 분류(기본 액션·직업·종족·기타)를 고르면 오른쪽에
// 그 분류의 액션이 한 줄씩 나오고, 줄마다 그 액션에 걸린 자동화를 켜고 끌 수 있다.
// 연결표는 lib/automation-catalog.js가 설정 등록 정보로 계산한다.
//
// 1차에서 "켜기/끄기"는 기능(자동화) 단위다. 한 기능이 여러 액션에 걸려 있으면
// (예: 공격 보조 = 접근전·사격) 그 액션들이 함께 켜지고 꺼진다는 것을 줄에 표시한다.
// 액션 하나만 따로 끄기, 다중직업 액션을 직업마다 따로 끄기, 세부 값(표 설정) 편집은
// 2차에서 한다.
//
// Foundry 14 방식(ApplicationV2)으로 만들었다. 템플릿 파일 없이 _renderHTML이
// HTML 문자열을 만든다 — 줄 수가 많고 구조가 단순해서 이 편이 읽기 쉽다.

const { ApplicationV2 } = foundry.applications.api;

const L = (key, data) => (data ? game.i18n.format(`DWAUTO.ClassAutomation.${key}`, data) : game.i18n.localize(`DWAUTO.ClassAutomation.${key}`));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export class ClassAutomationApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "dwauto-class-automation",
    classes: ["dwauto-class-automation"],
    tag: "div",
    window: { title: "DWAUTO.ClassAutomation.Title", icon: "fas fa-list-check", resizable: true },
    position: { width: 960, height: 700 },
    actions: {
      selectGroup: ClassAutomationApp.#onSelectGroup,
      refresh: ClassAutomationApp.#onRefresh,
      showMissing: ClassAutomationApp.#onShowMissing
    }
  };

  #catalog = null;
  #groupKey = "basic";
  #filter = "";
  #missingOnly = false;

  async _prepareContext(options) {
    this.#catalog ??= await buildAutomationCatalog();
    if (!this.#catalog.groups.some((g) => g.key === this.#groupKey)) this.#groupKey = this.#catalog.groups[0]?.key ?? null;
    return {};
  }

  async _renderHTML(context, options) {
    const groups = this.#catalog.groups;
    const nav = groups
      .map((g) => {
        const active = g.key === this.#groupKey ? " active" : "";
        const automated = g.moves.filter((m) => m.own.length).length;
        return `<button type="button" class="dwauto-ca-group${active}" data-action="selectGroup" data-group="${esc(g.key)}">
          <span class="label">${esc(g.label)}</span><span class="count">${automated}/${g.moves.length}</span></button>`;
      })
      .join("");

    const group = groups.find((g) => g.key === this.#groupKey);
    const filter = this.#filter.trim().toLowerCase();
    let moves = group?.moves ?? [];
    if (filter) moves = moves.filter((m) => `${m.name} ${m.original ?? ""}`.toLowerCase().includes(filter));
    if (this.#missingOnly) moves = moves.filter((m) => m.owners.length && !m.own.length);

    const rows = moves.map((m) => this.#renderMove(m)).join("") || `<p class="dwauto-ca-empty">${esc(L("Empty"))}</p>`;

    const html = `
      <div class="dwauto-ca-layout">
        <nav class="dwauto-ca-nav">${nav}</nav>
        <section class="dwauto-ca-main">
          <header class="dwauto-ca-toolbar">
            <input type="search" name="filter" value="${esc(this.#filter)}" placeholder="${esc(L("Search"))}">
            <label class="dwauto-ca-missing"><input type="checkbox" name="missingOnly" ${this.#missingOnly ? "checked" : ""}> ${esc(L("MissingOnly"))}</label>
            <button type="button" data-action="refresh" title="${esc(L("RefreshHint"))}"><i class="fas fa-rotate"></i></button>
          </header>
          <p class="dwauto-ca-hint">${esc(L("Hint"))}</p>
          <div class="dwauto-ca-rows">${rows}</div>
        </section>
      </div>`;
    const div = document.createElement("div");
    div.innerHTML = html;
    return div;
  }

  _replaceHTML(result, content, options) {
    const scroll = content.querySelector(".dwauto-ca-rows")?.scrollTop ?? 0;
    content.replaceChildren(...result.childNodes);
    const rowsEl = content.querySelector(".dwauto-ca-rows");
    if (rowsEl && options?.keepScroll) rowsEl.scrollTop = scroll;
  }

  _onRender(context, options) {
    const root = this.element;
    const search = root.querySelector('input[name="filter"]');
    search?.addEventListener("input", foundry.utils.debounce((ev) => {
      this.#filter = ev.target.value;
      this.render({ keepScroll: false }).then(() => {
        const el = this.element.querySelector('input[name="filter"]');
        el?.focus();
        el?.setSelectionRange(el.value.length, el.value.length);
      });
    }, 250));
    root.querySelector('input[name="missingOnly"]')?.addEventListener("change", (ev) => {
      this.#missingOnly = ev.target.checked;
      this.render();
    });
    for (const box of root.querySelectorAll('input[data-feature]')) {
      box.addEventListener("change", (ev) => this.#onToggleFeature(ev));
    }
  }

  #renderMove(m) {
    const original = m.original && m.original !== m.name ? `<span class="original">${esc(m.original)}</span>` : "";
    const owners = m.owners.length
      ? `<span class="owners" title="${esc(m.owners.join(", "))}"><i class="fas fa-user"></i> ${esc(m.owners.join(", "))}</span>`
      : "";

    let features;
    if (!m.own.length) {
      features = `<div class="dwauto-ca-none">${esc(L("NoAutomation"))}</div>`;
    } else {
      features = m.own
        .map((f) => {
          const on = !!game.settings.get(MODULE_ID, f.enableKey);
          const others = (this.#catalog.ownersOfFeature.get(f.enableKey) ?? []).filter((n) => n !== m.name);
          const shared = others.length
            ? `<div class="shared">${esc(L("SharedWith", { moves: others.slice(0, 6).join(", ") + (others.length > 6 ? ` +${others.length - 6}` : "") }))}</div>`
            : "";
          return `<label class="dwauto-ca-feature${on ? "" : " off"}" title="${esc(f.hint)}">
              <input type="checkbox" data-feature="${esc(f.enableKey)}" ${on ? "checked" : ""}>
              <span class="name">${esc(f.label)}</span>${shared}
            </label>`;
        })
        .join("");
    }

    const reacting = m.reacting.length
      ? `<div class="dwauto-ca-reacting"><i class="fas fa-reply"></i> ${esc(L("Reacting"))} ${m.reacting
          .map((f) => `<span class="${game.settings.get(MODULE_ID, f.enableKey) ? "" : "off"}" title="${esc(f.hint)}">${esc(f.label)}</span>`)
          .join(", ")}</div>`
      : "";

    return `<div class="dwauto-ca-row${m.own.length ? "" : " no-auto"}">
        <div class="dwauto-ca-move">
          ${m.img ? `<img src="${esc(m.img)}" alt="">` : ""}
          <div><div class="title">${esc(m.name)} ${original}</div>${owners}</div>
        </div>
        <div class="dwauto-ca-features">${features}${reacting}</div>
      </div>`;
  }

  async #onToggleFeature(event) {
    const key = event.target.dataset.feature;
    const value = event.target.checked;
    if (!game.user.isGM) return;
    await game.settings.set(MODULE_ID, key, value);
    this.render({ keepScroll: true });
  }

  static #onSelectGroup(event, target) {
    this.#groupKey = target.dataset.group;
    this.render();
  }

  static async #onRefresh() {
    this.#catalog = null;
    this.render();
  }

  static #onShowMissing() {
    this.#missingOnly = !this.#missingOnly;
    this.render();
  }
}
