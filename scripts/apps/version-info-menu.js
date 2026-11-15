import { MODULE_ID } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// 설정 화면 맨 위에 모듈 버전을 보여주는 작은 창(ApplicationV2). Foundry 설정 창은 메뉴(registerMenu)를
// 일반 설정보다 먼저 보여주므로, 버전을 맨 위에 두려고 메뉴로 등록한다(settings.js에서 가장 먼저).
export class VersionInfoMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dwauto-version-info",
    tag: "form",
    window: { title: "DWAUTO.Settings.ModuleVersion.Name" },
    position: { width: 360 },
    form: { handler: () => {}, closeOnSubmit: true }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/version-info.html` } };

  async _prepareContext() {
    return {
      version: game.modules.get(MODULE_ID)?.version ?? "?",
      content: game.i18n.localize("DWAUTO.VersionInfo.Content")
    };
  }
}
