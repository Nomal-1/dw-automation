import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { getLogicalMode, setLogicalMode, nextLogicalMode } from "../lib/logical-state.js";

// 위저드 무브 논리적(Logical) 원문: "엄밀한 추론으로 주변을 분석할 때,
// WIS 대신 INT로 상황 파악(Discern Realities)을 할 수 있다." 매번
// 판정 능력치를 바꿔치기할지 결정해야 하는 무브라 협박/정밀 태그와 같은
// 구조를 쓰되, 사용자 요청대로 세 가지 상태를 순환하는 토글을 하나 더
// 둔다: "매번 묻기"(판정마다 확인), "항상 적용"(묻지 않고 항상 INT로),
// "항상 미적용"(묻지 않고 항상 WIS 그대로).
//
// 매우 논리적(Highly Logical, 논리적의 6레벨 상위 무브) 원문의 "12+면
// 목록에 없는 질문도 3개까지 물어볼 수 있다"는 부분은 판정 결과가 나온
// 뒤에 채팅으로 안내만 한다(질문 자체는 자유 서술이라 자동화 대상이
// 아니다) — 이번 판정에서 정말 INT를 썼는지까지는 알 수 없어서(항상
// 미적용 모드로 그냥 WIS로 굴렸을 수도 있으므로), "미적용" 모드만 아니면
// 안내한다는 근사치로 처리한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_LOGICAL_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findHighlyLogicalMove(actor) {
  const names = splitCommaList(SETTINGS.HIGHLY_LOGICAL_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

// 매우 논리적은 논리적의 6레벨 상위 무브라(무브 업그레이드 자동화가
// 배우는 순간 하위 무브인 논리적을 지운다) 매우 논리적만 가진 캐릭터에게는
// "논리적" 이름의 무브 아이템 자체가 더 이상 존재하지 않는다 — 토글
// 배지/자동화가 여기서 찾는 대상은 둘 중 실제로 갖고 있는 쪽이다.
function findLogicalMove(actor) {
  const names = splitCommaList(SETTINGS.LOGICAL_MOVE_NAMES);
  const move = actor.items.find((i) => i.type === "move" && names.includes(i.name));
  return move ?? findHighlyLogicalMove(actor);
}

function matchesDiscernRealities(title) {
  return splitCommaList(SETTINGS.DISCERN_REALITIES_MOVE_NAMES).includes(title);
}

// lib/roll-wrapper.js가 판정 "직전"에 협박/정밀과 같은 자리에서 호출한다.
export async function promptLogicalPreRoll(item) {
  if (!isEnabled()) return { statOverride: null };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { statOverride: null };
  if (!matchesDiscernRealities(item.name)) return { statOverride: null };

  const moveItem = findLogicalMove(actor);
  if (!moveItem) return { statOverride: null };

  const mode = getLogicalMode(actor);
  if (mode === "off") return { statOverride: null };

  let apply = true;
  if (mode === "ask") {
    apply = await Dialog.confirm({
      title: moveItem.name,
      content: `<p>${game.i18n.localize("DWAUTO.Logical.Prompt")}</p>`,
      defaultYes: false
    });
  }
  if (!apply) return { statOverride: null };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.Logical.Applied"));
  return { statOverride: "INT" };
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, isExtreme } = info;
    if (actor.type !== "character") return;
    if (!isExtreme) return;
    if (!matchesDiscernRealities(title)) return;
    if (getLogicalMode(actor) === "off") return;

    const highlyLogicalMove = findHighlyLogicalMove(actor);
    if (!highlyLogicalMove) return;

    announceInfo(actor, game.i18n.localize("DWAUTO.Logical.HighlyLogicalBonus"));
  } catch (err) {
    console.error(`${MODULE_ID} | logical: onCreateChatMessage failed`, err);
  }
}

const MODE_LABEL_KEY = { ask: "DWAUTO.Logical.ModeAsk", on: "DWAUTO.Logical.ModeOn", off: "DWAUTO.Logical.ModeOff" };

// 무브 옆에 매번묻기/항상적용/항상미적용 배지 하나만 둔다(클릭할 때마다
// 순서대로 순환). 플레이어/마스터 누구나 클릭할 수 있다.
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findLogicalMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-logical-badge").remove();

  const mode = getLogicalMode(actor);
  const $badge = $(
    `<a class="tag dwauto-logical-badge${mode !== "off" ? " dwauto-logical-on" : ""}" title="${game.i18n.localize("DWAUTO.Logical.ToggleTitle")}">${game.i18n.localize(MODE_LABEL_KEY[mode])}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setLogicalMode(actor, nextLogicalMode(mode));
  });
}

export function registerLogicalAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
