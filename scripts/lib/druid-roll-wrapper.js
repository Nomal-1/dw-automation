// Formcrafter: 변신 중 고른 능력치로 판정하면 +1 온고잉, 마스터가 고른
// 능력치로 판정하면 -1 온고잉을 받는다. spellcasting-wrapper.js와 같은
// 방식으로, 실제 굴림 직전에 무브의 rollMod를 일시적으로(저장하지 않고
// 메모리에서만) 조정했다가 굴림 후 원복한다.
//
// "무엇으로 판정할지 그 자리에서 물어보는"(ask, 예: Defy Danger) 무브는
// 시스템이 rollMod를 자기 대화상자를 띄우기 *전에* 이미 고정해버려서,
// 능력치 버튼을 누른 뒤에 rollMod를 조정해봐야 이미 늦다. 그래서 이
// 경우는 시스템 대화상자가 뜨기 전에 우리가 먼저 능력치를 확정해서
// 물어보고(features/druid.js의 promptAskRollAbility), rollType 자체를
// 그 능력치로 바꿔치기한 채로 원본 굴림을 호출한다 — 시스템은 rollType이
// "ask"가 아니면 자기 대화상자를 아예 띄우지 않으므로 두 번 묻는 일도
// 없다.
import { MODULE_ID } from "../constants.js";
import { getFormcrafterRollModifier, shouldInterceptAskRoll, promptAskRollAbility } from "../features/druid.js";

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

  const mod = getFormcrafterRollModifier(this.actor, rollType);
  if (!mod) return wrapped(...args);

  const original = this.system.rollMod;
  this.system.rollMod = (Number(original) || 0) + mod;
  try {
    return await wrapped(...args);
  } finally {
    this.system.rollMod = original;
  }
}

export function registerDruidRollWrapper() {
  libWrapper.register(MODULE_ID, "game.dungeonworld.ItemDw.prototype.roll", wrappedRoll, "MIXED");
}
