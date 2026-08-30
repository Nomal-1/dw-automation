import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 바드 무브 교활(Devious) 원문: "진솔한 대화를 할 때, '내가 이용할 수
// 있는 당신의 약점은 무엇인가?' 하는 질문도 할 수 있다(상대는 이 질문을
// 하지 못한다)." 진솔한 대화(Charming & Open)는 rollType이 아예 없는
// 무브(주사위 판정 없이 그 자리에서 바로 발동)라 성공/부분성공/실패
// 구분 없이, 이 무브가 발동될 때마다 추가된 질문을 알려주는 채팅 메시지를
// 띄운다(features/eye-for-weakness.js와 같은 패턴).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_DEVIOUS_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findDeviousMove(actor) {
  const names = splitCommaList(SETTINGS.DEVIOUS_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

async function matchesCharmingOpen(title) {
  const configured = splitCommaList(SETTINGS.CHARMING_OPEN_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Charming & Open") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
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

    if (!(await matchesCharmingOpen(title))) return;

    const moveItem = findDeviousMove(actor);
    if (!moveItem) return;

    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.Devious.ExtraChoice"));
  } catch (err) {
    console.error(`${MODULE_ID} | devious: onCreateChatMessage failed`, err);
  }
}

export function registerDeviousAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
