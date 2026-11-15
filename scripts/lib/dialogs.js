// 옛 Dialog(V1) 형식의 설정을 그대로 받아 Foundry 14의 DialogV2로 띄우는 공통 도우미.
//
// 이 모듈에는 대화창이 100곳 넘게 있고, 모두 V1 형식이다:
//   new Dialog({ title, content, buttons: { yes: { label, callback(html) } }, default, close(html), render(html) }, { width })
//   Dialog.confirm({ title, content, defaultYes }) / Dialog.prompt({ title, content, label, callback(html) })
// V1 Dialog는 Foundry 16에서 없어진다. 한 곳씩 새로 쓰는 대신, 같은 형식을 받아서 DialogV2로 띄우고
// V1과 똑같이 동작하게 맞춘 이 도우미로 바꿨다(호출부는 `new Dialog(` → `new CompatDialog(` 정도만 바뀜).
//
// V1과 같게 맞춘 점:
// - 버튼 callback(html, event)의 html은 창 전체를 감싼 jQuery 객체 — html.find('[name=…]')가 그대로 된다.
// - callback은 기다리지 않는다(V1도 콜백을 부른 뒤 바로 창을 닫았다). 입력값은 콜백 첫 줄에서 읽으므로 문제없다.
// - close(html)는 창이 닫힐 때마다 불린다 — 버튼을 눌러 닫혀도 불린다(V1과 같음).
//   그래서 호출부는 "이미 답했는지"를 스스로 확인하는 기존 방식 그대로 쓰면 된다.
// - render(html)는 처음 그려졌을 때 한 번 불린다.
// - 다른 모듈은 renderDialogV2 훅으로 이 창에 끼어들 수 있다(예: 홈브루의 무기 선택 창 선택지).

const { DialogV2 } = foundry.applications.api;

export class CompatDialog extends DialogV2 {
  #v1;
  #renderedOnce = false;

  constructor(data = {}, options = {}) {
    const entries = Object.entries(data.buttons ?? {});
    const buttons = entries.map(([action, b]) => ({
      action,
      label: b.label ?? action,
      icon: b.icon ? String(b.icon).match(/class="([^"]+)"/)?.[1] ?? b.icon : undefined,
      default: action === data.default || (!data.default && entries.length === 1),
      callback: (event, button, dialog) => {
        try {
          const result = b.callback?.($(dialog.element), event);
          if (result instanceof Promise) result.catch((err) => console.error("dw-automation | dialog button failed", err));
        } catch (err) {
          console.error("dw-automation | dialog button failed", err);
        }
        return action;
      }
    }));
    if (!buttons.length) buttons.push({ action: "ok", label: game.i18n.localize("OK"), default: true });

    // DialogV2는 내용을 자기 <form> 안에 넣는다. V1 내용에 들어 있던 <form>…</form>을 그대로 두면
    // 브라우저가 안쪽 </form>에서 바깥 폼을 닫아 버려 버튼이 폼 밖으로 밀려난다 — 그래서 벗겨 낸다.
    // (html.find("form")은 DialogV2 자신의 폼을 찾으므로 호출부는 그대로 동작한다.)
    const content = String(data.content ?? "").replace(/<\/?form\b[^>]*>/gi, "");
    const config = {
      window: { title: data.title ?? "", resizable: !!options.resizable },
      content,
      buttons,
      position: { width: options.width ?? data.width ?? 400 }
    };
    if (options.height) config.position.height = options.height;
    if (options.id) config.id = options.id;
    if (options.classes) config.classes = options.classes;
    super(config);
    this.#v1 = data;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (this.#renderedOnce) return;
    this.#renderedOnce = true;
    try {
      this.#v1.render?.($(this.element));
    } catch (err) {
      console.error("dw-automation | dialog render callback failed", err);
    }
  }

  _onClose(options) {
    super._onClose(options);
    try {
      this.#v1.close?.($(this.element));
    } catch (err) {
      console.error("dw-automation | dialog close callback failed", err);
    }
  }
}

/** V1 Dialog.confirm과 같은 형식. 예 → true, 아니오·닫기 → false. */
export async function confirmDialog({ title, content, defaultYes = true } = {}) {
  const result = await DialogV2.confirm({
    window: { title: title ?? "" },
    content: content ?? "",
    yes: { default: defaultYes !== false },
    no: { default: defaultYes === false },
    rejectClose: false,
    modal: true
  });
  return result === true;
}

/** V1 Dialog.prompt와 같은 형식. 확인하면 callback(html)의 결과, 닫으면 null(rejectClose면 오류). */
export async function promptDialog({ title, content, label, callback, rejectClose = false } = {}) {
  return DialogV2.prompt({
    window: { title: title ?? "" },
    content: String(content ?? "").replace(/<\/?form\b[^>]*>/gi, ""),
    ok: {
      label: label ?? game.i18n.localize("OK"),
      callback: (event, button, dialog) => (callback ? callback($(dialog.element), event) : true)
    },
    rejectClose
  });
}
