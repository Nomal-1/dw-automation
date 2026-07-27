import { MODULE_ID, SETTINGS } from "../constants.js";

function blankRow() {
  return { upgradeName: "", replacesName: "" };
}

function normalizeRow(raw) {
  return {
    upgradeName: (raw?.upgradeName ?? "").trim(),
    replacesName: (raw?.replacesName ?? "").trim()
  };
}

export class MoveUpgradesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.MOVE_UPGRADES));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-move-upgrades",
      title: game.i18n.localize("DWAUTO.MoveUpgrades.Title"),
      template: `modules/${MODULE_ID}/templates/move-upgrades-settings.html`,
      width: 680,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.MoveUpgrades.Hint"),
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
    await game.settings.set(
      MODULE_ID,
      SETTINGS.MOVE_UPGRADES,
      rows.filter((r) => r.upgradeName && r.replacesName)
    );
  }
}
