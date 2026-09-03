import { MODULE_ID } from "../constants.js";
import { CATEGORY_ORDER, CATEGORY_LABELS, SETTING_CATEGORIES } from "../data/settings-categories.js";

// 이 모듈의 설정이 150개 넘게 쌓이면서 Foundry 기본 설정 화면(한 줄로 쭉
// 나열)이 너무 난잡해졌다는 GM 피드백에 따라, 순수 화면단에서 직업별/
// 기능별 탭으로 묶어 보여준다. 설정 키/저장 값/등록 순서는 전혀 건드리지
// 않는다 — renderSettingsConfig가 매번 새로 그린 DOM을 탭 구조로
// "재배치"만 할 뿐이라, 이 파일을 통째로 지워도(롤백해도) 설정 자체는
// 원래대로 한 줄 목록으로 정상 작동한다.
//
// 분류표(data/settings-categories.js)에 없는 키를 만나면 그냥 "기타" 탭에
// 넣는다 — 새 설정을 추가하고 분류표 갱신을 깜빡해도 화면에서 사라지는
// 일은 없다.
function findSettingKey(el, prefix) {
  const raw = el.getAttribute("name") || el.getAttribute("data-key") || "";
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : null;
}

function onRenderSettingsConfig(app, html) {
  const $html = html instanceof jQuery ? html : $(html);
  const prefix = `${MODULE_ID}.`;

  const $marked = $html.find(`[name^="${prefix}"], [data-key^="${prefix}"]`);
  if ($marked.length === 0) return;

  // 같은 행(.form-group) 안에 우리 이름을 가진 요소가 여러 개 있을 수 있어
  // (체크박스 + 숨은 필드 등) 행 단위로 한 번만 처리한다. Map의 삽입 순서를
  // 그대로 유지해서 원래 나열 순서를 보존한다.
  const rowCategories = new Map();
  $marked.each((_, el) => {
    const $row = $(el).closest(".form-group");
    if ($row.length === 0 || rowCategories.has($row[0])) return;

    const key = findSettingKey(el, prefix);
    rowCategories.set($row[0], key ? (SETTING_CATEGORIES[key] ?? null) : null);
  });

  if (rowCategories.size === 0) return;

  const firstRow = rowCategories.keys().next().value;
  const $marker = $('<div class="dwauto-settings-tabs-anchor"></div>');
  $(firstRow).before($marker);

  const UNCATEGORIZED = "_uncategorized";
  const containers = {};
  for (const category of [...CATEGORY_ORDER, UNCATEGORIZED]) {
    containers[category] = $(`<div class="dwauto-settings-category"></div>`);
  }

  for (const [rowEl, category] of rowCategories) {
    const target = containers[category] ?? containers[UNCATEGORIZED];
    target.append(rowEl);
  }

  const activeCategories = [...CATEGORY_ORDER, UNCATEGORIZED].filter((c) => containers[c].children().length > 0);
  if (activeCategories.length === 0) {
    $marker.remove();
    return;
  }

  const $nav = $('<nav class="dwauto-settings-tabs"></nav>');
  const $body = $('<div class="dwauto-settings-tab-body"></div>');

  activeCategories.forEach((category, index) => {
    const label =
      category === UNCATEGORIZED ? game.i18n.localize("DWAUTO.SettingsTabs.Other") : game.i18n.localize(CATEGORY_LABELS[category]);
    const isActive = index === 0;

    const $tab = $(`<a class="dwauto-settings-tab${isActive ? " active" : ""}" data-category="${category}">${label}</a>`);
    $nav.append($tab);

    const $container = containers[category];
    if (!isActive) $container.hide();
    $body.append($container);
  });

  $nav.on("click", ".dwauto-settings-tab", (event) => {
    event.preventDefault();
    const category = event.currentTarget.dataset.category;

    $nav.find(".dwauto-settings-tab").removeClass("active");
    $(event.currentTarget).addClass("active");

    for (const cat of activeCategories) {
      containers[cat].toggle(cat === category);
    }
  });

  $marker.replaceWith($nav);
  $nav.after($body);
}

export function registerSettingsTabs() {
  Hooks.on("renderSettingsConfig", onRenderSettingsConfig);
}
