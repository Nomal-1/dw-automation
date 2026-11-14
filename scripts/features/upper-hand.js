import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { filterDisabledNames, isMoveItemDisabled } from "../lib/move-toggles.js";

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
  const parse = (value) =>
    String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const names = parse(game.settings.get(MODULE_ID, settingKey));
  // 이름 목록이면 설정 기본값(원문 영어 이름)도 항상 포함한다. 번역 자동 채우기가
  // 기본값을 한글로 바꿔 넣어도, 아이템의 원문 이름(flags.babele.originalName)으로
  // 계속 알아볼 수 있게 하기 위해서다. 한글 카드 제목과는 겹치지 않아 해가 없다.
  if (!settingKey.endsWith("Names")) return names;
  const defaults = parse(game.settings.settings.get(`${MODULE_ID}.${settingKey}`)?.default);
  // 직업별 자동화 창에서 끈 액션은 목록에서 뺀다(lib/move-toggles.js)
  return filterDisabledNames([...new Set([...names, ...defaults])]);
}

function hasUpperHand(actor) {
  const names = splitCommaList(SETTINGS.UPPER_HAND_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && ((names.includes(i.name) || names.includes(i.flags?.babele?.originalName)) && !isMoveItemDisabled(i)));
}

async function matchesLastBreathByTitle(title) {
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

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
async function matchesLastBreath(title, originalTitle = null) {
  const byTitle = await matchesLastBreathByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return await matchesLastBreathByTitle(originalTitle);
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 지금 굴리려는 게 황천길이
// 아니거나 주도권이 없으면 조용히 통과한다.
export async function promptUpperHandPreRoll(item) {
  if (!isEnabled()) return;

  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  if (!hasUpperHand(actor)) return;
  if (!(await matchesLastBreath(item.name, item.flags?.babele?.originalName))) return;

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
