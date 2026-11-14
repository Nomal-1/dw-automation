import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { isThroughDeathsEyesActive, setThroughDeathsEyesActive } from "../lib/through-deaths-eyes-state.js";
import { filterDisabledNames, isMoveItemDisabled } from "../lib/move-toggles.js";

// 전사 고급액션 죽음의 예감(Through Death's Eyes) 원문: "전투에 들어갈 때
// +지혜 판정을 합니다. 실패하면, 자기 자신의 죽음을 예감하고 전투 동안
// 판정에 계속 -1을 받습니다." 부분성공/성공은 순수 서사(누가 살고 죽을지
// 지명)라 자동화하지 않는다 — 실패했을 때의 디메리트만 자동화한다. 판정
// 결과만 보면 바로 알 수 있어서(전사의 눈처럼 따로 물어볼 필요가 없다)
// 실패하면 곧바로 "불길함" 배지를 켠다. 전투가 언제 끝나는지는 알 수
// 없어서 끄는 시점은 마스터가 직접 정한다 — 배지는 마스터만 클릭할 수
// 있다.
function isEnabled() {
  return (
    game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_THROUGH_DEATHS_EYES_ASSISTANT)
  );
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

function findMove(actor) {
  const names = splitCommaList(SETTINGS.THROUGH_DEATHS_EYES_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && ((names.includes(i.name) || names.includes(i.flags?.babele?.originalName)) && !isMoveItemDisabled(i))) ?? null;
}

async function matchesConfiguredNameByTitle(title) {
  const configured = splitCommaList(SETTINGS.THROUGH_DEATHS_EYES_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Through Death’s Eyes") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
async function matchesConfiguredName(title, originalTitle = null) {
  const byTitle = await matchesConfiguredNameByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return await matchesConfiguredNameByTitle(originalTitle);
}

// lib/roll-wrapper.js가 매 판정마다 호출한다. "불길함"이 적용중이면 -1,
// 아니면 0(features/hit-trigger.js의 getOngoingPenaltyMalus와 같은 패턴).
export function getThroughDeathsEyesMalus(actor) {
  if (!isEnabled()) return 0;
  if (actor.type !== "character") return 0;
  if (!findMove(actor)) return 0;
  return isThroughDeathsEyesActive(actor) ? -1 : 0;
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, result, originalTitle } = info;
    if (actor.type !== "character") return;
    if (result !== "failure") return;

    if (!(await matchesConfiguredName(title, originalTitle))) return;

    const moveItem = findMove(actor);
    if (!moveItem) return;
    if (isThroughDeathsEyesActive(actor)) return; // 이미 켜져 있으면 그대로 둔다

    await setThroughDeathsEyesActive(actor, true);
    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.ThroughDeathsEyes.Activated"));
  } catch (err) {
    console.error(`${MODULE_ID} | through-deaths-eyes: onCreateChatMessage failed`, err);
  }
}

// 죽음의 예감 옆에 불길함 적용중/미적용 배지를 붙인다. 마스터만 클릭해서
// 켜고 끌 수 있다(플레이어는 못 건드린다) — 사용자 요청대로.
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-through-deaths-eyes-badge").remove();

  const active = isThroughDeathsEyesActive(actor);
  const $badge = $(
    `<a class="tag dwauto-through-deaths-eyes-badge${active ? " dwauto-through-deaths-eyes-on" : ""}" title="${game.i18n.localize("DWAUTO.ThroughDeathsEyes.ToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.ThroughDeathsEyes.Active" : "DWAUTO.ThroughDeathsEyes.Inactive")}</a>`
  );
  $tags.append($badge);

  if (!game.user.isGM) return;

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setThroughDeathsEyesActive(actor, !active);
  });
}

export function registerThroughDeathsEyesAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
