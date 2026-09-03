import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_SELF_FORWARD_MOVES } from "../data/self-forward-moves.js";
import { annotateRowsWithClass, sortRowsByClass } from "../lib/move-class-lookup.js";

function blankRow() {
  return { name: "", restrictToMoveNames: "" };
}

function normalizeRow(raw) {
  return {
    name: (raw?.name ?? "").trim(),
    restrictToMoveNames: (raw?.restrictToMoveNames ?? "").trim()
  };
}

export class SelfForwardMovesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.SELF_FORWARD_MOVES));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-self-forward-moves",
      title: game.i18n.localize("DWAUTO.SelfForwardMoves.Title"),
      template: `modules/${MODULE_ID}/templates/self-forward-moves-settings.html`,
      width: 640,
      closeOnSubmit: true
    });
  }

  // 사제 Reaper, 마법사 Quick Study, 음유시인 An Ear For Magic, 야만전사
  // Usurper처럼 여러 직업 무브가 한 표에 섞여 있어, 어느 직업 것인지
  // 배지로 보여주고 그 기준으로 묶어서 정렬한다(lib/move-class-lookup.js
  // 참고).
  async getData() {
    try {
      this.rows = sortRowsByClass(await annotateRowsWithClass(this.rows));
    } catch (err) {
      console.warn(`${MODULE_ID} | self-forward-moves-menu: class annotation failed`, err);
    }

    return {
      hint: game.i18n.localize("DWAUTO.SelfForwardMoves.Hint"),
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
        title: game.i18n.localize("DWAUTO.SelfForwardMoves.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.SelfForwardMoves.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      this.rows = foundry.utils.deepClone(DEFAULT_SELF_FORWARD_MOVES);
      this.render();
    });
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const rows = expanded.rows ? Object.values(expanded.rows).map(normalizeRow) : [];
    await game.settings.set(MODULE_ID, SETTINGS.SELF_FORWARD_MOVES, rows.filter((r) => r.name));
  }
}
