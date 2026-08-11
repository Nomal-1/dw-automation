import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { isSeeingRedActive, setSeeingRedActive } from "../lib/seeing-red-state.js";

// 전사 고급액션 전사의 눈(Seeing Red): 상황파악 판정 자체가 끝난 뒤(원래
// 판정 결과에는 영향을 주지 않고), 아직 "적용중" 상태가 아니라면 "지금이
// 전투중인가요?"를 물어본다. 그렇다고 답하면 배지를 "적용중"으로 바꾸고,
// 그 뒤로는 전투가 지속되는 동안 이 액터의 모든 판정에 자동으로 +1을
// 준다(상황파악 한정이 아니라 전투 지속시간 전체). 끄는 시점은 자동으로
// 알 수 없어 마스터가 배지를 직접 클릭해서 끈다 — 플레이어는 배지를
// 건드릴 수 없다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SEEING_RED_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findSeeingRedMove(actor) {
  const names = splitCommaList(SETTINGS.SEEING_RED_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

async function matchesDiscernRealities(title) {
  const configured = splitCommaList(SETTINGS.DISCERN_REALITIES_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Discern Realities") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다(다른 사전 보정치들과 같은
// 자리). 전사의 눈이 없거나 아직 "적용중"이 아니면 0을 반환한다 —
// 다이얼로그 없이 조용히 통과한다(물어보는 건 판정이 끝난 뒤
// onCreateChatMessage 쪽 몫이다). "적용중"이면 어떤 판정이든 +1이 붙는다
// (상황파악으로 한정하지 않는다 — 전투 지속시간 내내 적용).
export function getSeeingRedBonus(item) {
  if (!isEnabled()) return 0;

  const actor = item.actor;
  if (!actor || actor.type !== "character") return 0;

  if (!findSeeingRedMove(actor)) return 0;
  if (!isSeeingRedActive(actor)) return 0;

  return 1;
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

    if (!(await matchesDiscernRealities(title))) return;

    const moveItem = findSeeingRedMove(actor);
    if (!moveItem) return;
    if (isSeeingRedActive(actor)) return; // 이미 적용중이면 다시 안 물어본다

    const inCombat = await Dialog.confirm({
      title: moveItem.name,
      content: `<p>${game.i18n.localize("DWAUTO.SeeingRed.Prompt")}</p>`,
      defaultYes: false
    });
    if (!inCombat) return;

    await setSeeingRedActive(actor, true);
    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.SeeingRed.Activated"));
  } catch (err) {
    console.error(`${MODULE_ID} | seeing-red: onCreateChatMessage failed`, err);
  }
}

// 전사의 눈 옆에 적용중/적용안됨 배지를 붙인다. 사용자 요청대로 GM만
// 클릭해서 켜고 끌 수 있다(플레이어는 못 건드린다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findSeeingRedMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-seeing-red-badge").remove();

  const active = isSeeingRedActive(actor);
  const $badge = $(
    `<a class="tag dwauto-seeing-red-badge${active ? " dwauto-seeing-red-on" : ""}" title="${game.i18n.localize("DWAUTO.SeeingRed.ToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.SeeingRed.Active" : "DWAUTO.SeeingRed.Inactive")}</a>`
  );
  $tags.append($badge);

  if (!game.user.isGM) return;

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setSeeingRedActive(actor, !active);
  });
}

export function registerSeeingRedAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
