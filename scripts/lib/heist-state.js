import { MODULE_ID } from "../constants.js";

// 대도적(Heist)의 "다음 판정 +1" 기회. 원조/방해의 lib/roll-bonus-state.js와
// 달리 자동으로 붙는 보너스가 아니라, 다음 판정 직전에 "마스터의 답변에
// 의거한 것인가요?"를 실제로 물어봐야 하고(features/heist.js 참고), 그
// 질문에 예/아니오 무엇으로 답하든 기회 자체는 사라진다 — 그래서 amount 없이
// 누가 준 기회인지(source)만 기록하는 별도 플래그를 쓴다.
const FLAG = "pendingHeistBonus"; // { source: string } | undefined

export function getPendingHeistBonus(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setPendingHeistBonus(actor, source) {
  await actor.setFlag(MODULE_ID, FLAG, { source });
}

export async function clearPendingHeistBonus(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
}
