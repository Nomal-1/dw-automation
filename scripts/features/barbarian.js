import { MODULE_ID, SETTINGS } from "../constants.js";

// 바바리안 "죽기 좋은 날(A Good Day To Die)" 원문: "현재 HP가 자신의 CON
// 미만(또는 1, 둘 중 더 큰 쪽)인 동안 모든 판정에 +1 ongoing을 받는다."
// Formcrafter의 능력치 보정(druid.js의 getFormcrafterRollModifier)과 같은
// 이유로 매 판정마다 lib/roll-wrapper.js가 이 함수를 불러 실시간으로 계산한다
// — HP/CON은 액터 데이터에서 바로 읽을 수 있어 "지금 조건이 맞는지"를
// 수동 토글 없이 완전히 자동으로 판정할 수 있다. ongoing 보정이라 채팅에
// 따로 알리지 않는다(Formcrafter도 조용히 rollMod에만 반영하는 것과 동일한
// 이유 — 매 판정마다 메시지가 뜨면 시끄럽다).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_BARBARIAN_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasGoodDayToDie(actor) {
  const names = splitCommaList(SETTINGS.GOOD_DAY_TO_DIE_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

// lib/roll-wrapper.js가 매 판정마다 호출한다.
export function getGoodDayToDieBonus(actor) {
  if (!isEnabled()) return 0;
  if (!hasGoodDayToDie(actor)) return 0;

  const hp = Number(actor.system.attributes?.hp?.value) || 0;
  const con = Number(actor.system.abilities?.con?.value) || 0;
  const threshold = Math.max(con, 1);
  return hp < threshold ? 1 : 0;
}

export function registerBarbarianAssistant() {
  // 지금은 매 판정마다 값을 조회만 하는 순수 함수뿐이라 별도로 등록할
  // 이벤트가 없다(lib/roll-wrapper.js가 직접 호출) — 다른 바바리안 무브를
  // 추가할 때 이 파일에 이어서 등록하면 된다.
}
