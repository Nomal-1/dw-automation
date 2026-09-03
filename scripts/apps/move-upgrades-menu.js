import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_MOVE_UPGRADES } from "../data/move-upgrades.js";
import { annotateRowsWithClass, sortRowsByClass } from "../lib/move-class-lookup.js";

function blankRow() {
  return { upgradeName: "", replacesName: "", deletesPrevious: true };
}

function normalizeRow(raw) {
  return {
    upgradeName: (raw?.upgradeName ?? "").trim(),
    replacesName: (raw?.replacesName ?? "").trim(),
    deletesPrevious: raw?.deletesPrevious === true || raw?.deletesPrevious === "true"
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

  // 이 표는 8개 기본 직업 전체(+바바리안/이몰레이터)를 다루므로, 어느
  // 직업 것인지 배지로 보여주고 그 기준으로 묶어서 정렬한다(upgradeName
  // 기준 — lib/move-class-lookup.js 참고).
  async getData() {
    try {
      this.rows = sortRowsByClass(await annotateRowsWithClass(this.rows, { nameField: "upgradeName" }));
    } catch (err) {
      console.warn(`${MODULE_ID} | move-upgrades-menu: class annotation failed`, err);
    }

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

    // 이 모듈이 실제 공식 무브 원문을 확인해서 정리해둔 영문 기본값(대체/필요
    // 구분 포함)으로 표 전체를 되돌린다. 그 다음 "번역 모듈에서 자동
    // 채우기"를 실행하면 이름만 번역되고 대체/필요 구분은 그대로 유지된다.
    html.find('[data-action="reset-defaults"]').on("click", async () => {
      const confirmed = await Dialog.confirm({
        title: game.i18n.localize("DWAUTO.MoveUpgrades.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.MoveUpgrades.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      this.rows = foundry.utils.deepClone(DEFAULT_MOVE_UPGRADES);
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
