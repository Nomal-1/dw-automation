import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { getPendingDamageForward, setPendingDamageForward } from "../lib/damage-forward-state.js";
import { getPendingRollBonus, setPendingRollBonus } from "../lib/roll-bonus-state.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";

// 팔라딘 무브 협공(Tandem Strike, 연계 공격의 6레벨 상위 무브) 원문에
// 더해, GM 요청대로 접근전을 할 때 아군 한 명을 고르면 그 아군이 (1) 다음
// 판정 아무거나에 +1(연계 공격에는 없던 부분), (2) 다음 접근전/사격/마법
// 공격에 +1d4 피해, 둘 다 받는다. 접근전 결과와 무관하게(성공/부분성공/
// 실패 전부) 발동한다.
//
// "지금 누가 이 효과를 받고 있는지" 배지는 연계 공격과 같은 방식으로
// pendingDamageForward/pendingRollBonus의 source가 이 무브 이름과 같은
// 액터를 찾아서 보여준다 — 둘 중 하나라도 아직 안 쓰였으면 "적용중"으로
// 표시한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_TANDEM_STRIKE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findTandemStrikeMove(actor) {
  const names = splitCommaList(SETTINGS.TANDEM_STRIKE_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function matchesMelee(title) {
  return splitCommaList(SETTINGS.MELEE_MOVE_NAMES).includes(title);
}

function findGrantedTarget(moveName) {
  return (
    game.actors.find(
      (a) => getPendingDamageForward(a)?.source === moveName || getPendingRollBonus(a)?.source === moveName
    ) ?? null
  );
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title } = info;
    if (actor.type !== "character") return;

    if (!matchesMelee(title)) return;

    const moveItem = findTandemStrikeMove(actor);
    if (!moveItem) return;

    const ally = await promptActorTarget(actor, {
      title: moveItem.name,
      label: game.i18n.localize("DWAUTO.TandemStrike.TargetLabel"),
      excludeSelf: true
    });
    if (!ally) return;

    const roll = new Roll("1d4", actor.getRollData());
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format("DWAUTO.TandemStrike.RollFlavor", { name: moveItem.name })
    });

    await setPendingDamageForward(ally, roll.total, moveItem.name);
    await setPendingRollBonus(ally, 1, moveItem.name, null);

    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.TandemStrike.Applied", { target: ally.name, amount: roll.total })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | tandem-strike: onCreateChatMessage failed`, err);
  }
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findTandemStrikeMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-tandem-strike-badge").remove();

  const target = findGrantedTarget(moveItem.name);
  const $badge = $(
    `<a class="tag dwauto-tandem-strike-badge${target ? " dwauto-tandem-strike-on" : ""}" title="${game.i18n.localize("DWAUTO.TandemStrike.BadgeTitle")}">${
      target
        ? game.i18n.format("DWAUTO.TandemStrike.BadgeOn", { name: target.name })
        : game.i18n.localize("DWAUTO.TandemStrike.BadgeOff")
    }</a>`
  );
  $tags.append($badge);
}

export function registerTandemStrikeAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
