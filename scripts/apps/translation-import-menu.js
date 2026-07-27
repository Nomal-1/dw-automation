import { MODULE_ID } from "../constants.js";
import { isTranslationModuleActive, runTranslationImport, TRANSLATION_MODULE_ID } from "../lib/translation-import.js";

export class TranslationImportMenu extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-translation-import",
      title: game.i18n.localize("DWAUTO.TranslationImport.Title"),
      template: `modules/${MODULE_ID}/templates/translation-import.html`,
      width: 480,
      closeOnSubmit: false
    });
  }

  getData() {
    return {
      active: isTranslationModuleActive(),
      hint: game.i18n.localize("DWAUTO.TranslationImport.Hint"),
      detected: game.i18n.localize("DWAUTO.TranslationImport.Detected"),
      inactiveWarning: game.i18n.format("DWAUTO.TranslationImport.InactiveWarning", {
        moduleId: TRANSLATION_MODULE_ID
      })
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('[data-action="run-import"]').on("click", async (event) => {
      event.preventDefault();
      if (!isTranslationModuleActive()) return;

      const $button = $(event.currentTarget);
      $button.prop("disabled", true);
      try {
        const stats = await runTranslationImport();
        ui.notifications.info(
          game.i18n.format("DWAUTO.TranslationImport.Done", { matched: stats.matched, unmatched: stats.unmatched })
        );
      } finally {
        $button.prop("disabled", false);
      }
    });

    html.find('[data-action="close-menu"]').on("click", (event) => {
      event.preventDefault();
      this.close();
    });
  }

  // 저장 폼이 아니라 실행 버튼만 있는 도구창이라 별도 처리가 없다.
  async _updateObject() {}
}
