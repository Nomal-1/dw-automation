import { MODULE_ID, SETTINGS } from "../constants.js";

// 던전월드 시스템의 캐릭터 시트(module/actor/actor-sheet.js)는 주문을
// 레벨별로 묶을 때 spells = { 0: [], 1: [], 3: [], 5: [], 7: [], 9: [] }
// 처럼 정해진 6개 칸만 만들어두고 spells[i.system.spellLevel].push(i)로
// 밀어 넣는다. 주문 아이템 시트의 "주문 레벨" 입력칸은 숫자를 아무거나
// 받아주는 평범한 필드라, 여기에 2/4/6/8 같은 값을 넣으면 그 칸이 아예
// 존재하지 않아 .push가 TypeError를 던진다 — 이 오류가 시트를 그리는
// getData() 안에서 나기 때문에 그 캐릭터 시트 자체가 영영 안 열리게
// 된다(실제로 겪은 사고). 시스템 코드 자체를 고치는 건 훨씬 위험하고
// 유지보수 부담이 커서(안전한 대안 논의 결과), 애초에 이 6개 값 밖으로
// 저장되지 않도록 주문 레벨 생성/수정을 여기서 막는다.
const VALID_SPELL_LEVELS = [0, 1, 3, 5, 7, 9];

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELL_LEVEL_GUARD);
}

function isInvalidLevel(raw) {
  if (raw === undefined) return false;
  return !VALID_SPELL_LEVELS.includes(Number(raw));
}

function warnBlocked() {
  ui.notifications.warn(game.i18n.format("DWAUTO.SpellLevelGuard.Blocked", { levels: VALID_SPELL_LEVELS.join(", ") }));
}

function onPreUpdateItem(item, changes) {
  if (!isEnabled()) return true;
  if (item.type !== "spell") return true;

  const flat = foundry.utils.flattenObject(changes);
  if (!("system.spellLevel" in flat)) return true;
  if (!isInvalidLevel(flat["system.spellLevel"])) return true;

  warnBlocked();
  return false;
}

function onPreCreateItem(item, data) {
  if (!isEnabled()) return true;
  if (data.type !== "spell") return true;
  if (!isInvalidLevel(data.system?.spellLevel)) return true;

  warnBlocked();
  return false;
}

export function registerSpellLevelGuard() {
  Hooks.on("preUpdateItem", onPreUpdateItem);
  Hooks.on("preCreateItem", onPreCreateItem);
}
