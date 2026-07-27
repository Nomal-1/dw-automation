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

        // 이 메뉴는 "모듈 설정" 화면 위에 뜬 별도 창이다. game.settings.set()으로
        // 값을 바꿔도 그 뒤에 이미 열려 있던 설정 화면(SettingsConfig)은 처음
        // 렌더링될 때의 값을 그대로 들고 있을 뿐 자동으로 새로고침되지 않는다
        // (실제 저장된 값은 바뀌어 있어서 게임 동작은 정상이지만, 화면에는 예전
        // 값이 남아 있는 것처럼 보인다). 열려 있다면 강제로 다시 그려서 방금
        // 바뀐 값을 바로 보여준다.
        const openSettingsConfig = Object.values(ui.windows).find((app) => app instanceof SettingsConfig);
        openSettingsConfig?.render();
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
