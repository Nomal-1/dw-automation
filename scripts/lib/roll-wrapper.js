// 던전월드 시스템의 무브 굴림은 game.dungeonworld.ItemDw.prototype.roll()을
// 거쳐 DwRolls.rollMove()를 호출하는데, DwRolls 자체는 전역에 노출되어 있지
// 않지만 ItemDw는 game.dungeonworld.ItemDw로 노출되어 있어 libWrapper로
// 감쌀 수 있다. 이 모듈이 굴림 "전"에 개입해야 하는 두 가지 기능(지속 주문
// 시전 페널티 — spellcasting.js, Formcrafter 능력치 보정 — druid.js)이 전에는
// 각자 스스로 libWrapper.register(MODULE_ID, "...ItemDw.prototype.roll", ...)를
// 따로 호출했는데, libWrapper는 같은 모듈이 같은 대상을 두 번 wrap하는 걸
// 프로그래밍 실수로 보고 에러를 던진다("Error detected in module" 배너의
// 정체 — v0.29.1까지 원인 불명이던 버그). 그래서 두 번째로 등록되는 쪽
// (Formcrafter)이 항상 등록에 실패했고, 그 결과 Formcrafter의 능력치 보정도
// 실제로는 한 번도 적용된 적이 없었다. 이제 두 기능을 하나의 wrapper
// 함수로 합쳐서 등록을 딱 한 번만 한다.
import { MODULE_ID, SETTINGS } from "../constants.js";
import { computeCastPenalty } from "./ongoing-spells-state.js";
import { getFormcrafterRollModifier, shouldInterceptAskRoll, promptAskRollAbility } from "../features/druid.js";
import { getCommandCunningBonus } from "../features/command.js";

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isCastSpellMove(item) {
  if (item.type !== "move") return false;
  return splitCommaList(SETTINGS.CAST_SPELL_MOVE_NAMES).includes(item.name);
}

// Formcrafter: "무엇으로 판정할지 그 자리에서 고르는"(ask, 예: 위험 돌파) 무브는
// 시스템이 자기 대화상자를 띄우기 *전에* rollMod를 이미 고정해버려서, 능력치
// 버튼을 누른 뒤에 rollMod를 조정해봐야 이미 늦다. 그래서 시스템 대화상자가
// 뜨기 전에 우리가 먼저 능력치를 확정해서 물어보고(features/druid.js의
// promptAskRollAbility), rollType 자체를 그 능력치로 바꿔치기한 채로 원본
// 굴림을 호출한다 — 시스템은 rollType이 "ask"가 아니면 자기 대화상자를 아예
// 띄우지 않으므로 두 번 묻는 일도 없다.
async function handleAskRoll(item, wrapped, args) {
  const chosenStat = await promptAskRollAbility(item.name);
  if (!chosenStat) return wrapped(...args);

  const mod = getFormcrafterRollModifier(item.actor, chosenStat);
  const originalType = item.system.rollType;
  const originalMod = item.system.rollMod;
  item.system.rollType = chosenStat;
  item.system.rollMod = (Number(originalMod) || 0) + mod;
  try {
    return await wrapped(...args);
  } finally {
    item.system.rollType = originalType;
    item.system.rollMod = originalMod;
  }
}

async function wrappedRoll(wrapped, ...args) {
  if (!this.actor || this.type !== "move") return wrapped(...args);

  const rollType = (this.system.rollType || "").toLowerCase();

  if (rollType === "ask" && shouldInterceptAskRoll(this.actor)) {
    return handleAskRoll(this, wrapped, args);
  }

  let spellPenalty = 0;
  if (game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELLCASTING_ASSISTANT) && isCastSpellMove(this)) {
    const { blocked, amount } = computeCastPenalty(this.actor);
    if (blocked) {
      ui.notifications.warn(game.i18n.format("DWAUTO.Spell.CastBlocked", { name: this.actor.name }));
      return undefined;
    }
    spellPenalty = amount;
  }

  const formcrafterMod = getFormcrafterRollModifier(this.actor, rollType);
  const commandMod = getCommandCunningBonus(this);
  const totalMod = formcrafterMod - spellPenalty + commandMod;
  if (!totalMod) return wrapped(...args);

  const original = this.system.rollMod;
  this.system.rollMod = (Number(original) || 0) + totalMod;
  try {
    return await wrapped(...args);
  } finally {
    this.system.rollMod = original;
  }
}

export function registerRollWrapper() {
  libWrapper.register(MODULE_ID, "game.dungeonworld.ItemDw.prototype.roll", wrappedRoll, "MIXED");
}
