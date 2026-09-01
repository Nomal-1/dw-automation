import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceInfo } from "../lib/announce.js";

// 사냥꾼-엘프(종족 핵심 액션, data/race-core-moves.js 참고) 원문: "험난한
// 여정을 떠날 때, 어떤 역할을 맡건 10+인 것처럼 성공합니다." 실제 주사위
// 굴림 자체를 가짜로 굴려 던전월드 시스템의 성공 판정 카드를 흉내 내는
// 대신(깨지기 쉽고 위험), 실제 판정은 그대로 두고 결과가 10+가 아니었을
// 때만 "이 판정은 10+로 취급합니다"라는 안내와 함께 원문의 성공 결과
// 목록을 그대로 인용해 GM이 바로 적용할 수 있게 한다. 어느 역할(길잡이/
// 척후/보급담당)을 맡았는지는 이 모듈이 추적하지 않으므로 목록 전체를
// 보여준다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_RANGER_ELF_JOURNEY_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findRangerElfMove(actor) {
  const name = game.settings.get(MODULE_ID, SETTINGS.RANGER_ELF_MOVE_NAME);
  return actor.items.find((i) => i.type === "move" && i.name === name) ?? null;
}

function matchesPerilousJourney(title) {
  return splitCommaList(SETTINGS.PERILOUS_JOURNEY_MOVE_NAMES).includes(title);
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
    if (result === "success") return;
    if (!matchesPerilousJourney(title)) return;

    const raceMoveItem = findRangerElfMove(actor);
    if (!raceMoveItem) return;

    const journeyMoveItem = findMoveItem(actor, title);
    const successText = journeyMoveItem?.system?.moveResults?.success?.value ?? "";

    announceInfo(
      actor,
      game.i18n.format("DWAUTO.RangerElfJourney.ForcedSuccess", { move: raceMoveItem.name }) + successText
    );
  } catch (err) {
    console.error(`${MODULE_ID} | ranger-elf-journey: onCreateChatMessage failed`, err);
  }
}

export function registerRangerElfJourneyAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
