import { MODULE_ID, SETTINGS } from "../constants.js";

// 클레릭 고급액션 응급처치(First Aid) 원문: "소치유(Cure Light Wounds)는
// 당신에게 암송주문이라, 부여받은 주문 한도에 포함되지 않습니다." 상급
// 응급처치(Greater First Aid, 응급처치 대체) 원문: 같은 방식으로 치유(Cure
// Moderate Wounds)를 암송주문 취급한다.
//
// "특정 주문의 레벨을 낮춰 취급"한다는 점에서 위저드 천재/클레릭 선택받은
// 자(features/spell-discount.js)와 메커니즘이 같지만, 대상 주문이 플레이어
// 선택이 아니라 이름으로 고정되어 있고 무브를 가지고만 있으면 항상 적용되는
// 패시브(선택 다이얼로그 없음)라 별도 파일로 뺐다. 상급 응급처치는 응급처치를
// "대체"하므로(features/move-upgrades.js) 한 캐릭터가 둘을 동시에 가질 일은
// 없다 — 그래도 안전하게 둘 다 확인한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_FIRST_AID_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasMove(actor, settingKey) {
  const names = splitCommaList(settingKey);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

function findSpellByName(actor, settingKey) {
  const spellName = game.settings.get(MODULE_ID, settingKey).trim();
  if (!spellName) return null;
  return actor.items.find((i) => i.type === "spell" && i.name === spellName) ?? null;
}

// features/spell-preparation.js가 spell-discount.js의 getDiscountedSpellIds와
// 나란히 참조한다. 응급처치/상급 응급처치가 대상으로 삼는 주문이 실제로
// 스펠북에 있으면 그 id를, 없으면 아무것도 반환하지 않는다(조용히 무시).
export function getFirstAidDiscountedSpellIds(actor) {
  if (!isEnabled()) return [];

  const ids = [];
  if (hasMove(actor, SETTINGS.FIRST_AID_MOVE_NAMES)) {
    const spell = findSpellByName(actor, SETTINGS.FIRST_AID_SPELL_NAME);
    if (spell) ids.push(spell.id);
  }
  if (hasMove(actor, SETTINGS.GREATER_FIRST_AID_MOVE_NAMES)) {
    const spell = findSpellByName(actor, SETTINGS.GREATER_FIRST_AID_SPELL_NAME);
    if (spell) ids.push(spell.id);
  }
  return ids;
}

export function registerFirstAidAssistant() {
  // 훅이 따로 필요 없다 — spell-preparation.js가 getFirstAidDiscountedSpellIds를 직접 불러서 쓴다.
}
