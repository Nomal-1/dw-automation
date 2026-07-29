// NPC 시트에 기능별 탭(랜덤생성/몬스터 스탯/...)을 여러 개 주입할 때 공용으로 쓰는 헬퍼.
//
// Foundry의 기본 Tabs 컨트롤러는 재렌더링할 때마다 그 시점에 존재하는 DOM만 보고
// active 상태를 매기기 때문에, 매 렌더마다 새로 주입되는 탭은 활성 상태가 유지되지
// 않는다. 액터별로 "마지막으로 활성화된 탭"을 여기서 기억해뒀다가, 매 렌더 직후
// 다시 강제로 적용해준다.
const activeTabByActor = new Map();

export function setActiveTab(actorId, tabKey) {
  activeTabByActor.set(actorId, tabKey);
}

export function getActiveTab(actorId) {
  return activeTabByActor.get(actorId);
}

/**
 * 액터 시트의 primary 탭 그룹에 새 탭을 하나 추가한다.
 *
 * onReset을 넘기면(예: 특정 액션을 처음 사용해야 나타나는 탭) GM에게만
 * 보이는 초기화 버튼을 탭 맨 위에 붙인다 — 이런 "액션을 쓰면 자동으로
 * 생기는 탭"은 앞으로도 계속 생길 수 있어서, 되돌릴 방법을 매번 따로
 * 만들지 않도록 여기 공용으로 마련해뒀다.
 *
 * @returns {JQuery} 새로 추가된 탭 본문(.tab) 엘리먼트. 호출자가 내용을 채워 넣는다.
 */
export function injectActorTab({ html, actor, tabKey, navLabel, onReset }) {
  const $nav = html.find('.sheet-tabs[data-group="primary"]');
  const $navLink = $(`<a class="item" data-tab="${tabKey}">${navLabel}</a>`);
  $nav.append($navLink);

  const $tabBody = $(`<div class="tab dwauto-tab-body" data-group="primary" data-tab="${tabKey}"></div>`);
  html.find(".sheet-body").append($tabBody);

  if (onReset && game.user.isGM) {
    const $resetButton = $(
      `<button type="button" class="dwauto-tab-reset">${game.i18n.localize("DWAUTO.ActorTab.ResetButton")}</button>`
    );
    $tabBody.append($resetButton);

    $resetButton.on("click", async (event) => {
      event.preventDefault();
      const confirmed = await Dialog.confirm({
        title: game.i18n.localize("DWAUTO.ActorTab.ResetConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.ActorTab.ResetConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;
      await onReset();
      // 플래그만 지우면 대부분은 updateActor 훅으로 시트가 알아서 다시 그려지지만,
      // 플래그 변경 하나로는 감지가 안 되는 경우(예: 여러 플래그를 순차로 지울 때
      // 마지막 갱신만 감지되는 등)를 대비해 확실하게 직접 다시 그린다.
      actor.sheet?.render(false);
    });
  }

  if (getActiveTab(actor.id) === tabKey) {
    $nav.find(".item").removeClass("active");
    html.find(".sheet-body > .tab").removeClass("active");
    $navLink.addClass("active");
    $tabBody.addClass("active");
  }

  // 네임스페이스를 줘서 매 렌더마다 다시 바인딩해도 중복 등록되지 않게 한다.
  $nav.off("click.dwauto").on("click.dwauto", ".item", (event) => {
    setActiveTab(actor.id, event.currentTarget.dataset.tab);
  });

  return $tabBody;
}
