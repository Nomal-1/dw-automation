import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";

// 레인저 무브 관찰력(Observant) 원문: "사냥과 추적(Hunt & Track)에서 10+가
// 나오면, 아래 목록에서 하나를 더 고를 수 있다." 시스템 자체 채팅 카드는
// 이 무브를 모르는 고정된 선택지만 보여주므로, 이 무브를 가진 액터가
// 사냥과 추적에서 10+(성공)를 띄울 때만(약점을 보는 눈과 달리 관찰력은
// RAW 자체가 10+ 조건부라 partial/failure에는 적용하지 않는다) 추가된
// 선택지를 알려주는 채팅 메시지를 따로 띄운다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_OBSERVANT_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findObservantMove(actor) {
  const names = splitCommaList(SETTINGS.OBSERVANT_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && (names.includes(i.name) || names.includes(i.flags?.babele?.originalName))) ?? null;
}

function matchesHuntTrackByTitle(title) {
  return splitCommaList(SETTINGS.HUNT_TRACK_MOVE_NAMES).includes(title);
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
function matchesHuntTrack(title, originalTitle = null) {
  const byTitle = matchesHuntTrackByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return matchesHuntTrackByTitle(originalTitle);
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, result, originalTitle } = info;
    if (actor.type !== "character") return;
    if (result !== "success") return;
    if (!matchesHuntTrack(title, originalTitle)) return;

    const moveItem = findObservantMove(actor);
    if (!moveItem) return;

    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.Observant.ExtraChoice"));
  } catch (err) {
    console.error(`${MODULE_ID} | observant: onCreateChatMessage failed`, err);
  }
}

export function registerObservantAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
