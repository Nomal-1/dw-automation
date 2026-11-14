import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceInfo } from "../lib/announce.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";

// 바드 무브 쇳소리(Metal Hurlant) 원문: "크게 소리를 지르거나 부서질 듯한
// 소리를 연주할 때, 대상을 하나 고르고 CON 판정. 10+면 대상이 1d10 피해를
// 입고 몇 분간 귀가 먹는다. 7-9면 대상에게는 그대로 피해를 입히지만
// 통제가 안 되어 마스터가 근처의 다른 대상을 하나 더 고른다." 이 모듈은
// 요청대로 피해 굴림만 자동화한다(귀먹음, 부분성공의 추가 대상 지정 같은
// 서사적 효과는 GM 몫으로 안내만 남긴다) — features/spell-damage.js와
// 같은 방식(주사위를 굴려서 채팅에 적용 버튼과 함께 올리고, 누구에게
// 적용할지는 지금 타겟팅된 대상을 보고 GM/플레이어가 버튼을 누른다)을
// 그대로 따른다.
const DAMAGE_FORMULA = "1d10";

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_METAL_HURLANT_ASSISTANT);
}

function splitCommaList(settingKey) {
  const parse = (value) =>
    String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const names = parse(game.settings.get(MODULE_ID, settingKey));
  // 이름 목록이면 설정 기본값(원문 영어 이름)도 항상 포함한다. 번역 자동 채우기가
  // 기본값을 한글로 바꿔 넣어도, 아이템의 원문 이름(flags.babele.originalName)으로
  // 계속 알아볼 수 있게 하기 위해서다. 한글 카드 제목과는 겹치지 않아 해가 없다.
  if (!settingKey.endsWith("Names")) return names;
  const defaults = parse(game.settings.settings.get(`${MODULE_ID}.${settingKey}`)?.default);
  return [...new Set([...names, ...defaults])];
}

function matchesConfiguredNameByTitle(title) {
  return splitCommaList(SETTINGS.METAL_HURLANT_MOVE_NAMES).includes(title);
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
function matchesConfiguredName(title, originalTitle = null) {
  const byTitle = matchesConfiguredNameByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return matchesConfiguredNameByTitle(originalTitle);
}

async function performMetalHurlantDamage(actor, moveItem, result) {
  const roll = new Roll(DAMAGE_FORMULA, actor.getRollData());
  await roll.evaluate();

  let rollHtml = await roll.render();
  if (roll.total < 0) {
    const $rollHtml = $("<div>").html(rollHtml);
    $rollHtml.find(".dice-total").first().text("0");
    rollHtml = $rollHtml.html();
  }

  const content = `
    <h3>${game.i18n.format("DWAUTO.MetalHurlant.Flavor", { name: moveItem.name })}</h3>
    ${rollHtml}
    <div class="chat-damage-buttons">
      <button type="button" class="button damage full-damage" data-action="damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyFullTitle")}"><i class="fas fa-user-minus"></i></button>
      <button type="button" class="button damage half-damage" data-action="half-damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyHalfTitle")}"><i class="fas fa-user-minus"></i> 1/2</button>
      <button type="button" class="button damage double-damage" data-action="double-damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyDoubleTitle")}"><i class="fas fa-user-minus"></i> 2X</button>
      <button type="button" class="button heal heal-damage" data-action="heal" title="${game.i18n.localize("DWAUTO.Attack.ApplyHealTitle")}"><i class="fas fa-user-plus"></i></button>
    </div>
  `;

  const chatData = { user: game.user.id, speaker: ChatMessage.getSpeaker({ actor }), content };
  if (game.dice3d) {
    await game.dice3d.showForRoll(roll, game.user, true, null, false);
  } else {
    chatData.sound = CONFIG.sounds.dice;
  }
  await ChatMessage.create(chatData);

  if (result === "partial") {
    announceInfo(actor, game.i18n.localize("DWAUTO.MetalHurlant.PartialNotice"));
  }
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, result, originalTitle } = info;

    if (!matchesConfiguredName(title, originalTitle)) return;
    if (result !== "success" && result !== "partial") return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    await performMetalHurlantDamage(actor, moveItem, result);
  } catch (err) {
    console.error(`${MODULE_ID} | metal-hurlant: onCreateChatMessage failed`, err);
  }
}

export function registerMetalHurlantAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
