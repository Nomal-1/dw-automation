import { MODULE_ID } from "../constants.js";
import { TABLE_FIELDS } from "../data/table-fields.js";
import { TABLE_MENUS } from "../data/table-menus.js";
import { annotateRowsWithClass, sortRowsByClass } from "../lib/move-class-lookup.js";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

// 표 설정(특수 공격, 피격 반응, 치유 … 액션 업그레이드, 기록 액션) 18개를 편집하는 공통 창(ApplicationV2).
// 표마다의 차이(칸, 제목, 기본값, 새 줄 초기값)는 data/table-fields.js와 data/table-menus.js에 있다.
// 예전에는 표마다 FormApplication 창과 템플릿이 따로 있었는데(16개, 약 1,400줄) 모양이 거의
// 같아서 하나로 합쳤다. 저장하면 이름이 빈 줄은 버린다.

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** 한 줄을 칸 정보에 맞게 정리한다(숫자는 정수·최솟값, 선택지는 목록 안의 값, 글자는 앞뒤 공백 제거). */
const fieldsOf = (tableKey) => TABLE_MENUS[tableKey]?.fields ?? TABLE_FIELDS[tableKey] ?? [];
const nameFieldOf = (tableKey) => TABLE_MENUS[tableKey]?.nameField ?? "name";

function normalizeRow(tableKey, raw) {
  const meta = TABLE_MENUS[tableKey];
  const nameField = nameFieldOf(tableKey);
  const row = { [nameField]: String(raw?.[nameField] ?? "").trim() };
  for (const field of fieldsOf(tableKey)) {
    const value = raw?.[field.key];
    if (field.type === "checkbox") row[field.key] = value === true || value === "true" || value === "on";
    else if (field.type === "number") row[field.key] = Math.max(meta.mins?.[field.key] ?? 0, parseInt(value, 10) || 0);
    else if (field.type === "select") {
      const values = (field.options ?? []).map((o) => o.value);
      row[field.key] = values.includes(value) ? value : meta.blank?.[field.key] ?? values[0];
    } else row[field.key] = String(value ?? "").trim();
  }
  return row;
}

export class TableEditorApp extends ApplicationV2 {
  constructor(tableKey, options = {}) {
    const meta = TABLE_MENUS[tableKey];
    super(
      foundry.utils.mergeObject(
        {
          id: `dwauto-table-${tableKey}`,
          window: { title: `${meta.prefix}.Title` },
          position: { width: meta.width ?? 600 }
        },
        options
      )
    );
    this.tableKey = tableKey;
    this.meta = meta;
    const stored = game.settings.get(MODULE_ID, tableKey);
    this.rows = meta.load ? meta.load(stored) : foundry.utils.deepClone(stored ?? []);
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dwauto-table-editor"],
    window: { resizable: true },
    position: { height: "auto" },
    form: { handler: TableEditorApp.#onSubmit, closeOnSubmit: true },
    actions: {
      addRow: TableEditorApp.#onAddRow,
      removeRow: TableEditorApp.#onRemoveRow,
      resetDefaults: TableEditorApp.#onResetDefaults
    }
  };

  async _renderHTML() {
    const L = (key) => game.i18n.localize(key);
    const labelPrefix = this.meta.labelPrefix ?? this.meta.prefix;
    const fields = fieldsOf(this.tableKey);
    const nameField = nameFieldOf(this.tableKey);
    if (this.meta.classColumn) {
      try {
        this.rows = sortRowsByClass(await annotateRowsWithClass(this.rows, { nameField }));
      } catch (err) {
        console.warn(`${MODULE_ID} | table editor: class annotation failed`, err);
      }
    }

    const head = [
      this.meta.classColumn ? `<th>${esc(L("DWAUTO.ClassLabel.Column"))}</th>` : "",
      `<th>${esc(L(this.meta.nameLabel ?? `${labelPrefix}.Name`))}</th>`,
      ...fields.map((f) => `<th>${esc(L(f.label))}</th>`),
      "<th></th>"
    ].join("");

    const body = this.rows
      .map((row, i) => {
        const cells = fields.map((f) => {
          const name = `rows.${i}.${f.key}`;
          const value = row[f.key];
          if (f.type === "checkbox") return `<td><input type="checkbox" name="${name}" ${value ? "checked" : ""}></td>`;
          if (f.type === "number") return `<td><input type="number" name="${name}" value="${esc(value ?? 0)}"></td>`;
          if (f.type === "select") {
            const options = (f.options ?? [])
              .map((o) => `<option value="${esc(o.value)}" ${o.value === value ? "selected" : ""}>${esc(L(o.label))}</option>`)
              .join("");
            return `<td><select name="${name}">${options}</select></td>`;
          }
          return `<td><input type="text" name="${name}" value="${esc(value)}"></td>`;
        });
        return `<tr>
          ${this.meta.classColumn ? `<td>${row.classLabel ? `<span class="dwauto-class-badge">${esc(row.classLabel)}</span>` : ""}</td>` : ""}
          <td><input type="text" name="rows.${i}.${nameField}" value="${esc(row[nameField])}"></td>
          ${cells.join("")}
          <td><button type="button" class="dwauto-remove-row" data-action="removeRow" data-index="${i}"><i class="fas fa-trash"></i></button></td>
        </tr>`;
      })
      .join("");

    return `<p class="notes">${esc(L(this.meta.hintKey ?? `${this.meta.prefix}.Hint`))}</p>
      <table class="dwauto-attack-moves-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <div class="dwauto-table-editor-buttons">
        <button type="button" data-action="addRow"><i class="fas fa-plus"></i> ${esc(L("DWAUTO.AttackMoves.AddRow"))}</button>
        <button type="button" data-action="resetDefaults"><i class="fas fa-rotate-left"></i> ${esc(L(`${labelPrefix}.ResetDefaultsButton`))}</button>
      </div>
      <footer class="sheet-footer flexrow"><button type="submit"><i class="fas fa-save"></i> ${esc(L("SETTINGS.Save"))}</button></footer>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  /** 지금 화면에 입력된 값을 this.rows로 옮긴다(줄 추가·삭제 전에 입력한 내용을 잃지 않게). */
  #readRows() {
    const data = new foundry.applications.ux.FormDataExtended(this.element).object;
    return this.#rowsFromForm(data);
  }

  // 폼 값 → 줄 목록. 화면에 칸이 없는 값(예: 클래스 부여 표의 noLevelCap — 기본값·마이그레이션이
  // 넣어 두는 숨은 값)은 같은 위치의 원래 줄에서 그대로 가져온다. 예전 창들은 저장할 때 이런 값을
  // 버려서 기능이 바뀌는 문제가 있었다.
  #rowsFromForm(data) {
    const expanded = foundry.utils.expandObject(data ?? {});
    const raw = expanded.rows ? Object.values(expanded.rows) : [];
    return raw.map((r, i) => {
      const row = normalizeRow(this.tableKey, r);
      const original = this.rows[i] ?? {};
      const hidden = Object.fromEntries(Object.entries(original).filter(([k]) => !(k in row) && k !== "classLabel"));
      return { ...hidden, ...row };
    });
  }

  static #onAddRow() {
    this.rows = this.#readRows();
    this.rows.push(foundry.utils.deepClone(this.meta.blank ?? { name: "" }));
    this.render();
  }

  static #onRemoveRow(event, target) {
    this.rows = this.#readRows();
    this.rows.splice(Number(target.dataset.index), 1);
    this.render();
  }

  static async #onResetDefaults() {
    const confirmed = await DialogV2.confirm({
      window: { title: `${this.meta.prefix}.ResetConfirmTitle` },
      content: `<p>${esc(game.i18n.localize(`${this.meta.prefix}.ResetConfirmContent`))}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;
    this.rows = foundry.utils.deepClone(this.meta.defaults ?? []);
    this.render();
  }

  static async #onSubmit(event, form, formData) {
    const rows = this.#rowsFromForm(formData.object);
    const meta = TABLE_MENUS[this.tableKey];
    const nameField = nameFieldOf(this.tableKey);
    const kept = rows.filter((r) => (meta.keep ? meta.keep(r) : !!r[nameField]));
    await game.settings.set(MODULE_ID, this.tableKey, meta.save ? meta.save(kept) : kept);
  }
}

/** settings.js의 registerMenu는 인자 없이 new 하므로, 표마다 그 표를 여는 작은 클래스를 만든다. */
function makeMenu(tableKey) {
  return class extends TableEditorApp {
    constructor(options = {}) {
      super(tableKey, options);
    }
  };
}

export const AttackMovesMenu = makeMenu("specialAttackMoves");
export const ClassGrantMovesMenu = makeMenu("classGrantMoves");
export const ConditionalDamageMovesMenu = makeMenu("conditionalDamageMoves");
export const ConditionalTagMovesMenu = makeMenu("conditionalTagMoves");
export const DamageReductionMovesMenu = makeMenu("damageReductionMoves");
export const DruidDamageDieMovesMenu = makeMenu("druidDamageDieMoves");
export const EmpowerMovesMenu = makeMenu("empowerMoves");
export const HealingMovesMenu = makeMenu("healingMoves");
export const HitTriggerMovesMenu = makeMenu("hitTriggerMoves");
export const HoldGrantMovesMenu = makeMenu("holdGrantMoves");
export const HospitallerMovesMenu = makeMenu("hospitallerMoves");
export const OngoingPenaltyReductionMovesMenu = makeMenu("ongoingPenaltyReductionMoves");
export const OngoingSpellsMenu = makeMenu("ongoingSpells");
export const PrepareSpellsMovesMenu = makeMenu("prepareSpellsMoves");
export const SelfForwardMovesMenu = makeMenu("selfForwardMoves");
export const SpellDamageMovesMenu = makeMenu("spellDamageMoves");
export const MoveUpgradesMenu = makeMenu("moveUpgrades");
export const NoteMovesMenu = makeMenu("noteMoveNames");
