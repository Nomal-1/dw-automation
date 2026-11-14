import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { setPendingRollBonus } from "../lib/roll-bonus-state.js";
import { isSaferPlaceForwardPending, setSaferPlaceForwardPending } from "../lib/safer-place-state.js";

// 레인저 무브 이러면 안전하오(A Safe Place) 원문: "밤에 파수를 정하면,
// 모두가 파수(Take Watch)에 +1을 받는다." rollType이 없는 서술형 무브라
// 클릭하면 바로 발동한다. 원문은 "모두"지만 GM 요청대로 이 자동화는
// 아군 한 명을 지정하고, 그 아군과 자기 자신 둘에게만 파수 전용 +1
// forward를 건다(lib/roll-bonus-state.js, roll-wrapper.js가 이미 소모하는
// 일반 대기 보정치와 완전히 같은 방식 — restrictToMoveNames로 파수에만
// 한정).
//
// 이러면 더 안전하오(A Safer Place, 이러면 안전하오의 6레벨 상위 무브)는
// 같은 파수 보너스에 더해 "야영 후 파수를 정하면 모두 +1 forward(제한
// 없음)"도 준다 — 같은 두 대상에게 lib/safer-place-state.js의 별도
// 플래그로 하나 더 건다(파수 전용 슬롯과 별개라 서로 안 겹친다).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SAFE_PLACE_ASSISTANT);
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
  return [...new Set([...names, ...defaults])];
}

// 이러면 더 안전하오(Safer Place)를 얻으면 무브 업그레이드 자동화가 하위 무브인
// 이러면 안전하오를 지워 버리므로(data/move-upgrades.js), 상위 무브만 가진 캐릭터도
// 클릭하면 같은 자동화가 돌아야 한다. 그래서 두 무브 이름 모두 이 자동화의 대상이다.
function matchesConfiguredNameByTitle(title) {
  return (
    splitCommaList(SETTINGS.SAFE_PLACE_MOVE_NAMES).includes(title) ||
    splitCommaList(SETTINGS.SAFER_PLACE_MOVE_NAMES).includes(title)
  );
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
function matchesConfiguredName(title, originalTitle = null) {
  const byTitle = matchesConfiguredNameByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return matchesConfiguredNameByTitle(originalTitle);
}

function hasSaferPlace(actor) {
  const names = splitCommaList(SETTINGS.SAFER_PLACE_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && (names.includes(i.name) || names.includes(i.flags?.babele?.originalName)));
}

// lib/roll-wrapper.js가 판정 직전 다른 대기 보정치들과 같은 자리에서
// 호출한다. 이러면 더 안전하오의 "파수 이외 +1 forward" 대기가 없으면
// 조용히 통과한다.
export async function promptSaferPlaceForwardPreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { bonus: 0 };
  if (!isSaferPlaceForwardPending(actor)) return { bonus: 0 };

  await setSaferPlaceForwardPending(actor, false);
  announceActionApplied(actor, game.i18n.localize("DWAUTO.SafePlace.SaferPlaceLabel"), game.i18n.localize("DWAUTO.SafePlace.SaferForwardApplied"));
  return { bonus: 1 };
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

    if (!matchesConfiguredName(title, originalTitle)) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const ally = await promptActorTarget(actor, {
      title: moveItem.name,
      label: game.i18n.localize("DWAUTO.SafePlace.TargetLabel"),
      excludeSelf: true
    });
    if (!ally) return;

    const takeWatchNames = splitCommaList(SETTINGS.TAKE_WATCH_MOVE_NAMES);
    const targets = [actor, ally];
    for (const target of targets) {
      await setPendingRollBonus(target, 1, moveItem.name, takeWatchNames);
    }

    const isSafer = hasSaferPlace(actor);
    if (isSafer) {
      for (const target of targets) {
        await setSaferPlaceForwardPending(target, true);
      }
    }

    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format(isSafer ? "DWAUTO.SafePlace.AppliedSafer" : "DWAUTO.SafePlace.Applied", { name: ally.name })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | safe-place: onCreateChatMessage failed`, err);
  }
}

export function registerSafePlaceAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
