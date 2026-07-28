import { injectActorTab } from "../lib/actor-tabs.js";
import { hasShapeshifter, renderShapeshiftSection, resetShapeshift } from "./druid.js";

// 지금은 드루이드 변신 상태만 여기 들어가지만, 나중에 다른 직업의 비슷한
// "액션을 실제로 써야 나타나는 상태 탭"이 필요해지면 이 파일에 같은 방식
// (조건 확인 -> 섹션 렌더러 추가)으로 보태면 된다. 그릴 섹션이 하나도
// 없으면(관련 액션을 아직 한 번도 안 썼으면) 탭 자체를 만들지 않는다.
function getSectionRenderers(actor) {
  const renderers = [];
  if (hasShapeshifter(actor)) renderers.push((body) => renderShapeshiftSection(body, actor));
  return renderers;
}

function onRenderActorSheet(app, html) {
  if (game.system.id !== "dungeonworld") return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const renderers = getSectionRenderers(actor);
  if (renderers.length === 0) return;

  const $body = injectActorTab({
    html,
    actor,
    tabKey: "dwauto-shapeshift",
    navLabel: game.i18n.localize("DWAUTO.Druid.ShapeshiftTabLabel"),
    onReset: () => resetShapeshift(actor)
  });
  $body.addClass("dwauto-tab");

  for (const render of renderers) render($body);
}

export function registerClassInfoTab() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
