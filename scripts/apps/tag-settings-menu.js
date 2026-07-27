import { MODULE_ID, SETTINGS } from "../constants.js";
import { TAG_CATALOG } from "../data/tag-catalog.js";

export class TagSettingsMenu extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-tag-settings",
      title: game.i18n.localize("DWAUTO.TagSettings.Title"),
      template: `modules/${MODULE_ID}/templates/tag-settings.html`,
      width: 420,
      closeOnSubmit: true
    });
  }

  getData() {
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

  activateListeners(html) {
    super.activateListeners(html);
    html.find('[data-action="select-all"]').on("click", () => {
      html.find('input[type="checkbox"]').prop("checked", true);
    });
    html.find('[data-action="select-none"]').on("click", () => {
      html.find('input[type="checkbox"]').prop("checked", false);
    });
  }

  async _updateObject(event, formData) {
    const enabled = TAG_CATALOG.filter((tag) => formData[tag.key]).map((tag) => tag.key);
    await game.settings.set(MODULE_ID, SETTINGS.ENABLED_DAMAGE_TAGS, enabled);
  }
}
