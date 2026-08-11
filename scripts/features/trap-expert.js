import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { getTrapExpertHold, setTrapExpertHold } from "../lib/trap-expert-state.js";

// 도적 핵심액션 덫 전문가(Trap Expert) 원문: 부분성공(7-9) 예비 1점,
// 성공(10+) 예비 3점. 신중함(Cautious, 2레벨) 원문: "덫 전문가를 사용하면
// 항상 예비 1점을 더 받습니다. 6-가 나와도 마찬가지입니다." — 신중함을
// 가진 캐릭터는 실패해도(원래 0점) 예비 1점을 받는다. 판정마다 이전 예비와
// 합산하지 않고 새 값으로 덮어쓴다(원문에 "쌓는다"는 언급이 없음, 수련
// 예비와는 다른 무브). 시스템 자체의 Hold 속성 대신 무브 옆 배지 숫자로만
// 보여주고, 플레이어/마스터 누구나 배지를 클릭하면 1씩 줄어든다(요청대로
// 다이얼로그 없이 단순 카운터).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_TRAP_EXPERT_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findMove(actor) {
  const names = splitCommaList(SETTINGS.TRAP_EXPERT_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function hasCautious(actor) {
  const names = splitCommaList(SETTINGS.CAUTIOUS_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.TRAP_EXPERT_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Trap Expert") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

const BASE_HOLD = { success: 3, partial: 1, failure: 0 };

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

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const cautious = hasCautious(actor);
    const hold = (BASE_HOLD[result] ?? 0) + (cautious ? 1 : 0);

    await setTrapExpertHold(actor, hold);

    const detail = cautious
      ? game.i18n.format("DWAUTO.TrapExpert.GainedWithCautious", { hold })
      : game.i18n.format("DWAUTO.TrapExpert.Gained", { hold });
    announceActionApplied(actor, moveItem.name, detail);
  } catch (err) {
    console.error(`${MODULE_ID} | trap-expert: onCreateChatMessage failed`, err);
  }
}

// 무브 옆에 "예비 N" 배지를 붙인다. 다이얼로그 없이 클릭 한 번마다 1씩
// 줄어들고, 플레이어/마스터 누구나 클릭할 수 있다(요청대로 GM 전용으로
// 막지 않는다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-trap-expert-badge").remove();

  const hold = getTrapExpertHold(actor);
  const $badge = $(
    `<a class="tag dwauto-trap-expert-badge${hold > 0 ? " dwauto-trap-expert-on" : ""}" title="${game.i18n.localize("DWAUTO.TrapExpert.BadgeTitle")}">${game.i18n.format("DWAUTO.TrapExpert.BadgeLabel", { hold })}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setTrapExpertHold(actor, Math.max(0, hold - 1));
  });
}

export function registerTrapExpertAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
