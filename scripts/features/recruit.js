import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { isRecruitPenaltyPending, setRecruitPenaltyPending } from "../lib/recruit-penalty-state.js";

// 던전월드 기본 무브 구인(Recruit) 원문 중 "지원자를 돌려보내면 다음 구인
// 판정에 -1 forward를 받는다"만 다룬다. 실패(6-) 결과 자체("영향력 있고
// 부적합한 인물이 따라오겠다고 나선다")는 그 인물을 데려갈지 돌려보낼지
// GM/플레이어의 서사적 판단이라, 판정 직후 "제시된 사람을 모두 돌려보내는가"
// 만 물어보고 그렇다고 답하면 대기 플래그를 켠다.
//
// 구인의 rollType은 BOND(유대)다 — 원조/방해와 같은 시스템 결함으로,
// 유대 판정은 item.system.rollMod를 아예 읽지 않고 판정 시 뜨는 별도
// 입력창(dataset.value)만 본다(features/aid-or-interfere.js 상단 주석
// 참고). 그래서 -1을 rollMod로 자동 반영할 수 없고, 다음 구인 판정 직전에
// "유대 입력창에 직접 -1을 입력하라"는 안내를 띄우는 수밖에 없다. 다만
// 원조/방해의 본능 보너스와 달리 이 정보는 판정하는 사람 자신만 알면
// 되므로(다른 사람에게 전달할 필요가 없다) GM 중계 없이 그 자리에서 바로
// 안내한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_RECRUIT_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.RECRUIT_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Recruit") === title) return true;
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
    const { actor, title, result } = info;
    if (actor.type !== "character") return;
    if (result !== "failure") return;

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const turnedAway = await Dialog.confirm({
      title: moveItem.name,
      content: `<p>${game.i18n.localize("DWAUTO.Recruit.TurnAwayPrompt")}</p>`,
      defaultYes: false
    });
    if (!turnedAway) return;

    await setRecruitPenaltyPending(actor, true);
    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.Recruit.PenaltyPending"));
  } catch (err) {
    console.error(`${MODULE_ID} | recruit: onCreateChatMessage failed`, err);
  }
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 대기 중인 페널티가 있고
// 지금 굴리는 무브가 구인이면, 유대 입력창이 뜨기 전에 "직접 -1을
// 입력하라"는 안내를 먼저 띄우고 확인을 받아야만 그 다음(시스템의 유대
// 입력창)으로 넘어간다. 확인과 동시에 대기 플래그를 소모한다.
export async function promptRecruitPreRoll(item) {
  if (!isEnabled()) return;

  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  if (!isRecruitPenaltyPending(actor)) return;
  if (!(await matchesConfiguredName(item.name))) return;

  await Dialog.prompt({
    title: item.name,
    content: `<p>${game.i18n.localize("DWAUTO.Recruit.ReminderContent")}</p>`,
    label: game.i18n.localize("DWAUTO.Recruit.ReminderAck"),
    callback: () => {},
    rejectClose: false
  });

  await setRecruitPenaltyPending(actor, false);
}

export function registerRecruitAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
