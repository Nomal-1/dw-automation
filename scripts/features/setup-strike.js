import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { getPendingDamageForward, setPendingDamageForward } from "../lib/damage-forward-state.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { filterDisabledNames, isMoveItemDisabled } from "../lib/move-toggles.js";

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
  // 직업별 자동화 창에서 끈 액션은 목록에서 뺀다(lib/move-toggles.js)
  return filterDisabledNames([...new Set([...names, ...defaults])]);
}

function findSetupStrikeMove(actor) {
  const names = splitCommaList(SETTINGS.SETUP_STRIKE_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && ((names.includes(i.name) || names.includes(i.flags?.babele?.originalName)) && !isMoveItemDisabled(i))) ?? null;
}

function matchesMeleeByTitle(title) {
  return splitCommaList(SETTINGS.MELEE_MOVE_NAMES).includes(title);
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
function matchesMelee(title, originalTitle = null) {
  const byTitle = matchesMeleeByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return matchesMeleeByTitle(originalTitle);
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
    const { actor, title, originalTitle } = info;
    if (actor.type !== "character") return;

    if (!matchesMelee(title, originalTitle)) return;

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
