import { MODULE_ID } from "../constants.js";
import { isTranslationModuleActive, runTranslationImport, TRANSLATION_MODULE_ID } from "../lib/translation-import.js";
import { listOpenApps, getSettingsConfigClass } from "../lib/open-apps.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// 한글화 모듈의 번역 이름으로 액션 이름 목록을 채우는 도구창(ApplicationV2).
export class TranslationImportMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dwauto-translation-import",
    window: { title: "DWAUTO.TranslationImport.Title" },
    position: { width: 480 },
    actions: {
      "run-import": TranslationImportMenu.#onRunImport,
      "close-menu": TranslationImportMenu.#onCloseMenu
    }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/translation-import.html` } };

  async _prepareContext() {
    return {
      active: isTranslationModuleActive(),
      hint: game.i18n.localize("DWAUTO.TranslationImport.Hint"),
      detected: game.i18n.localize("DWAUTO.TranslationImport.Detected"),
      inactiveWarning: game.i18n.format("DWAUTO.TranslationImport.InactiveWarning", { moduleId: TRANSLATION_MODULE_ID })
    };
  }

  static async #onRunImport(event, button) {
    event.preventDefault();
    if (!isTranslationModuleActive()) return;
    button.disabled = true;
    try {
      const stats = await runTranslationImport();
      ui.notifications.info(game.i18n.format("DWAUTO.TranslationImport.Done", { matched: stats.matched, unmatched: stats.unmatched }));
      // 이미 열려 있던 모듈 설정 화면은 바뀐 값을 스스로 다시 그리지 않으므로 강제로 다시 그린다.
      const SettingsConfigClass = getSettingsConfigClass();
      const openSettingsConfig = SettingsConfigClass ? listOpenApps().find((app) => app instanceof SettingsConfigClass) : null;
      openSettingsConfig?.render();
    } finally {
      button.disabled = false;
    }
  }

  static #onCloseMenu(event) {
    event.preventDefault();
    this.close();
  }
}
