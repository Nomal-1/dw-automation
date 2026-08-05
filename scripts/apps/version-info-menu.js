import { MODULE_ID } from "../constants.js";

// Foundry의 설정 창은 메뉴(registerMenu, 버튼을 눌러 창을 여는 것들)를 항상
// 일반 설정(register, 켜기/끄기·글자 입력 칸)보다 먼저 보여준다 — 그래서
// 이 모듈 버전을 "맨 위에" 보이게 하려면 일반 설정이 아니라 메뉴로 등록해야
// 한다(settings.js에서 가장 먼저 등록한다). 처음엔 값을 저장할 필요가
// 없다는 이유로 Dialog를 그대로 menu type으로 재사용해봤는데, Foundry의
// 설정 메뉴 시스템이 FormApplication을 전제로 하는 부분이 있어서(정확히는
// 확인 못 했지만) 이 모듈의 설정 카테고리 전체가 설정 목록에서 아예
// 사라지는 문제가 생겼다 — 그래서 다른 메뉴들과 완전히 같은 방식으로
// FormApplication + 템플릿을 쓴다.
export class VersionInfoMenu extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-version-info",
      title: game.i18n.localize("DWAUTO.Settings.ModuleVersion.Name"),
      template: `modules/${MODULE_ID}/templates/version-info.html`,
      width: 360,
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      version: game.modules.get(MODULE_ID)?.version ?? "?",
      content: game.i18n.localize("DWAUTO.VersionInfo.Content")
    };
  }

  async _updateObject() {}
}
