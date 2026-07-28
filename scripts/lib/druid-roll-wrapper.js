// Formcrafter: 변신 중 고른 능력치로 판정하면 +1 온고잉, 마스터가 고른
// 능력치로 판정하면 -1 온고잉을 받는다. spellcasting-wrapper.js와 같은
// 방식으로, 실제 굴림 직전에 무브의 rollMod를 일시적으로(저장하지 않고
// 메모리에서만) 조정했다가 굴림 후 원복한다.
//
// "무엇으로 판정할지 그 자리에서 물어보는"(ask, 예: Defy Danger) 무브는
// item.system.rollType이 "ask"라서 실제 능력치가 굴리기 직전엔 아직 정해져
// 있지 않다 — 이 시점 이후 플레이어가 대화상자에서 능력치를 고르므로,
// 여기서 rollMod를 조정해도 어느 능력치 기준으로 조정해야 할지 알 수
// 없다. 그래서 고정 능력치 무브(Hack & Slash, Volley, Spout Lore 등)만
// 자동화 대상이고, ask형 무브는 GM/플레이어가 수동으로 +1/-1을 반영해야
// 한다.
import { MODULE_ID } from "../constants.js";
import { getFormcrafterRollModifier } from "../features/druid.js";

async function wrappedRoll(wrapped, ...args) {
  if (!this.actor || this.type !== "move") return wrapped(...args);

  const rollType = (this.system.rollType || "").toLowerCase();
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
