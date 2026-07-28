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

// 무브 업그레이드 표에 등록되어 있으면 그 표의 번역된 replacesName을 그대로
// 쓴다(있으면 항상 우선 — GM이 직접 관리하는 데이터라 컴펜디엄의
// requiresMove 필드 유무와 무관하게 신뢰할 수 있다). 표에 없을 때만
// system.requiresMove(항상 영문 원본)를 보고, 번역 데이터에서 찾은 이름
// 또는 영문 원본을 대신 보여준다. 둘 다 없으면(선행조건 자체가 없는 무브)
// null을 반환해서 아무것도 덧붙이지 않는다.
function buildInfoLine(moveDoc, nameMap) {
  const upgradeRow = getUpgradeRowFor(moveDoc.name);
  const requiresEnglish = moveDoc.system?.requiresMove;

  if (!upgradeRow && !requiresEnglish) return null;

  const requiresDisplay = upgradeRow?.replacesName || nameMap.get(requiresEnglish) || requiresEnglish;
  if (!requiresDisplay) return null;

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

// 시스템의 레벨업 대화상자는 별도 클래스/id가 없는 평범한 Dialog라서, 안에
// 무브 선택 체크박스(data-type="move")가 있는지로 감지한다 — Dialog 인스턴스의
// 내부 프로퍼티(제목 등)에 기대는 것보다 안전하다. enrichDialog는 실패해도
// "Error detected in module" 배너가 뜨지 않도록 이 함수 안에서 잡아서
// console.error로만 남긴다.
function onRenderDialog(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!isEnabled()) return;
  if (!html.find('input[data-type="move"]').length) return;

  enrichDialog(html).catch((err) => {
    console.error(`${MODULE_ID} | level-up-info: failed to annotate level-up dialog`, err);
  });
}

export function registerLevelUpInfo() {
  Hooks.on("renderDialog", onRenderDialog);
}
