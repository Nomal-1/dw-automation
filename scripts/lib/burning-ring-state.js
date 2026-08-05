import { MODULE_ID } from "../constants.js";

// 소각술사 고급액션(6레벨 이후) 불로 맺은 언약(Burning Ring Of Fire) 전용.
// 결속은 양쪽 액터 모두에게 대칭으로 저장한다(누가 먼저 약화를 얻어도 상대를
// 곧바로 찾을 수 있어야 하므로).
const FLAG = "burningRingBond"; // { partnerActorId: string, partnerName: string, stability: "stable" | "unstable" } | null

export function getBurningRingBond(actor) {
  return actor.getFlag(MODULE_ID, FLAG) ?? null;
}

export async function setBurningRingBond(actor, partnerActorId, partnerName, stability) {
  await actor.setFlag(MODULE_ID, FLAG, { partnerActorId, partnerName, stability });
}

export async function clearBurningRingBond(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
}
