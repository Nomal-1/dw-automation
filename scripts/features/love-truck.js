import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { isLoveTruckActive, setLoveTruckActive } from "../lib/love-truck-state.js";
import { filterDisabledNames, isMoveItemDisabled } from "../lib/move-toggles.js";

// 바바리안 무브 너에 대한 내 사랑은 트럭 같아(My Love For You Is Like A
// Truck) 원문: "힘을 과시하는 행동을 할 때, 그 자리에 있는 감명받은 사람
// 한 명을 지목하고 그 사람과의 협상 판정에 +1 forward를 받는다." 원래는
// features/self-forward.js의 "다음 판정 한 번" 대기 보정치로 구현했었는데,
// GM 요청대로 "협상 판정을 한 번 쓰면 소모"가 아니라 전사의 눈(Seeing
// Red)과 같은 "적용중" 지속 효과로 바꿨다 — 협상을 몇 번을 해도 마스터가
// 직접 끄기 전까지는 계속 +1이 붙는다. self-forward.js가 이 무브를 더는
// 다루지 않도록 기본 목록과 이미 저장된 표에서도 제거했다(features/
// self-forward.js의 migrateRemoveLoveTruck 참고).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_LOVE_TRUCK_ASSISTANT);
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

function findLoveTruckMove(actor) {
  const names = splitCommaList(SETTINGS.LOVE_TRUCK_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && ((names.includes(i.name) || names.includes(i.flags?.babele?.originalName)) && !isMoveItemDisabled(i))) ?? null;
}

function matchesParleyByTitle(title) {
  return splitCommaList(SETTINGS.PARLEY_MOVE_NAMES).includes(title);
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
function matchesParley(title, originalTitle = null) {
  const byTitle = matchesParleyByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return matchesParleyByTitle(originalTitle);
}

// lib/roll-wrapper.js가 판정 직전 전사의 눈과 같은 자리에서 호출한다.
// 협상 판정이 아니거나, 이 무브가 없거나, "적용중"이 아니면 0.
export function getLoveTruckBonus(item) {
  if (!isEnabled()) return 0;

  const actor = item.actor;
  if (!actor || actor.type !== "character") return 0;

  if (!matchesParley(item.name)) return 0;
  if (!findLoveTruckMove(actor)) return 0;
  if (!isLoveTruckActive(actor)) return 0;

  return 1;
}

async function matchesConfiguredNameByTitle(title) {
  const configured = splitCommaList(SETTINGS.LOVE_TRUCK_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("My Love For You Is Like A Truck") === title) return true;
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

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, originalTitle } = info;
    if (actor.type !== "character") return;

    if (!(await matchesConfiguredName(title, originalTitle))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;
    if (isLoveTruckActive(actor)) return; // 이미 적용중이면 그대로 둔다

    await setLoveTruckActive(actor, true);
    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.LoveTruck.Activated"));
  } catch (err) {
    console.error(`${MODULE_ID} | love-truck: onCreateChatMessage failed`, err);
  }
}

// 무브 옆에 적용중/적용안됨 배지. 전사의 눈과 같은 이유로 GM만 켜고 끌 수
// 있다("그 상대와의 관계가 아직 유효한지"는 서사적 판단이 필요하다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findLoveTruckMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-love-truck-badge").remove();

  const active = isLoveTruckActive(actor);
  const $badge = $(
    `<a class="tag dwauto-love-truck-badge${active ? " dwauto-love-truck-on" : ""}" title="${game.i18n.localize("DWAUTO.LoveTruck.ToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.LoveTruck.Active" : "DWAUTO.LoveTruck.Inactive")}</a>`
  );
  $tags.append($badge);

  if (!game.user.isGM) return;

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setLoveTruckActive(actor, !active);
  });
}

export function registerLoveTruckAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
