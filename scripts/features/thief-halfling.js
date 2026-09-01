import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";

// 도적-하플링(종족 핵심 액션, data/race-core-moves.js 참고) 원문: "원거리
// 무기로 공격할 때 피해를 +2 더 줍니다." 조건 확인이 필요 없는 상시 보정치라
// 익숙한 사냥감처럼 매번 물어보지 않고, features/command.js의
// getCommandDamageBonus처럼 원거리 공격일 때만 조용히 데미지 굴림에
// 더한다(features/attack-assistant.js의 handleAmmoAndRoll이 호출한다).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_THIEF_HALFLING_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findThiefHalflingMove(actor) {
  const names = splitCommaList(SETTINGS.THIEF_HALFLING_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

export function getThiefHalflingRangedBonus(actor, isRanged) {
  if (!isEnabled()) return "";
  if (!isRanged) return "";

  const moveItem = findThiefHalflingMove(actor);
  if (!moveItem) return "";

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.ThiefHalfling.Applied"));
  return "2";
}
