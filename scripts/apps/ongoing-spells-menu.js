import { MODULE_ID, SETTINGS } from "../constants.js";

const VALID_PENALTIES = ["none", "minus1", "blocked"];

function blankRow() {
  return { name: "", castPenalty: "none" };
}

function normalizeRow(raw) {
  const castPenalty = VALID_PENALTIES.includes(raw?.castPenalty) ? raw.castPenalty : "none";
  return {
    name: (raw?.name ?? "").trim(),
    castPenalty
  };
}

export class OngoingSpellsMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.ONGOING_SPELLS));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-ongoing-spells",
      title: game.i18n.localize("DWAUTO.OngoingSpells.Title"),
      template: `modules/${MODULE_ID}/templates/ongoing-spells-settings.html`,
      width: 560,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.OngoingSpells.Hint"),
      rows: this.rows.map((r) => ({
        ...r,
        options: VALID_PENALTIES.map((p) => ({
          value: p,
          label: game.i18n.localize(`DWAUTO.OngoingSpells.Penalty.${p}`),
          selected: p === r.castPenalty
        }))
      }))
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
    await game.settings.set(MODULE_ID, SETTINGS.ONGOING_SPELLS, rows.filter((r) => r.name));
  }
}
