import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";

// 전사-하플링(종족 핵심 액션, data/race-core-moves.js 참고) 원문: "작은
// 몸집을 유리하게 이용하면 위험 돌파 판정에 +1을 받습니다." "작은 몸집을
// 유리하게 이용했는지"는 매번 서사적 판단이 필요해서 도적-인간과 같은
// 방식으로 판정 직전마다 물어본다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_FIGHTER_HALFLING_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findFighterHalflingMove(actor) {
  const names = splitCommaList(SETTINGS.FIGHTER_HALFLING_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function matchesDefyDanger(title) {
  return splitCommaList(SETTINGS.DEFY_DANGER_MOVE_NAMES).includes(title);
}

// lib/roll-wrapper.js가 지식의 샘/도적-인간과 같은 자리에서 호출한다.
export async function promptFighterHalflingPreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { bonus: 0 };
  if (!matchesDefyDanger(item.name)) return { bonus: 0 };

  const moveItem = findFighterHalflingMove(actor);
  if (!moveItem) return { bonus: 0 };

  const apply = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.FighterHalfling.Prompt")}</p>`,
    defaultYes: false
  });
  if (!apply) return { bonus: 0 };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.FighterHalfling.Applied"));
  return { bonus: 1 };
}
