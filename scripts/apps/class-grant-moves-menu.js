import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_CLASS_GRANT_MOVES } from "../data/class-grant-moves.js";

function blankRow() {
  return { name: "", grantedMoveNames: "" };
}

function normalizeRow(raw) {
  return {
    name: (raw?.name ?? "").trim(),
    grantedMoveNames: (raw?.grantedMoveNames ?? "").trim()
  };
}

export class ClassGrantMovesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.CLASS_GRANT_MOVES));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-class-grant-moves",
      title: game.i18n.localize("DWAUTO.ClassGrantMoves.Title"),
      template: `modules/${MODULE_ID}/templates/class-grant-moves-settings.html`,
      width: 620,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.ClassGrantMoves.Hint"),
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
        title: game.i18n.localize("DWAUTO.ClassGrantMoves.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.ClassGrantMoves.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      this.rows = foundry.utils.deepClone(DEFAULT_CLASS_GRANT_MOVES);
      this.render();
    });
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const rows = expanded.rows ? Object.values(expanded.rows).map(normalizeRow) : [];
    await game.settings.set(
      MODULE_ID,
      SETTINGS.CLASS_GRANT_MOVES,
      rows.filter((r) => r.name && r.grantedMoveNames)
    );
  }
}
