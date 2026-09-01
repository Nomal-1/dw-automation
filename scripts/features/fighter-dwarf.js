import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";

// 전사-드워프(종족 핵심 액션, data/race-core-moves.js 참고) 원문: "누군가와
// 술을 같이 마시는 동안, 그 사람과 협상을 할 때 CHA 대신 CON으로 판정할 수
// 있습니다." "함께 술을 마시는 중인지"는 매번 서사적 판단이 필요해서
// 협박/정밀/익숙한 사냥감과 같은 방식으로 판정 직전마다 물어본다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_FIGHTER_DWARF_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findFighterDwarfMove(actor) {
  const names = splitCommaList(SETTINGS.FIGHTER_DWARF_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function matchesParley(title) {
  return splitCommaList(SETTINGS.PARLEY_MOVE_NAMES).includes(title);
}

// lib/roll-wrapper.js가 협박/정밀/논리적/익숙한 사냥감과 같은 자리에서
// 호출한다.
export async function promptFighterDwarfPreRoll(item) {
  if (!isEnabled()) return { statOverride: null };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { statOverride: null };
  if (!matchesParley(item.name)) return { statOverride: null };

  const moveItem = findFighterDwarfMove(actor);
  if (!moveItem) return { statOverride: null };

  const apply = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.FighterDwarf.Prompt")}</p>`,
    defaultYes: false
  });
  if (!apply) return { statOverride: null };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.FighterDwarf.Applied"));
  return { statOverride: "CON" };
}
