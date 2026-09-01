import { MODULE_ID } from "../constants.js";
import { createOrUpdateRaceCoreCompendium } from "../lib/race-core-compendium.js";

export class RaceCoreCompendiumMenu extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-race-core-compendium",
      title: game.i18n.localize("DWAUTO.RaceCoreCompendium.Title"),
      template: `modules/${MODULE_ID}/templates/race-core-compendium.html`,
      width: 480,
      closeOnSubmit: false
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("DWAUTO.RaceCoreCompendium.Hint")
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('[data-action="run-create"]').on("click", async (event) => {
      event.preventDefault();

      const $button = $(event.currentTarget);
      $button.prop("disabled", true);
      try {
        const { created, skipped } = await createOrUpdateRaceCoreCompendium();
        ui.notifications.info(game.i18n.format("DWAUTO.RaceCoreCompendium.Done", { created, skipped }));
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
