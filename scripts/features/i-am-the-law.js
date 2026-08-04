import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { setPendingRollBonus } from "../lib/roll-bonus-state.js";

// 팔라딘 I Am The Law 원문: "신의 권위를 내세워 NPC에게 명령을 내리면,
// roll+CHA. 성공(10+)이면 그들이 하나를 고르고, 당신은 그들을 상대로 +1
// forward를 받는다. 부분성공(7-9)이면 그들이 하나를 고른다(추가 효과
// 없음). 실패하면 그들은 하고 싶은 대로 하고, 당신은 그들을 상대로 -1
// forward를 받는다." "그들을 상대로"라는 제한은 자동 판별할 수 없지만,
// 원조/방해(Aid or Interfere)의 대상 지정 +1/-2와 완전히 같은 방식으로
// lib/roll-bonus-state.js의 "다음 판정 한 번" 보정(제한 없음)으로 단순화한다
// — 이 무브 자체가 rollType: CHA를 가진 실제 굴림이라 성공/부분성공/실패는
// 시스템이 그대로 판정해준다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_I_AM_THE_LAW_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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

    const names = splitCommaList(SETTINGS.I_AM_THE_LAW_MOVE_NAMES);
    if (!names.includes(title)) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    if (result === "success") {
      await setPendingRollBonus(actor, 1, moveItem.name);
      announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.IAmTheLaw.SuccessApplied"));
    } else if (result === "partial") {
      announceInfo(actor, game.i18n.localize("DWAUTO.IAmTheLaw.PartialInfo"));
    } else if (result === "failure") {
      await setPendingRollBonus(actor, -1, moveItem.name);
      announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.IAmTheLaw.FailureApplied"));
    }
  } catch (err) {
    console.error(`${MODULE_ID} | i-am-the-law: onCreateChatMessage failed`, err);
  }
}

export function registerIAmTheLawAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
