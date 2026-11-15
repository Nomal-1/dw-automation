import { MODULE_ID } from "../constants.js";
import { createOrUpdateRaceCoreCompendium } from "../lib/race-core-compendium.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// 종족 액션 컴펜디엄을 만들거나 갱신하는 도구창(실행 버튼만 있는 ApplicationV2).
export class RaceCoreCompendiumMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dwauto-race-core-compendium",
    window: { title: "DWAUTO.RaceCoreCompendium.Title" },
    position: { width: 480 },
    actions: {
      "run-create": RaceCoreCompendiumMenu.#onRunCreate,
      "close-menu": RaceCoreCompendiumMenu.#onCloseMenu
    }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/race-core-compendium.html` } };

  async _prepareContext() {
    return { hint: game.i18n.localize("DWAUTO.RaceCoreCompendium.Hint") };
  }

  static async #onRunCreate(event, button) {
    event.preventDefault();
    button.disabled = true;
    try {
      const { created, skipped } = await createOrUpdateRaceCoreCompendium();
      ui.notifications.info(game.i18n.format("DWAUTO.RaceCoreCompendium.Done", { created, skipped }));
    } finally {
      button.disabled = false;
    }
  }

  static #onCloseMenu(event) {
    event.preventDefault();
    this.close();
  }
}
