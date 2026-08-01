import { MODULE_ID } from "../constants.js";

// 바드 마법의 곡조(Arcane Art)의 "다음번에 가하는 피해에 +1d4 보너스"처럼
// "이 액터가 다음에 데미지를 굴릴 때 한 번만 적용되고 사라지는" 보정치.
// lib/roll-bonus-state.js와 구조는 같지만 대상이 다르다 — roll-bonus-state는
// lib/roll-wrapper.js(모든 무브 판정)가 소모하고, 이건 features/
// attack-assistant.js(데미지 굴림)가 소모한다. 액터당 하나만 유지한다.
const FLAG = "pendingDamageForward"; // { amount: number, source: string }

export function getPendingDamageForward(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setPendingDamageForward(actor, amount, source) {
  await actor.setFlag(MODULE_ID, FLAG, { amount, source });
}

export async function clearPendingDamageForward(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
}
