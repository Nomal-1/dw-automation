import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_DAMAGE_REDUCTION_MOVES } from "../data/hit-trigger-moves.js";
import { annotateRowsWithClass, sortRowsByClass } from "../lib/move-class-lookup.js";

// "Divine Protection"/"Divine Armor"는 클레릭과 팔라딘이 이름을 공유해서
// 이름만으로는 어느 직업인지 알 수 없다 — linkedMoveName이 "Quest"로
// 채워진 쪽이 팔라딘(호리 프로텍션 계열), 아니면 클레릭이다(data/
// hit-trigger-moves.js 상단 주석 참고).
function disambiguateDivineProtection(row, englishName) {
  if (englishName !== "Divine Protection" && englishName !== "Divine Armor") return null;
  return row.linkedMoveName ? "팔라딘" : "사제";
}

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

  // 도적 Underdog, 야만전사 Unencumbered Unharmed, 드루이드 Barkskin, 사제/
  // 팔라딘 Divine Protection, 마법사 Arcane Ward 등 여러 직업 무브가 한 표에
  // 섞여 있어, 어느 직업 것인지 배지로 보여주고 그 기준으로 묶어서
  // 정렬한다(lib/move-class-lookup.js 참고).
  async getData() {
    try {
      this.rows = sortRowsByClass(
        await annotateRowsWithClass(this.rows, { disambiguate: disambiguateDivineProtection })
      );
    } catch (err) {
      console.warn(`${MODULE_ID} | damage-reduction-moves-menu: class annotation failed`, err);
    }

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
