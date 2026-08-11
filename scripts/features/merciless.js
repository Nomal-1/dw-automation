import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";

// 전사 고급액션 무자비(Merciless) 원문: "When you deal damage, deal +1d4
// damage." 조건 없는 패시브라 물어볼 것도 없다 — 이 무브를 갖고 있으면
// features/attack-assistant.js가 데미지를 굴릴 때마다 매번 자동으로
// 1d4를 더한다(Command의 getCommandDamageBonus와 같은 패턴).
//
// 살기등등(Bloodthirsty, 6레벨) 원문: "대체: 무자비. 피해를 줄 때 +1d8이
// 더해집니다." 무자비를 대체하는 업그레이드라, 둘 다 갖고 있어도 중복으로
// 더하지 않는다 — 살기등등이 있으면 그것만(+1d8), 없으면 무자비만(+1d4)
// 반영한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_MERCILESS_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findMercilessMove(actor) {
  const names = splitCommaList(SETTINGS.MERCILESS_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function findBloodthirstyMove(actor) {
  const names = splitCommaList(SETTINGS.BLOODTHIRSTY_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

// features/attack-assistant.js가 데미지 굴림 수식에 이어붙일 추가 다이스
// 문자열을 받는다. 없으면 빈 문자열.
export function getMercilessBonus(actor) {
  if (!isEnabled()) return "";

  const bloodthirsty = findBloodthirstyMove(actor);
  if (bloodthirsty) {
    announceActionApplied(actor, bloodthirsty.name, game.i18n.localize("DWAUTO.Merciless.BloodthirstyApplied"));
    return "1d8";
  }

  const moveItem = findMercilessMove(actor);
  if (!moveItem) return "";

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.Merciless.Applied"));
  return "1d4";
}

export function registerMercilessAssistant() {
  // 훅이 따로 필요 없다 — attack-assistant.js가 getMercilessBonus를 직접 불러서 쓴다.
}
