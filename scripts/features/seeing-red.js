import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { isSeeingRedActive, setSeeingRedActive } from "../lib/seeing-red-state.js";
import { filterDisabledNames, isMoveItemDisabled } from "../lib/move-toggles.js";

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

function findSeeingRedMove(actor) {
  const names = splitCommaList(SETTINGS.SEEING_RED_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && ((names.includes(i.name) || names.includes(i.flags?.babele?.originalName)) && !isMoveItemDisabled(i))) ?? null;
}

async function matchesDiscernRealitiesByTitle(title) {
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

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
async function matchesDiscernRealities(title, originalTitle = null) {
  const byTitle = await matchesDiscernRealitiesByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return await matchesDiscernRealitiesByTitle(originalTitle);
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
    const { actor, title, originalTitle } = info;
    if (actor.type !== "character") return;

    if (!(await matchesDiscernRealities(title, originalTitle))) return;

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
