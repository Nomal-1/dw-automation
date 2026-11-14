import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";

// 전사 고급액션 협박(Interrogator) 원문: "When you parley using threats of
// violence as leverage, you may use STR instead of CHA." 협상(Parley)
// 판정을 굴리기 직전에 협박을 적용할지 물어보고, 적용하면 이번 판정에
// 한해서만 판정 능력치를 근력(STR)으로 바꿔치기한다 — 원문 그대로 "may
// use"라 강제가 아니라 매번 선택이다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_INTERROGATOR_ASSISTANT);
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

function findInterrogatorMove(actor) {
  const names = splitCommaList(SETTINGS.INTERROGATOR_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && (names.includes(i.name) || names.includes(i.flags?.babele?.originalName))) ?? null;
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 지금 굴리려는 무브가
// 협상이 아니거나, 이 액터가 협박을 갖고 있지 않으면 아무 것도 바꾸지
// 않는다({statOverride: null}).
export async function promptInterrogatorPreRoll(item) {
  if (!isEnabled()) return { statOverride: null };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { statOverride: null };

  const parleyNames = splitCommaList(SETTINGS.PARLEY_MOVE_NAMES);
  if (!(parleyNames.includes(item.name) || parleyNames.includes(item.flags?.babele?.originalName))) return { statOverride: null };

  const moveItem = findInterrogatorMove(actor);
  if (!moveItem) return { statOverride: null };

  const wantsToUse = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.Interrogator.Prompt")}</p>`,
    defaultYes: false
  });
  if (!wantsToUse) return { statOverride: null };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.Interrogator.Applied"));
  return { statOverride: "STR" };
}

export function registerInterrogatorAssistant() {
  // 훅이 따로 필요 없다 — roll-wrapper.js가 promptInterrogatorPreRoll을 직접 부른다.
}
