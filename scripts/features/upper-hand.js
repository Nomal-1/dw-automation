import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 야만전사 고급액션 주도권(The Upper Hand) 원문: "황천길 판정에 +1 상시
// 보너스를 받습니다." 황천길(Last Breath)의 rollType은 BOND(유대)라 원조/
// 방해·구인과 같은 시스템 결함으로 item.system.rollMod를 아예 읽지 않는다
// (features/aid-or-interfere.js 상단 주석 참고). 그래서 이 +1을 자동으로
// 반영할 수 없고, 판정 직전에 "유대 입력창에 직접 +1을 입력하라"는 안내를
// 매번 띄우는 수밖에 없다(features/recruit.js와 같은 방식이지만, 구인의
// -1은 한 번 쓰고 사라지는 대기 페널티인 반면 이건 상시 보너스라 별도
// 상태 없이 무브를 가지고 있으면 매번 안내한다).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_UPPER_HAND_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasUpperHand(actor) {
  const names = splitCommaList(SETTINGS.UPPER_HAND_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

async function matchesLastBreath(title) {
  const configured = splitCommaList(SETTINGS.LAST_BREATH_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Last Breath") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 지금 굴리려는 게 황천길이
// 아니거나 주도권이 없으면 조용히 통과한다.
export async function promptUpperHandPreRoll(item) {
  if (!isEnabled()) return;

  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  if (!hasUpperHand(actor)) return;
  if (!(await matchesLastBreath(item.name))) return;

  await Dialog.prompt({
    title: item.name,
    content: `<p>${game.i18n.localize("DWAUTO.UpperHand.ReminderContent")}</p>`,
    label: game.i18n.localize("DWAUTO.UpperHand.ReminderAck"),
    callback: () => {},
    rejectClose: false
  });
}

export function registerUpperHandAssistant() {
  // 훅이 따로 필요 없다 — roll-wrapper.js가 promptUpperHandPreRoll을 직접 불러서 쓴다.
}
