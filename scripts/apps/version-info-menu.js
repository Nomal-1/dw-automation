import { MODULE_ID } from "../constants.js";

// Foundry의 설정 창은 메뉴(registerMenu, 버튼을 눌러 창을 여는 것들)를 항상
// 일반 설정(register, 켜기/끄기·글자 입력 칸)보다 먼저 보여준다 — 그래서
// 이 모듈 버전을 "맨 위에" 보이게 하려면 일반 설정이 아니라 메뉴로 등록해야
// 한다(settings.js에서 가장 먼저 등록한다). 값을 저장할 필요가 없는 순수
// 안내용이라 FormApplication 대신 Dialog를 그대로 재사용한다 — Dialog도
// Application을 상속해서 render()가 있으므로 메뉴 type으로 그대로 쓸 수
// 있다.
export class VersionInfoMenu extends Dialog {
  constructor() {
    const version = game.modules.get(MODULE_ID)?.version ?? "?";
    super({
      title: game.i18n.localize("DWAUTO.Settings.ModuleVersion.Name"),
      content: `<p>${game.i18n.localize("DWAUTO.VersionInfo.Content")}</p><h2 style="text-align:center;">${version}</h2>`,
      buttons: {
        ok: { label: game.i18n.localize("DWAUTO.Confirm") }
      },
      default: "ok"
    });
  }
}
