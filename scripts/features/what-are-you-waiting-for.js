import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { isWaitingForActive, setWaitingForActive } from "../lib/waiting-for-state.js";
import { filterDisabledNames, isMoveItemDisabled } from "../lib/move-toggles.js";

// 야만전사 고급액션 뭘 기다리는 거야?(What Are You Waiting For?) 원문: "적을
// 도발할 때 +체력 판정. 10+면 적들이 동료를 무시하고 당신에게 달려들고,
// 그들과 싸울 때 +2 추가 피해를 입힙니다." "적용중" 동안 계속 유지되는
// 효과라(전사의 눈과 같은 패턴) 배지로 관리한다. 10+가 뜨면 자동으로
// 켜지고(요청대로 마스터가 적용안됨 상태에서 직접 클릭해서 켤 수도 있다),
// 켜진 뒤에는 플레이어/마스터 누구나 클릭하면 꺼진다 — 켜는 쪽만 마스터로
// 제한하는 이유는 "적들이 이 캐릭터에게 달려드는 중"이라는 판정이 서사적
// 상황 파악을 필요로 해서다.
function isEnabled() {
  return (
    game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_WHAT_ARE_YOU_WAITING_FOR_ASSISTANT)
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
  const names = splitCommaList(SETTINGS.WHAT_ARE_YOU_WAITING_FOR_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && ((names.includes(i.name) || names.includes(i.flags?.babele?.originalName)) && !isMoveItemDisabled(i))) ?? null;
}

async function matchesConfiguredNameByTitle(title) {
  const configured = splitCommaList(SETTINGS.WHAT_ARE_YOU_WAITING_FOR_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("What Are You Waiting For?") === title) return true;
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

// features/attack-assistant.js가 데미지를 굴릴 때마다 부른다. "적용중"이면
// 조건 없이 +2, 아니면 빈 문자열.
export function getWhatAreYouWaitingForBonus(actor) {
  if (!isEnabled()) return "";
  if (!findMove(actor)) return "";
  return isWaitingForActive(actor) ? "2" : "";
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
    if (result !== "success") return;

    if (!(await matchesConfiguredName(title, originalTitle))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;
    if (isWaitingForActive(actor)) return; // 이미 켜져 있으면 그대로 둔다

    await setWaitingForActive(actor, true);
    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.WaitingFor.Activated"));
  } catch (err) {
    console.error(`${MODULE_ID} | what-are-you-waiting-for: onCreateChatMessage failed`, err);
  }
}

// 뭘 기다리는 거야? 옆에 적용중/적용안됨 배지를 붙인다. 꺼져 있을 때는
// 마스터만 켤 수 있고("적들이 달려드는 중"이라는 서사적 판단이 필요해서),
// 켜져 있을 때는 플레이어/마스터 누구나 꺼서 끝낼 수 있다.
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-waiting-for-badge").remove();

  const active = isWaitingForActive(actor);
  const $badge = $(
    `<a class="tag dwauto-waiting-for-badge${active ? " dwauto-waiting-for-on" : ""}" title="${game.i18n.localize("DWAUTO.WaitingFor.ToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.WaitingFor.Active" : "DWAUTO.WaitingFor.Inactive")}</a>`
  );
  $tags.append($badge);

  if (!active && !game.user.isGM) return; // 꺼져 있을 때 켜는 건 마스터만 가능

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setWaitingForActive(actor, !active);
  });
}

export function registerWhatAreYouWaitingForAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
