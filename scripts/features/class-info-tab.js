import { injectActorTab } from "../lib/actor-tabs.js";
import { hasBalance, hasShapeshifter, renderBalanceSection, renderShapeshiftSection } from "./druid.js";

// 여러 직업별 기능(Druid Balance/Shapeshift, 나중에 Ranger 동반 동물 등)이
// 캐릭터 시트에 각자 새 탭을 따로 만들면 탭이 난립하므로, 공용 탭 하나를
// 여기서 만들고 각 기능은 "내가 그릴 내용이 있는지"만 판단해서 섹션을
// 추가하는 식으로 합친다. 그릴 섹션이 하나도 없으면(그 클래스의 무브를
// 하나도 안 갖고 있으면) 탭 자체를 만들지 않는다.
function getSectionRenderers(actor) {
  const renderers = [];
  if (hasBalance(actor)) renderers.push((body) => renderBalanceSection(body, actor));
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
    tabKey: "dwauto-class-info",
    navLabel: game.i18n.localize("DWAUTO.ClassInfo.TabLabel")
  });
  $body.addClass("dwauto-tab");

  for (const render of renderers) render($body);
}

export function registerClassInfoTab() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
