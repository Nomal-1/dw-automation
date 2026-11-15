import { MODULE_ID } from "../constants.js";

// "유대(Bond)" 판정(원조/방해)에 보정치를 자동으로 더한다.
//
// 던전월드 시스템은 유대 판정에서 아이템의 rollMod를 읽지 않는다(1.10.0 rolls.js에서도 확인).
// 플레이어가 유대 입력창에 넣은 값과 dataset.value만 공식에 더한다:
//   formula = `${dice}+${form.bond.value}` (+ dataset.value가 있으면 `+${dataset.value}`)
// 그래서 예전에는 레인저 명령(Command)의 "방해할 때 동물의 본능을 더한다"를 자동으로 못 하고,
// GM에게 "플레이어에게 더해서 입력하라고 알려 달라"는 창만 띄웠다.
//
// 시스템의 판정 실행 함수(DwRolls.rollMoveExecute, static)를 감싸서, 유대 판정이고 이 액터에게
// 걸어 둔 보너스가 있으면 dataset.value에 더해 넘긴다. 시스템이 원래 쓰는 칸이라 엔터로 굴려도
// 버튼으로 굴려도 똑같이 공식에 들어간다(예: 2d6+2+1). 보너스는 한 번 쓰면 사라진다.

const pending = new Map(); // actorId -> { amount, at }
const EXPIRE_MS = 5 * 60 * 1000;

/** 이 액터의 다음 유대 판정 한 번에 amount를 더한다. */
export function setPendingBondBonus(actor, amount) {
  if (!actor || !amount) return;
  pending.set(actor.id, { amount: Number(amount) || 0, at: Date.now() });
}

export function clearPendingBondBonus(actor) {
  if (actor) pending.delete(actor.id);
}

function takePending(actor) {
  const entry = actor ? pending.get(actor.id) : null;
  if (!entry) return 0;
  pending.delete(actor.id);
  return Date.now() - entry.at <= EXPIRE_MS ? entry.amount : 0;
}

/** ready에서 한 번 부른다. 던전월드 시스템의 판정 클래스를 불러와 감싼다. */
export async function registerBondRollBonus() {
  if (game.system.id !== "dungeonworld") return;
  let DwRolls;
  try {
    ({ DwRolls } = await import("/systems/dungeonworld/module/rolls.js"));
  } catch (err) {
    console.warn(`${MODULE_ID} | bond roll bonus: could not load the system's rolls.js`, err);
    return;
  }
  if (typeof DwRolls?.rollMoveExecute !== "function" || DwRolls.rollMoveExecute.__dwautoBondBonus) return;

  const original = DwRolls.rollMoveExecute;
  const wrapped = async function (roll, dataset, templateData, form = null) {
    if (String(roll ?? "").toLowerCase() === "bond") {
      const amount = takePending(this.actor);
      if (amount) dataset = { ...(dataset ?? {}), value: (Number(dataset?.value) || 0) + amount };
    }
    return original.call(this, roll, dataset, templateData, form);
  };
  wrapped.__dwautoBondBonus = true;
  DwRolls.rollMoveExecute = wrapped;
}
