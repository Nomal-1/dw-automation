import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 바바리안 무브 약점을 보는 눈(Eye for Weakness) 원문: "상황 파악을 할 때,
// '여기서 약하거나 취약한 곳은 어디입니까?'라는 질문을 물을 수 있는
// 목록에 추가한다." 시스템 자신의 상황 파악 채팅 카드는 이 무브를 모르는
// 고정된 선택지만 보여주므로, 이 무브를 가진 액터가 상황 파악을 굴릴
// 때마다(판정 결과와 무관하게) 추가된 선택지를 알려주는 채팅 메시지를
// 따로 띄운다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_EYE_FOR_WEAKNESS_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findEyeForWeaknessMove(actor) {
  const names = splitCommaList(SETTINGS.EYE_FOR_WEAKNESS_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && (names.includes(i.name) || names.includes(i.flags?.babele?.originalName))) ?? null;
}

async function matchesDiscernRealitiesByTitle(title) {
  const configured = splitCommaList(SETTINGS.DISCERN_REALITIES_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Discern Realities") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
async function matchesDiscernRealities(title, originalTitle = null) {
  const byTitle = await matchesDiscernRealitiesByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return await matchesDiscernRealitiesByTitle(originalTitle);
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, originalTitle } = info;
    if (actor.type !== "character") return;

    if (!(await matchesDiscernRealities(title, originalTitle))) return;

    const moveItem = findEyeForWeaknessMove(actor);
    if (!moveItem) return;

    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.EyeForWeakness.ExtraChoice"));
  } catch (err) {
    console.error(`${MODULE_ID} | eye-for-weakness: onCreateChatMessage failed`, err);
  }
}

export function registerEyeForWeaknessAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
