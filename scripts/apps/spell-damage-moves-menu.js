import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_SPELL_DAMAGE_MOVES } from "../data/spell-damage-moves.js";

const VALID_MODES = ["auto", "custom"];

function blankRow() {
  return { name: "", formulaMode: "auto", customFormula: "", ignoresArmor: false, selfDamageFormula: "" };
}

function normalizeRow(raw) {
  const formulaMode = VALID_MODES.includes(raw?.formulaMode) ? raw.formulaMode : "auto";
  return {
    name: (raw?.name ?? "").trim(),
    formulaMode,
    customFormula: (raw?.customFormula ?? "").trim(),
    ignoresArmor: raw?.ignoresArmor === true || raw?.ignoresArmor === "true",
    selfDamageFormula: (raw?.selfDamageFormula ?? "").trim()
  };
}

export class SpellDamageMovesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.SPELL_DAMAGE_MOVES));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-spell-damage-moves",
      title: game.i18n.localize("DWAUTO.SpellDamageMoves.Title"),
      template: `modules/${MODULE_ID}/templates/spell-damage-moves-settings.html`,
      width: 720,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.SpellDamageMoves.Hint"),
      rows: this.rows.map((r) => ({
        ...r,
        modeOptions: VALID_MODES.map((m) => ({
          value: m,
          label: game.i18n.localize(`DWAUTO.HealingMoves.FormulaModeOption.${m}`),
          selected: m === r.formulaMode
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

    html.find('[data-action="reset-defaults"]').on("click", async () => {
      const confirmed = await Dialog.confirm({
        title: game.i18n.localize("DWAUTO.SpellDamageMoves.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.SpellDamageMoves.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      this.rows = foundry.utils.deepClone(DEFAULT_SPELL_DAMAGE_MOVES);
      this.render();
    });
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const rows = expanded.rows ? Object.values(expanded.rows).map(normalizeRow) : [];
    await game.settings.set(MODULE_ID, SETTINGS.SPELL_DAMAGE_MOVES, rows.filter((r) => r.name));
  }
}
