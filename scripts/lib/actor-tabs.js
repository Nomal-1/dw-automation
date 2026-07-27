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
 * @returns {JQuery} 새로 추가된 탭 본문(.tab) 엘리먼트. 호출자가 내용을 채워 넣는다.
 */
export function injectActorTab({ html, actor, tabKey, navLabel }) {
  const $nav = html.find('.sheet-tabs[data-group="primary"]');
  const $navLink = $(`<a class="item" data-tab="${tabKey}">${navLabel}</a>`);
  $nav.append($navLink);

  const $tabBody = $(`<div class="tab dwauto-tab-body" data-group="primary" data-tab="${tabKey}"></div>`);
  html.find(".sheet-body").append($tabBody);

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
