import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import {
  isDuelistParryActive,
  setDuelistParryActive,
  getDuelistParryAmount,
  setDuelistParryAmount
} from "../lib/duelist-parry-state.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 바드 무브 결투사의 호신술(Duelist’s Parry) 원문: "접근전을 할 때, 장갑
// +1 forward를 받는다." "forward"라 원래는 다음에 실제로 맞을 때 한 번만
// 적용되고 사라지는 효과지만, 이 모듈은 다른 forward류처럼 대기 플래그로
// 다루지 않고 "적용중/적용안됨" 배지 + 실제 장갑 수치 증감으로 직접
// 구현한다(GM 요청) — 접근전 판정 결과와 무관하게(성공/부분성공/실패
// 전부) 발동해서 장갑이 그 자리에서 +1 되고, 이후 이 캐릭터가 실제로
// 피해를 입는 첫 순간(features/hit-trigger.js가 감지해서 이 파일의
// deactivateDuelistParryOnHit를 호출)에 자동으로 꺼지면서 장갑도 -1
// 된다 — 그 "맞는 순간"의 피해 자체는 이미 시스템이 (아직 켜져 있던 +1
// 장갑으로) 계산을 끝낸 뒤에야 HP 갱신이 넘어오므로, 소급 재계산 없이
// 그냥 다음 피격부터 보너스가 빠지도록 끄기만 하면 된다.
//
// 장갑 수치는 armor-assistant.js의 전체 재계산(getModifierBreakdown)을
// 다시 부르지 않고, 오기(Underdog, features/underdog.js)와 같은 방식으로
// 델타(+1/-1)만 그 자리에서 system.attributes.ac.value에 직접 더하고
// 뺀다 — armor-assistant.js를 여기서 임포트하면 순환 참조가 생기기
// 때문이다(armor-assistant.js가 반대로 이 파일의
// getDuelistParryArmorContribution을 가져다 쓴다).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_DUELIST_PARRY_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 결투사의 호신비결(Duelist’s Block)은 호신술을 대체하는 상위판으로 원문이
// "접근전을 하면 장갑 +2 forward"(호신술은 +1)다. 둘 다 가지고 있어도 호신비결이
// 우선한다. 반환값은 { moveItem, amount }.
function findDuelistMove(actor) {
  const blockNames = splitCommaList(SETTINGS.DUELIST_BLOCK_MOVE_NAMES);
  const block = actor.items.find((i) => i.type === "move" && (blockNames.includes(i.name) || blockNames.includes(i.flags?.babele?.originalName)));
  if (block) return { moveItem: block, amount: 2 };

  const parryNames = splitCommaList(SETTINGS.DUELIST_PARRY_MOVE_NAMES);
  const parry = actor.items.find((i) => i.type === "move" && (parryNames.includes(i.name) || parryNames.includes(i.flags?.babele?.originalName)));
  return parry ? { moveItem: parry, amount: 1 } : null;
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

async function adjustArmor(actor, delta) {
  const current = Number(actor.system.attributes?.ac?.value) || 0;
  const next = Math.max(0, current + delta);
  await actor.update({ "system.attributes.ac.value": next });
  return next;
}

// armor-assistant.js의 장갑 재계산(전체 합산/툴팁)에 반영한다 — 무쇠의
// 몸(iron-hide.js)과 같은 패턴.
export function getDuelistParryArmorContribution(actor) {
  if (!isEnabled()) return null;
  if (actor.type !== "character") return null;

  const found = findDuelistMove(actor);
  if (!found) return null;
  if (!isDuelistParryActive(actor)) return null;

  return { source: found.moveItem.name, amount: getDuelistParryAmount(actor) };
}

async function activate(actor, moveItem, amount) {
  if (isDuelistParryActive(actor)) return;
  await setDuelistParryAmount(actor, amount);
  await setDuelistParryActive(actor, true);
  const armor = await adjustArmor(actor, amount);
  announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.DuelistParry.Activated", { armor }));
}

async function deactivate(actor, moveItem) {
  if (!isDuelistParryActive(actor)) return;
  const amount = getDuelistParryAmount(actor);
  await setDuelistParryActive(actor, false);
  const armor = await adjustArmor(actor, -amount);
  announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.DuelistParry.Deactivated", { armor }));
}

// features/hit-trigger.js가 이 액터의 HP가 실제로 줄어드는 게 확정된
// 직후(damage > 0) 호출한다. 결투사의 호신술이 없거나 이미 꺼져 있으면
// 조용히 통과한다.
export async function deactivateDuelistParryOnHit(actor) {
  if (!isEnabled()) return;
  if (actor.type !== "character") return;

  const found = findDuelistMove(actor);
  if (!found) return;
  if (!isDuelistParryActive(actor)) return;

  await deactivate(actor, found.moveItem);
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

    const found = findDuelistMove(actor);
    if (!found) return;

    await activate(actor, found.moveItem, found.amount);
  } catch (err) {
    console.error(`${MODULE_ID} | duelist-parry: onCreateChatMessage failed`, err);
  }
}

// 무브 옆에 적용중/적용안됨 배지. 자동으로 켜고 꺼지지만, 서사적으로 이미
// 상황이 바뀌었다고 판단되면 플레이어/마스터가 직접 켜거나 꺼도 된다(장갑
// 수치도 그 자리에서 같이 조정된다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const found = findDuelistMove(actor);
  if (!found) return;
  const { moveItem, amount } = found;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-duelist-parry-badge").remove();

  const active = isDuelistParryActive(actor);
  const $badge = $(
    `<a class="tag dwauto-duelist-parry-badge${active ? " dwauto-duelist-parry-on" : ""}" title="${game.i18n.localize("DWAUTO.DuelistParry.ToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.DuelistParry.Active" : "DWAUTO.DuelistParry.Inactive")}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (active) await deactivate(actor, moveItem);
    else await activate(actor, moveItem, amount);
  });
}

// 이 설정은 이후에 추가됐으므로 이미 번역을 적용해 둔 월드에는 영문 기본값이 남아 있다.
// 번역 이름표를 읽을 수 있고 값이 아직 영문 기본값 그대로일 때만 번역명으로 바꾼다.
async function migrateTranslateBlockName() {
  if (!game.user.isGM) return;
  const english = "Duelist’s Block";
  if (game.settings.get(MODULE_ID, SETTINGS.DUELIST_BLOCK_MOVE_NAMES) !== english) return;

  let translated = null;
  try {
    translated = (await getMoveNameMap()).get(english) ?? null;
  } catch (err) {
    // 번역 이름표를 못 읽으면 다음 로드에 다시 시도한다.
  }
  if (!translated) return;

  await game.settings.set(MODULE_ID, SETTINGS.DUELIST_BLOCK_MOVE_NAMES, translated);
}

export function registerDuelistParryAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.once("ready", () => {
    migrateTranslateBlockName().catch((err) => console.warn(`${MODULE_ID} | duelist block name migration failed`, err));
  });
}
