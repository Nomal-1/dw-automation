import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_HIT_TRIGGER_MOVES } from "../data/hit-trigger-moves.js";

const VALID_EFFECTS = ["armor", "debility"];

function blankRow() {
  return { name: "", effect: "armor", grantsForward: false };
}

function normalizeRow(raw) {
  const effect = VALID_EFFECTS.includes(raw?.effect) ? raw.effect : "armor";
  return {
    name: (raw?.name ?? "").trim(),
    effect,
    grantsForward: raw?.grantsForward === true || raw?.grantsForward === "true"
  };
}

export class HitTriggerMovesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.HIT_TRIGGER_MOVES));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-hit-trigger-moves",
      title: game.i18n.localize("DWAUTO.HitTriggerMoves.Title"),
      template: `modules/${MODULE_ID}/templates/hit-trigger-moves-settings.html`,
      width: 620,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.HitTriggerMoves.Hint"),
      rows: this.rows.map((r) => ({
        ...r,
        effectOptions: VALID_EFFECTS.map((e) => ({
          value: e,
          label: game.i18n.localize(`DWAUTO.HitTriggerMoves.EffectOption.${e}`),
          selected: e === r.effect
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
        title: game.i18n.localize("DWAUTO.HitTriggerMoves.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.HitTriggerMoves.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      this.rows = foundry.utils.deepClone(DEFAULT_HIT_TRIGGER_MOVES);
      this.render();
    });
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const rows = expanded.rows ? Object.values(expanded.rows).map(normalizeRow) : [];
    await game.settings.set(MODULE_ID, SETTINGS.HIT_TRIGGER_MOVES, rows.filter((r) => r.name));
  }
}
