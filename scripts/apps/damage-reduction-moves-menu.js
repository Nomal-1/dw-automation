import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_DAMAGE_REDUCTION_MOVES } from "../data/hit-trigger-moves.js";

function blankRow() {
  return { name: "", baseBonus: 0, outnumberedBonus: 1, linkedMoveName: "", autoCheckPreparedSpell: false };
}

function normalizeRow(raw) {
  return {
    name: (raw?.name ?? "").trim(),
    baseBonus: Math.max(0, parseInt(raw?.baseBonus, 10) || 0),
    outnumberedBonus: Math.max(0, parseInt(raw?.outnumberedBonus, 10) || 0),
    linkedMoveName: (raw?.linkedMoveName ?? "").trim(),
    autoCheckPreparedSpell: Boolean(raw?.autoCheckPreparedSpell)
  };
}

export class DamageReductionMovesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-damage-reduction-moves",
      title: game.i18n.localize("DWAUTO.DamageReductionMoves.Title"),
      template: `modules/${MODULE_ID}/templates/damage-reduction-moves-settings.html`,
      width: 560,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.DamageReductionMoves.Hint"),
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
        title: game.i18n.localize("DWAUTO.DamageReductionMoves.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.DamageReductionMoves.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      this.rows = foundry.utils.deepClone(DEFAULT_DAMAGE_REDUCTION_MOVES);
      this.render();
    });
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const rows = expanded.rows ? Object.values(expanded.rows).map(normalizeRow) : [];
    await game.settings.set(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES, rows.filter((r) => r.name));
  }
}
