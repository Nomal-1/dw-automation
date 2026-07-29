import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_SPECIAL_ATTACK_MOVES } from "../data/attack-moves.js";

function blankRow() {
  return {
    name: "",
    ranged: false,
    gatesDamage: false,
    damageOnPartial: true,
    damageOnSuccess: true,
    partialPickCount: 1,
    successPickCount: 1
  };
}

function normalizeRow(raw) {
  return {
    name: (raw?.name ?? "").trim(),
    ranged: !!raw?.ranged,
    gatesDamage: !!raw?.gatesDamage,
    damageOnPartial: !!raw?.damageOnPartial,
    damageOnSuccess: !!raw?.damageOnSuccess,
    partialPickCount: Math.max(0, parseInt(raw?.partialPickCount, 10) || 0),
    successPickCount: Math.max(0, parseInt(raw?.successPickCount, 10) || 0)
  };
}

export class AttackMovesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.SPECIAL_ATTACK_MOVES));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-attack-moves",
      title: game.i18n.localize("DWAUTO.AttackMoves.Title"),
      template: `modules/${MODULE_ID}/templates/attack-moves-settings.html`,
      width: 640,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.AttackMoves.Hint"),
      rows: this.rows
    };
  }

  // 행 추가/삭제 버튼은 폼 전체를 submit하지 않고 즉시 다시 그리므로, 그 사이에
  // 사용자가 입력해둔 값을 잃지 않도록 렌더 직전에 현재 폼 값을 읽어둔다.
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
        title: game.i18n.localize("DWAUTO.AttackMoves.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.AttackMoves.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      this.rows = foundry.utils.deepClone(DEFAULT_SPECIAL_ATTACK_MOVES);
      this.render();
    });
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const rows = expanded.rows ? Object.values(expanded.rows).map(normalizeRow) : [];
    await game.settings.set(MODULE_ID, SETTINGS.SPECIAL_ATTACK_MOVES, rows.filter((r) => r.name));
  }
}
