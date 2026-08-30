import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { isBamboozleActive, setBamboozleActive } from "../lib/bamboozle-state.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 바드 무브 현란한 말솜씨(Bamboozle) 원문: "누군가와 협상할 때, 7+면 그
// 사람을 상대로 한 판정에 +1 forward도 함께 받는다." +1이 "그 특정 상대를
// 대상으로 한 판정"에만 적용되는데, 잊지 못할 얼굴/찬탈자(features/
// self-forward.js)처럼 "지금 이 판정이 그 상황인지" 자동으로 알 방법이
// 없다. 다만 그 두 무브와 달리 GM이 미리 배지를 켜두는 방식 대신, 적용중인
// 동안 이 캐릭터가 판정을 할 때마다 매번 "이 판정이 현란한 말솜씨의
// 대상입니까?"를 물어서 그 자리에서 판단하게 한다(GM 요청) — 예라고
// 답하면 +1을 주고 바로 꺼지고, 아니오면 다음 판정에 또 물어보며 계속
// 대기한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_BAMBOOZLE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findBamboozleMove(actor) {
  const names = splitCommaList(SETTINGS.BAMBOOZLE_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function matchesParley(title) {
  return splitCommaList(SETTINGS.PARLEY_MOVE_NAMES).includes(title);
}

// lib/roll-wrapper.js가 판정 "직전"에 다른 사전 보정치들과 같은 자리에서
// 호출한다. 현란한 말솜씨가 없거나 적용중이 아니면 {bonus: 0}을 돌려주고
// 조용히 통과한다.
export async function promptBamboozlePreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { bonus: 0 };

  const moveItem = findBamboozleMove(actor);
  if (!moveItem) return { bonus: 0 };
  if (!isBamboozleActive(actor)) return { bonus: 0 };

  const isTarget = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.Bamboozle.TargetPrompt")}</p>`,
    defaultYes: false
  });
  if (!isTarget) return { bonus: 0 };

  await setBamboozleActive(actor, false);
  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.Bamboozle.Applied"));
  return { bonus: 1 };
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
    if (result !== "success" && result !== "partial") return; // 7+

    if (!matchesParley(title)) return;

    const moveItem = findBamboozleMove(actor);
    if (!moveItem) return;
    if (isBamboozleActive(actor)) return; // 이미 적용중이면 그대로 둔다

    await setBamboozleActive(actor, true);
    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.Bamboozle.Activated"));
  } catch (err) {
    console.error(`${MODULE_ID} | bamboozle: onCreateChatMessage failed`, err);
  }
}

// 무브 옆에 적용중/적용안됨 배지. 플레이어/마스터 누구나 클릭할 수
// 있다(헤라클레스의 욕망과 같은 이유 — 판정마다 묻는 다이얼로그가 실제
// 서사적 판단을 대신해줘서, 배지 자체는 개인 판단으로 켜고 꺼도 위험이
// 적다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findBamboozleMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-bamboozle-badge").remove();

  const active = isBamboozleActive(actor);
  const $badge = $(
    `<a class="tag dwauto-bamboozle-badge${active ? " dwauto-bamboozle-on" : ""}" title="${game.i18n.localize("DWAUTO.Bamboozle.ToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.Bamboozle.Active" : "DWAUTO.Bamboozle.Inactive")}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setBamboozleActive(actor, !active);
  });
}

// v0.101.0에서 청산유수(Con, 현란한 말솜씨의 6레벨 상위 무브)를 기본값에
// 추가했다. game.settings의 default는 그 설정을 한 번도 저장한 적 없는
// 세계에만 적용되므로, 이미 "Bamboozle"(또는 번역된 이름)만 저장해둔 GM은
// "자동 채우기"를 다시 눌러도 원래 목록에 "Con"이 아예 없어서 번역될 수가
// 없었다 — 목록에 없으면 그 자리에서 직접 추가해준다.
async function migrateAddConToBamboozle() {
  if (!game.user.isGM) return;

  const current = game.settings.get(MODULE_ID, SETTINGS.BAMBOOZLE_MOVE_NAMES);
  const names = splitCommaList(SETTINGS.BAMBOOZLE_MOVE_NAMES);
  if (names.includes("Con")) return;

  let conName = "Con";
  try {
    const nameMap = await getMoveNameMap();
    conName = nameMap.get("Con") ?? "Con";
  } catch (err) {
    // 번역 데이터를 못 읽으면 영문 이름으로 추가한다.
  }
  if (names.includes(conName)) return;

  const next = current ? `${current}, ${conName}` : conName;
  await game.settings.set(MODULE_ID, SETTINGS.BAMBOOZLE_MOVE_NAMES, next);
  console.log(`${MODULE_ID} | bamboozle: added "${conName}" to Bamboozle Move Names`);
}

export function registerBamboozleAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.once("ready", () => {
    migrateAddConToBamboozle();
  });
}
