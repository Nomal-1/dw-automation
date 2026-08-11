import { MODULE_ID, SETTINGS } from "../constants.js";

// 전사 고급액션 무쇠의 몸(Iron Hide) 원문: "You gain +1 armor." 조건 없는
// 패시브라, 발동 절차가 따로 없다 — features/armor-assistant.js의 장갑
// 재계산 기여 목록에서 "이 무브를 갖고 있으면 +1"로 매번 확인한다(Command의
// getCommandArmorContribution과 같은 패턴).
//
// 강철의 몸(Steel Hide, 6레벨) 원문: "대체: 무쇠의 몸. 장갑 +2를 받습니다."
// 무쇠의 몸을 대체하는 업그레이드라, 둘 다 갖고 있어도 중복으로 더하지
// 않는다 — 강철의 몸이 있으면 그것만(+2), 없으면 무쇠의 몸만(+1) 반영한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_IRON_HIDE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findIronHideMove(actor) {
  const names = splitCommaList(SETTINGS.IRON_HIDE_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function findSteelHideMove(actor) {
  const names = splitCommaList(SETTINGS.STEEL_HIDE_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

// features/armor-assistant.js의 장갑 재계산 기여 목록에 더한다.
export function getIronHideArmorContribution(actor) {
  if (!isEnabled()) return null;
  if (actor.type !== "character") return null;

  const steelHide = findSteelHideMove(actor);
  if (steelHide) return { source: steelHide.name, amount: 2 };

  const moveItem = findIronHideMove(actor);
  if (!moveItem) return null;

  return { source: moveItem.name, amount: 1 };
}

export function registerIronHideAssistant() {
  // 훅이 따로 필요 없다 — armor-assistant.js가 getIronHideArmorContribution을
  // 직접 불러서 쓴다.
}
