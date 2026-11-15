import { MODULE_ID, SETTINGS } from "../constants.js";
import { TAG_CATALOG } from "../data/tag-catalog.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// 데미지 태그 자동화에서 어떤 태그를 쓸지 고르는 창(ApplicationV2 폼).
export class TagSettingsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dwauto-tag-settings",
    tag: "form",
    window: { title: "DWAUTO.TagSettings.Title" },
    position: { width: 420 },
    form: { handler: TagSettingsMenu.#onSubmit, closeOnSubmit: true },
    actions: {
      "select-all": TagSettingsMenu.#onSelectAll,
      "select-none": TagSettingsMenu.#onSelectNone
    }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/tag-settings.html` } };

  async _prepareContext() {
    const enabled = game.settings.get(MODULE_ID, SETTINGS.ENABLED_DAMAGE_TAGS);
    return {
      hint: game.i18n.localize("DWAUTO.TagSettings.Hint"),
      tags: TAG_CATALOG.map((tag) => ({
        key: tag.key,
        label: game.i18n.localize(tag.labelKey),
        checked: enabled.includes(tag.key)
      }))
    };
  }

  static #onSelectAll() {
    for (const box of this.element.querySelectorAll('input[type="checkbox"]')) box.checked = true;
  }

  static #onSelectNone() {
    for (const box of this.element.querySelectorAll('input[type="checkbox"]')) box.checked = false;
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    const enabled = TAG_CATALOG.filter((tag) => data[tag.key]).map((tag) => tag.key);
    await game.settings.set(MODULE_ID, SETTINGS.ENABLED_DAMAGE_TAGS, enabled);
  }
}
