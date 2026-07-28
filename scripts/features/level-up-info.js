import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveNameMap, MOVE_PACK_FILES } from "../lib/translation-import.js";

// game.packs.get(id).getDocument(id) API는 실제로 존재하는지 확신할 수
// 없어서 쓰지 않는다 — 던전월드 시스템 자체(utility.js의 loadCompendia)가
// 검증된 방식으로 쓰는 pack.getDocuments()(무브 전체를 한 번에 가져와 캐시)를
// 그대로 따라한다.
const MOVE_PACK_IDS = MOVE_PACK_FILES.map((file) => file.replace(/\.json$/, ""));
let cachedMoveDocs = null;

async function getAllMoveDocuments() {
  if (cachedMoveDocs) return cachedMoveDocs;

  const lists = await Promise.all(
    MOVE_PACK_IDS.map(async (packId) => {
      const pack = game.packs.get(packId);
      if (!pack) return [];
      try {
        return await pack.getDocuments();
      } catch (err) {
        console.warn(`${MODULE_ID} | level-up-info: failed to load pack ${packId}`, err);
        return [];
      }
    })
  );

  cachedMoveDocs = lists.flat();
  return cachedMoveDocs;
}

// 던전월드 시스템의 레벨업 창(actor-sheet.js의 _onLevelUp)은 그냥 평범한
// Foundry Dialog라서 renderDialog 훅으로 잡아서 두 가지를 한다:
//   1) 화면에 이미 뜬 무브마다 선행조건 정보를 한 줄 덧붙인다.
//   2) 번역된 이름 비교 때문에 시스템이 "선행 무브를 이미 가지고 있다"는
//      걸 인식 못해서 아예 목록에 안 뜬 상위 무브를, 저희가 관리하는 "무브
//      업그레이드" 표 기준으로 직접 찾아서 "배우기" 버튼과 함께 별도
//      섹션에 추가로 보여준다. 이 버튼을 누르면 그 무브를 액터에게 직접
//      부여한다(시스템의 "확인" 버튼 흐름과 별개) — 부여되고 나면 기존
//      move-upgrades.js가 알아서 이전 단계 무브를 지운다.
// 시스템 코드 자체(무엇이 선택 가능한지 판정하는 로직)는 건드리지 않는다.
//
// Dialog 자체는 어떤 액터의 레벨업인지 알려주는 프로퍼티가 없어서, 캐릭터
// 시트의 "레벨업" 버튼 클릭을 별도로 관찰해서 마지막으로 클릭된 액터를
// 기억해뒀다가 쓴다(시스템의 원래 클릭 핸들러는 그대로 두고, 같은 버튼에
// 리스너를 하나 더 붙일 뿐이다).
let lastLevelUpActor = null;

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_MOVE_UPGRADE_ASSISTANT);
}

async function findMoveDocumentById(itemId) {
  const worldItem = game.items.get(itemId);
  if (worldItem) return worldItem;

  const docs = await getAllMoveDocuments();
  return docs.find((d) => d.id === itemId) ?? null;
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
//
// 표에 등록된 쌍이라도 deletesPrevious가 false("필요" 관계)면 배워도 이전
// 무브가 사라지지 않으므로 "RequiresOnly" 문구를 쓴다 — 표에 아예 없어서
// 시스템 필드로만 판단한 경우와 같은 문구다(둘 다 "그대로 유지된다"는
// 점에서 실제로 같은 뜻이기 때문).
function buildInfoLine(moveDoc, nameMap) {
  const upgradeRow = getUpgradeRowFor(moveDoc.name);
  const requiresEnglish = moveDoc.system?.requiresMove;

  if (!upgradeRow && !requiresEnglish) return null;

  const requiresDisplay = upgradeRow?.replacesName || nameMap.get(requiresEnglish) || requiresEnglish;
  if (!requiresDisplay) return null;

  const replaces = Boolean(upgradeRow) && upgradeRow.deletesPrevious !== false;
  const messageKey = replaces ? "DWAUTO.LevelUpInfo.Replaces" : "DWAUTO.LevelUpInfo.RequiresOnly";
  return game.i18n.format(messageKey, { requires: requiresDisplay });
}

async function annotateShownMoves(html, nameMap) {
  const shownNames = new Set();
  const inputs = html.find('input[data-type="move"]').toArray();

  for (const el of inputs) {
    const $input = $(el);
    const itemId = $input.attr("data-item-id");
    if (!itemId) continue;

    const moveDoc = await findMoveDocumentById(itemId);
    if (!moveDoc) continue;
    shownNames.add(moveDoc.name);

    const $content = $input.closest("li").find(".selection-content").first();
    if (!$content.length || $content.find(".dwauto-upgrade-info").length) continue;

    const line = buildInfoLine(moveDoc, nameMap);
    if (!line) continue;

    $content.prepend(`<p class="dwauto-upgrade-info"><i class="fas fa-arrow-up-right-dots"></i> ${line}</p>`);
  }

  return shownNames;
}

// 무브 업그레이드 표를 훑어서 "선행 무브는 이미 갖고 있는데(번역된 이름
// 기준) 상위 무브는 아직 없고, 그런데 화면에도 안 뜬" 경우만 골라낸다 —
// 바로 이게 시스템의 번역 미대응 버그로 목록에서 빠진 무브들이다.
async function findMissingEligibleUpgrades(actor, shownNames, docs) {
  if (!actor) return [];

  const table = game.settings.get(MODULE_ID, SETTINGS.MOVE_UPGRADES);
  const actorMoveNames = new Set(actor.items.filter((i) => i.type === "move").map((i) => i.name));

  const missing = [];
  for (const row of table) {
    if (!row.upgradeName || !row.replacesName) continue;
    if (actorMoveNames.has(row.upgradeName)) continue;
    if (!actorMoveNames.has(row.replacesName)) continue;
    if (shownNames.has(row.upgradeName)) continue;

    const moveDoc = docs.find((d) => d.name === row.upgradeName);
    if (moveDoc) missing.push({ moveDoc, replacesName: row.replacesName, deletesPrevious: row.deletesPrevious !== false });
  }
  return missing;
}

function injectMissingUpgradesSection(html, actor, missing) {
  if (missing.length === 0) return;
  if (html.find(".dwauto-missing-upgrades").length) return;

  const items = missing
    .map(
      ({ moveDoc, replacesName, deletesPrevious }) => `
        <li class="dwauto-missing-upgrade-item">
          <div class="selection-content">
            <h3>${moveDoc.name}</h3>
            <p class="dwauto-upgrade-info"><i class="fas fa-arrow-up-right-dots"></i> ${game.i18n.format(deletesPrevious ? "DWAUTO.LevelUpInfo.Replaces" : "DWAUTO.LevelUpInfo.RequiresOnly", { requires: replacesName })}</p>
            <div>${moveDoc.system?.description ?? ""}</div>
            <button type="button" class="dwauto-learn-move" data-move-id="${moveDoc.id}">${game.i18n.localize("DWAUTO.LevelUpInfo.LearnButton")}</button>
          </div>
        </li>
      `
    )
    .join("");

  const $section = $(`
    <section class="cell dwauto-missing-upgrades">
      <h2>${game.i18n.localize("DWAUTO.LevelUpInfo.MissingSectionTitle")}</h2>
      <p class="dwauto-missing-upgrades-hint">${game.i18n.localize("DWAUTO.LevelUpInfo.MissingSectionHint")}</p>
      <ul class="items-list">${items}</ul>
    </section>
  `);

  $section.find(".dwauto-learn-move").on("click", async (event) => {
    const moveId = event.currentTarget.dataset.moveId;
    const found = missing.find(({ moveDoc }) => moveDoc.id === moveId);
    if (!found) return;

    await actor.createEmbeddedDocuments("Item", [found.moveDoc.toObject()]);
    ui.notifications.info(game.i18n.format("DWAUTO.LevelUpInfo.LearnApplied", { move: found.moveDoc.name }));
    $(event.currentTarget).closest("li").remove();
  });

  const $advancedSection = html.find(".cell--advanced_moves").last();
  if ($advancedSection.length) {
    $advancedSection.after($section);
  } else {
    html.find(".dialog-content").first().append($section);
  }
}

async function enrichDialog(html) {
  const actor = lastLevelUpActor;
  const [nameMap, docs] = await Promise.all([getMoveNameMap(), getAllMoveDocuments()]);

  const shownNames = await annotateShownMoves(html, nameMap);
  const missing = await findMissingEligibleUpgrades(actor, shownNames, docs);
  injectMissingUpgradesSection(html, actor, missing);
}

// 시스템의 레벨업 대화상자는 별도 클래스/id가 없는 평범한 Dialog라서, 안에
// 무브 선택 체크박스(data-type="move")가 있는지로 감지한다. enrichDialog는
// 실패해도 "Error detected in module" 배너가 뜨지 않도록 여기서 잡아서
// console.error로만 남긴다.
function onRenderDialog(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!isEnabled()) return;
  if (!html.find('input[data-type="move"]').length) return;

  enrichDialog(html).catch((err) => {
    console.error(`${MODULE_ID} | level-up-info: failed to annotate level-up dialog`, err);
  });
}

// 시스템이 이미 ".clickable-level-up"에 붙여둔 클릭 핸들러는 그대로 두고,
// 같은 버튼에 리스너를 하나 더 얹어서 "이 레벨업이 어떤 액터의 것인지"만
// 기록해둔다.
function onRenderActorSheet(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!isEnabled()) return;

  html.find(".clickable-level-up").off("click.dwautoLevelUp").on("click.dwautoLevelUp", () => {
    lastLevelUpActor = app.actor;
  });
}

export function registerLevelUpInfo() {
  Hooks.on("renderDialog", onRenderDialog);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
