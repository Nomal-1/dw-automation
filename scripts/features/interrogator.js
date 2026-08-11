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
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findInterrogatorMove(actor) {
  const names = splitCommaList(SETTINGS.INTERROGATOR_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 지금 굴리려는 무브가
// 협상이 아니거나, 이 액터가 협박을 갖고 있지 않으면 아무 것도 바꾸지
// 않는다({statOverride: null}).
export async function promptInterrogatorPreRoll(item) {
  if (!isEnabled()) return { statOverride: null };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { statOverride: null };

  const parleyNames = splitCommaList(SETTINGS.PARLEY_MOVE_NAMES);
  if (!parleyNames.includes(item.name)) return { statOverride: null };

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
