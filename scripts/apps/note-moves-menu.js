import { MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_NOTE_MOVE_NAMES } from "../data/note-moves.js";
import { annotateRowsWithClass, sortRowsByClass } from "../lib/move-class-lookup.js";

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

  // 클레릭 Deity/팔라딘 Quest/레인저 Animal Companion처럼 여러 직업 무브가
  // 한 표에 섞여 있어(사용자가 직접 지적한 혼란 지점), 어느 직업 것인지
  // 배지로 보여주고 그 기준으로 묶어서 정렬한다(lib/move-class-lookup.js
  // 참고) — 표시/정렬 전용이라 실패해도 자동화 자체에는 영향이 없다.
  async getData() {
    // add-row/remove-row가 data-index로 this.rows를 직접 찾으므로, 화면에
    // 보여주는 정렬 결과를 this.rows 자체에 반영해서 인덱스가 항상 일치하게
    // 한다(정렬 전용 classLabel 필드가 섞여 들어가도 저장 시에는 폼의 name
    // 입력값만 읽으므로 무해하다).
    try {
      this.rows = sortRowsByClass(await annotateRowsWithClass(this.rows));
    } catch (err) {
      console.warn(`${MODULE_ID} | note-moves-menu: class annotation failed`, err);
    }

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
