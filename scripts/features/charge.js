import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { promptActorMultiTarget } from "../lib/actor-target-picker.js";
import { setPendingRollBonus } from "../lib/roll-bonus-state.js";

// 팔라딘 무브 돌격(Charge!) 원문: "전투에 앞장서서 돌격을 이끌 때, 이끄는
// 아군들은 +1 forward를 받는다." rollType이 없는 서술형 무브(자기 자신
// forward 무브들과 같은 부류)라 클릭하면 바로 발동한다. "이끄는 아군들"이
// 여러 명일 수 있어(끝없는 전진과 달리) 필드 위 토큰 중 여러 명을 고를 수
// 있게 하고, 고른 각자에게 +1 forward(다음 판정 아무거나, roll-wrapper.js가
// 소모)를 건 뒤 채팅에 누가 받았는지 알린다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_CHARGE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchesConfiguredName(title) {
  return splitCommaList(SETTINGS.CHARGE_MOVE_NAMES).includes(title);
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title } = info;
    if (actor.type !== "character") return;

    if (!matchesConfiguredName(title)) return;

    const allies = await promptActorMultiTarget(actor, {
      title,
      label: game.i18n.localize("DWAUTO.Charge.TargetLabel"),
      excludeSelf: true
    });
    if (allies.length === 0) return;

    for (const ally of allies) {
      await setPendingRollBonus(ally, 1, title, null);
    }

    announceActionApplied(
      actor,
      title,
      game.i18n.format("DWAUTO.Charge.Applied", { names: allies.map((a) => a.name).join(", ") })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | charge: onCreateChatMessage failed`, err);
  }
}

export function registerChargeAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
