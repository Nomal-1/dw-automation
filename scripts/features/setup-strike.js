import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { getPendingDamageForward, setPendingDamageForward } from "../lib/damage-forward-state.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";

// 팔라딘 무브 연계 공격(Setup Strike) 원문: "접근전을 할 때, 아군 한 명을
// 고른다. 그 아군의 다음 공격이 당신의 대상에게 +1d4 피해를 준다." 접근전
// 판정 결과와 무관하게(성공/부분성공/실패 전부) 발동해서 아군 한 명을
// 고르고, lib/damage-forward-state.js(features/attack-assistant.js가 다음
// 데미지 굴림에서 소모)에 +1d4를 얹는다.
//
// "지금 누가 이 효과를 받고 있는지" 배지는 별도 상태를 새로 만들지 않고
// pendingDamageForward의 source가 이 무브 이름과 같은 액터를 찾아서
// 보여준다 — attack-assistant.js가 실제로 소모하면 그 플래그 자체가
// 지워지므로 배지도 자동으로 "없음"으로 돌아온다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SETUP_STRIKE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findSetupStrikeMove(actor) {
  const names = splitCommaList(SETTINGS.SETUP_STRIKE_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function matchesMelee(title) {
  return splitCommaList(SETTINGS.MELEE_MOVE_NAMES).includes(title);
}

function findGrantedTarget(moveName) {
  return game.actors.find((a) => getPendingDamageForward(a)?.source === moveName) ?? null;
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

    const moveItem = findSetupStrikeMove(actor);
    if (!moveItem) return;

    const ally = await promptActorTarget(actor, {
      title: moveItem.name,
      label: game.i18n.localize("DWAUTO.SetupStrike.TargetLabel"),
      excludeSelf: true
    });
    if (!ally) return;

    const roll = new Roll("1d4", actor.getRollData());
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format("DWAUTO.SetupStrike.RollFlavor", { name: moveItem.name })
    });

    await setPendingDamageForward(ally, roll.total, moveItem.name);
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.SetupStrike.Applied", { target: ally.name, amount: roll.total })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | setup-strike: onCreateChatMessage failed`, err);
  }
}

// 무브 옆에 "지금 누가 이 효과를 받고 있는지" 배지를 보여준다(읽기 전용 —
// 실제로 소모되면 attack-assistant.js가 플래그를 지워서 자동으로 사라진다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findSetupStrikeMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-setup-strike-badge").remove();

  const target = findGrantedTarget(moveItem.name);
  const $badge = $(
    `<a class="tag dwauto-setup-strike-badge${target ? " dwauto-setup-strike-on" : ""}" title="${game.i18n.localize("DWAUTO.SetupStrike.BadgeTitle")}">${
      target
        ? game.i18n.format("DWAUTO.SetupStrike.BadgeOn", { name: target.name })
        : game.i18n.localize("DWAUTO.SetupStrike.BadgeOff")
    }</a>`
  );
  $tags.append($badge);
}

export function registerSetupStrikeAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
