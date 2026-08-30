import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import {
  isOnTheMoveAskMode,
  setOnTheMoveAskMode,
  isOnTheMoveActive,
  setOnTheMoveActive
} from "../lib/on-the-move-state.js";

// 바바리안 무브 재빠른 몸놀림(On The Move) 원문: "이동으로 인한 위험(좁은
// 다리에서 떨어지거나 무장한 경비병을 지나쳐 달리는 등)에 위험돌파로
// 대응할 때 +1." "지금 이 위험이 이동 때문인가"는 매번 서사적 판단이
// 필요해서, 헤라클레스의 욕망과 같은 구조(항상묻기/묻지않기 + 적용중/
// 적용안됨 토글 두 개)로 처리한다. 항상묻기 모드에서는 위험돌파 판정
// 직전마다 물어보고 그 답을 적용중 배지에도 그대로 반영해서(다음에 묻지
// 않기로 바꿔도 마지막 답이 이어진다), 묻지않기 모드에서는 배지 상태를
// 그대로 쓴다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_ON_THE_MOVE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findOnTheMove(actor) {
  const names = splitCommaList(SETTINGS.ON_THE_MOVE_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function matchesDefyDanger(title) {
  return splitCommaList(SETTINGS.DEFY_DANGER_MOVE_NAMES).includes(title);
}

// lib/roll-wrapper.js가 판정 "직전"에 다른 사전 보정치들과 같은 자리에서
// 호출한다. 재빠른 몸놀림이 없거나 지금 굴리려는 게 위험돌파가 아니면
// {bonus: 0}을 돌려주고 조용히 통과한다.
export async function promptOnTheMovePreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { bonus: 0 };
  if (!matchesDefyDanger(item.name)) return { bonus: 0 };

  const moveItem = findOnTheMove(actor);
  if (!moveItem) return { bonus: 0 };

  let apply;
  if (isOnTheMoveAskMode(actor)) {
    apply = await Dialog.confirm({
      title: moveItem.name,
      content: `<p>${game.i18n.localize("DWAUTO.OnTheMove.Prompt")}</p>`,
      defaultYes: false
    });
    // 물어봤을 때의 답을 적용중/적용안됨 배지에도 그대로 반영해둔다 — 나중에
    // "묻지 않기" 모드로 바꾸면 그 시점의 마지막 답이 그대로 이어진다.
    await setOnTheMoveActive(actor, apply);
  } else {
    apply = isOnTheMoveActive(actor);
  }
  if (!apply) return { bonus: 0 };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.OnTheMove.Applied"));
  return { bonus: 1 };
}

// 무브 옆에 배지 두 개를 붙인다: 묻기/묻지않기 모드, 적용중/적용안됨 상태.
// 둘 다 플레이어/마스터 누구나 클릭할 수 있다(헤라클레스의 욕망과 같은
// 이유 — 개인 판단 영역이라 GM 전용으로 막을 이유가 없다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findOnTheMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-on-the-move-ask-badge, .dwauto-on-the-move-active-badge").remove();

  const askMode = isOnTheMoveAskMode(actor);
  const $askBadge = $(
    `<a class="tag dwauto-on-the-move-ask-badge${!askMode ? " dwauto-on-the-move-on" : ""}" title="${game.i18n.localize("DWAUTO.OnTheMove.AskToggleTitle")}">${game.i18n.localize(askMode ? "DWAUTO.OnTheMove.AskOn" : "DWAUTO.OnTheMove.AskOff")}</a>`
  );
  $tags.append($askBadge);
  $askBadge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setOnTheMoveAskMode(actor, !askMode);
  });

  const active = isOnTheMoveActive(actor);
  const $activeBadge = $(
    `<a class="tag dwauto-on-the-move-active-badge${active ? " dwauto-on-the-move-on" : ""}" title="${game.i18n.localize("DWAUTO.OnTheMove.ActiveToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.OnTheMove.Active" : "DWAUTO.OnTheMove.Inactive")}</a>`
  );
  $tags.append($activeBadge);
  $activeBadge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setOnTheMoveActive(actor, !active);
  });
}

export function registerOnTheMoveAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
