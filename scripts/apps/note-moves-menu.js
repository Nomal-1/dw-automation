import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_NOTE_MOVE_NAMES } from "../data/note-moves.js";

// 이 설정 자체는 다른 표 설정들과 달리 지금도(그리고 계속) 쉼표로 구분된
// 문자열 하나로 저장된다 — features/note-moves.js와 lib/translation-import.js가
// 둘 다 그 형태를 그대로 읽고 쓰기 때문에, 이 메뉴는 그 문자열을 표로
// 보여주고 편집하는 창일 뿐 저장 형식 자체를 바꾸지 않는다.
function parseNames(raw) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export class NoteMovesMenu extends FormApplication {
  constructor(...args) {
    super(...args);
    this.rows = parseNames(game.settings.get(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES)).map((name) => ({ name }));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-note-moves",
      title: game.i18n.localize("DWAUTO.NoteMovesSettings.Title"),
      template: `modules/${MODULE_ID}/templates/note-moves-settings.html`,
      width: 480,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.Settings.NoteMoveNames.Hint"),
      rows: this.rows
    };
  }

  _syncRowsFromForm(html) {
    const formData = new FormDataExtended(html[0].querySelector("form")).object;
    const expanded = foundry.utils.expandObject(formData);
    if (expanded.rows) {
      this.rows = Object.values(expanded.rows).map((r) => ({ name: (r?.name ?? "").trim() }));
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('[data-action="add-row"]').on("click", () => {
      this._syncRowsFromForm(html);
      this.rows.push({ name: "" });
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
        title: game.i18n.localize("DWAUTO.NoteMovesSettings.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.NoteMovesSettings.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      this.rows = DEFAULT_NOTE_MOVE_NAMES.map((name) => ({ name }));
      this.render();
    });
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const names = expanded.rows
      ? Object.values(expanded.rows)
          .map((r) => (r?.name ?? "").trim())
          .filter(Boolean)
      : [];
    await game.settings.set(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES, names.join(", "));
  }
}
