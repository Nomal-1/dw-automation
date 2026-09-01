import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";

// 도적-인간(종족 핵심 액션, data/race-core-moves.js 참고) 원문: "범죄계에
// 익숙합니다. 범죄 활동에 관해 지식 더듬기나 상황 파악을 할 때 +1을
// 받습니다." "범죄 활동에 관한 것인지"는 매번 서사적 판단이 필요해서
// 협박/정밀/익숙한 사냥감과 같은 방식으로 판정 직전마다 물어본다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_THIEF_HUMAN_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findThiefHumanMove(actor) {
  const names = splitCommaList(SETTINGS.THIEF_HUMAN_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function matchesSpoutLoreOrDiscernRealities(title) {
  return (
    splitCommaList(SETTINGS.SPOUT_LORE_MOVE_NAMES).includes(title) ||
    splitCommaList(SETTINGS.DISCERN_REALITIES_MOVE_NAMES).includes(title)
  );
}

// lib/roll-wrapper.js가 지식의 샘/이러면 더 안전하오와 같은 자리에서
// 호출한다.
export async function promptThiefHumanPreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { bonus: 0 };
  if (!matchesSpoutLoreOrDiscernRealities(item.name)) return { bonus: 0 };

  const moveItem = findThiefHumanMove(actor);
  if (!moveItem) return { bonus: 0 };

  const apply = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.ThiefHuman.Prompt")}</p>`,
    defaultYes: false
  });
  if (!apply) return { bonus: 0 };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.ThiefHuman.Applied"));
  return { bonus: 1 };
}
