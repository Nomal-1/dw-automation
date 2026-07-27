import { MODULE_ID, SETTINGS } from "../constants.js";

function blankRow() {
  return { name: "", bonusFormula: "" };
}

function normalizeRow(raw) {
  return {
    name: (raw?.name ?? "").trim(),
    bonusFormula: (raw?.bonusFormula ?? "").trim()
  };
}

export class HospitallerMovesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.HOSPITALLER_MOVES));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-hospitaller-moves",
      title: game.i18n.localize("DWAUTO.HospitallerMoves.Title"),
      template: `modules/${MODULE_ID}/templates/hospitaller-moves-settings.html`,
      width: 560,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.HospitallerMoves.Hint"),
      rows: this.rows
    };
  }

  _syncRowsFromForm(html) {
    const formData = new FormDataExtended(html[0].querySelector("form")).object;
    const expanded = foundry.utils.expandObject(formData);
    if (expanded.rows) {
      this.rows = Object.values(expanded.rows).map(normalizeRow);
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('[data-action="add-row"]').on("click", () => {
      this._syncRowsFromForm(html);
      this.rows.push(blankRow());
      this.render();
    });

    html.find('[data-action="remove-row"]').on("click", (event) => {
      this._syncRowsFromForm(html);
      const index = Number(event.currentTarget.dataset.index);
      this.rows.splice(index, 1);
      this.render();
    });
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const rows = expanded.rows ? Object.values(expanded.rows).map(normalizeRow) : [];
    await game.settings.set(MODULE_ID, SETTINGS.HOSPITALLER_MOVES, rows.filter((r) => r.name));
  }
}
