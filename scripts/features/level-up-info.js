import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 던전월드 시스템의 레벨업 창(actor-sheet.js의 _onLevelUp)은 그냥 평범한
// Foundry Dialog라서(id/title 등으로 별도 API가 없음) renderDialog 훅으로
// 잡아서 각 무브 항목에 선행조건 정보를 덧붙인다. 시스템 코드 자체는
// 건드리지 않는다 — 무브를 고를 수 있는지 없는지 판정 로직은 그대로 두고,
// 그 판정 결과 화면에 뜬 항목들에 "이 무브는 무엇을 전제로 하는지" 정보만
// 얹어서 보여준다.
//
// requiresMove 필드는 항상 영문 원본이라(Babele가 이 필드를 번역하지 않음),
// 화면에 보여줄 때는 (a) 무브 업그레이드 표에 등록된 쌍이면 그 표의 번역된
// replacesName을, (b) 등록되어 있지 않으면 dungeonworld-ko의 번역 데이터에서
// 찾은 이름을, (c) 그것도 없으면 영문 원본을 그대로 보여준다.

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_MOVE_UPGRADE_ASSISTANT);
}

// 레벨업 창의 무브 항목은 세계 아이템(game.items)이거나 클래스 무브
// 컴펜디엄 안의 아이템이다 — 둘 다 검색해서 찾는다.
async function findMoveDocumentById(itemId) {
  const worldItem = game.items.get(itemId);
  if (worldItem) return worldItem;

  for (const pack of game.packs.filter((p) => p.documentName === "Item")) {
    try {
      const doc = await pack.getDocument(itemId);
      if (doc) return doc;
    } catch (err) {
      // 이 팩에 없는 ID일 뿐이니 다음 팩을 계속 찾는다.
    }
  }
  return null;
}

function getUpgradeRowFor(moveName) {
  const table = game.settings.get(MODULE_ID, SETTINGS.MOVE_UPGRADES);
  return table.find((row) => row.upgradeName === moveName) ?? null;
}

function buildInfoLine(moveDoc, nameMap) {
  const requiresEnglish = moveDoc.system?.requiresMove;
  if (!requiresEnglish) return null;

  const upgradeRow = getUpgradeRowFor(moveDoc.name);
  const requiresDisplay = upgradeRow?.replacesName || nameMap.get(requiresEnglish) || requiresEnglish;

  const messageKey = upgradeRow ? "DWAUTO.LevelUpInfo.Replaces" : "DWAUTO.LevelUpInfo.RequiresOnly";
  return game.i18n.format(messageKey, { requires: requiresDisplay });
}

async function enrichDialog(html) {
  const nameMap = await getMoveNameMap();
  const inputs = html.find('input[data-type="move"]').toArray();

  for (const el of inputs) {
    const $input = $(el);
    const itemId = $input.attr("data-item-id");
    if (!itemId) continue;

    const $content = $input.closest("li").find(".selection-content").first();
    if (!$content.length || $content.find(".dwauto-upgrade-info").length) continue;

    const moveDoc = await findMoveDocumentById(itemId);
    if (!moveDoc) continue;

    const line = buildInfoLine(moveDoc, nameMap);
    if (!line) continue;

    $content.prepend(`<p class="dwauto-upgrade-info"><i class="fas fa-arrow-up-right-dots"></i> ${line}</p>`);
  }
}

function onRenderDialog(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!isEnabled()) return;
  if (app.data?.title !== "Level Up") return;

  enrichDialog(html);
}

export function registerLevelUpInfo() {
  Hooks.on("renderDialog", onRenderDialog);
}
