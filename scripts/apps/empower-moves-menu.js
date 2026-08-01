import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_EMPOWER_MOVES } from "../data/empower-moves.js";

function blankRow() {
  return { name: "", isGreater: false };
}

function normalizeRow(raw) {
  return {
    name: (raw?.name ?? "").trim(),
    isGreater: Boolean(raw?.isGreater)
  };
}

export class EmpowerMovesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.EMPOWER_MOVES));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-empower-moves",
      title: game.i18n.localize("DWAUTO.EmpowerMoves.Title"),
      template: `modules/${MODULE_ID}/templates/empower-moves-settings.html`,
      width: 560,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.EmpowerMoves.Hint"),
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

    html.find('[data-action="reset-defaults"]').on("click", async () => {
      const confirmed = await Dialog.confirm({
        title: game.i18n.localize("DWAUTO.EmpowerMoves.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.EmpowerMoves.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      this.rows = foundry.utils.deepClone(DEFAULT_EMPOWER_MOVES);
      this.render();
    });
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const rows = expanded.rows ? Object.values(expanded.rows).map(normalizeRow) : [];
    await game.settings.set(MODULE_ID, SETTINGS.EMPOWER_MOVES, rows.filter((r) => r.name));
  }
}
