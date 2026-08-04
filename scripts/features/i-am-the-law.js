import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getIAmTheLawPending, setIAmTheLawPending, clearIAmTheLawPending } from "../lib/i-am-the-law-state.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";

// 팔라딘 I Am The Law 원문: "신의 권위를 내세워 NPC에게 명령을 내리면,
// roll+CHA. 성공(10+)이면 그들이 하나를 고르고, 당신은 "그들을 상대로" +1
// forward를 받는다. 부분성공(7-9)이면 그들이 하나를 고른다(추가 효과 없음).
// 실패하면 그들은 하고 싶은 대로 하고, 당신은 "그들을 상대로" -1 forward를
// 받는다.
//
// 원조/방해(Aid or Interfere)의 +1/-2는 "다음 판정 아무거나"라 lib/
// roll-bonus-state.js로 충분하지만, 이 무브는 "그 NPC를 상대로 한" 판정으로
// 원문이 못박고 있어서 같은 방식으로 단순화하면 안 된다는 피드백에 따라
// 전용 대기 상태(lib/i-am-the-law-state.js)로 분리했다: 성공/실패 시 곧바로
// 보정치를 걸지 않고 "대기 중" 상태만 켠다. 대기 중인 동안 액터가 어떤
// 판정을 하든(lib/roll-wrapper.js가 모든 판정 전에 호출하는
// promptIAmTheLawPreRoll) "이 판정이 그 NPC를 상대로 한 것입니까?"를
// 물어보고, "예"면 그 판정에 보정치를 적용하고 대기 상태를 끈다. "아니오"면
// 보정치를 그대로 아껴두고 판정은 평소대로 진행한다. 대기 중에 이 무브
// 자체를 다시 굴리려 하면 먼저 해소하라고 막는다(promptIAmTheLawPreRoll의
// 재진입 체크). 시트의 배지는 GM이 직접 꺼서(취소) 대기 상태를 풀 수도
// 있다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_I_AM_THE_LAW_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findMoveByConfiguredNames(actor) {
  const names = splitCommaList(SETTINGS.I_AM_THE_LAW_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, result } = info;
    if (actor.type !== "character") return;
    if (!result) return;

    const names = splitCommaList(SETTINGS.I_AM_THE_LAW_MOVE_NAMES);
    if (!names.includes(title)) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    if (result === "success") {
      await setIAmTheLawPending(actor, 1, moveItem.name);
      announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.IAmTheLaw.SuccessApplied"));
    } else if (result === "partial") {
      announceInfo(actor, game.i18n.localize("DWAUTO.IAmTheLaw.PartialInfo"));
    } else if (result === "failure") {
      await setIAmTheLawPending(actor, -1, moveItem.name);
      announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.IAmTheLaw.FailureApplied"));
    }
  } catch (err) {
    console.error(`${MODULE_ID} | i-am-the-law: onCreateChatMessage failed`, err);
  }
}

// lib/roll-wrapper.js가 액터가 굴리는 모든 판정 전에 호출한다. cancel: true면
// 그 판정 자체를 막는다(이미 대기 중인데 I Am The Law를 또 굴리려는 경우).
// bonus는 이번 판정에 그대로 더할 rollMod(대상 확인이 안 되면 0).
export async function promptIAmTheLawPreRoll(item) {
  if (!isEnabled()) return { cancel: false, bonus: 0 };

  const actor = item.actor;
  if (!actor) return { cancel: false, bonus: 0 };

  const pending = getIAmTheLawPending(actor);
  if (!pending) return { cancel: false, bonus: 0 };

  const names = splitCommaList(SETTINGS.I_AM_THE_LAW_MOVE_NAMES);
  if (names.includes(item.name)) {
    ui.notifications.warn(game.i18n.format("DWAUTO.IAmTheLaw.PendingBlocked", { name: actor.name }));
    return { cancel: true, bonus: 0 };
  }

  const confirmed = await Dialog.confirm({
    title: pending.source,
    content: `<p>${game.i18n.format("DWAUTO.IAmTheLaw.TargetPrompt", { name: pending.source })}</p>`,
    defaultYes: false
  });
  if (!confirmed) return { cancel: false, bonus: 0 };

  await clearIAmTheLawPending(actor);
  const signed = pending.amount >= 0 ? `+${pending.amount}` : `${pending.amount}`;
  announceActionApplied(actor, pending.source, game.i18n.format("DWAUTO.IAmTheLaw.TargetApplied", { amount: signed }));
  return { cancel: false, bonus: pending.amount };
}

// 무브 옆에 대기 상태 배지를 붙인다. 누구에게나 보이지만, GM만 클릭해서
// 끌 수 있다(그 NPC가 이미 죽었거나 다시는 마주칠 일이 없어 대기를 포기할
// 때 쓰는 탈출구 — "켜기"는 항상 판정 결과로만 자동으로 이뤄진다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findMoveByConfiguredNames(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  if ($tags.find(".dwauto-i-am-the-law-badge").length) return;

  const pending = getIAmTheLawPending(actor);
  const label = pending
    ? game.i18n.format("DWAUTO.IAmTheLaw.PendingOn", { amount: pending.amount >= 0 ? `+${pending.amount}` : `${pending.amount}` })
    : game.i18n.localize("DWAUTO.IAmTheLaw.PendingOff");

  const $badge = $(
    `<a class="tag dwauto-i-am-the-law-badge${pending ? " dwauto-i-am-the-law-on" : ""}" title="${game.i18n.localize("DWAUTO.IAmTheLaw.PendingTitle")}">${label}</a>`
  );
  $tags.append($badge);

  if (!game.user.isGM || !pending) return;
  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await clearIAmTheLawPending(actor);
  });
}

export function registerIAmTheLawAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
