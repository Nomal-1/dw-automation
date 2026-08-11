import { MODULE_ID } from "../constants.js";

// "사용한 독" 목록(독의 달인/독제사 공용 탭 + 독의 기술이 함께 채운다).
// 실제 인벤토리 아이템(uses)과는 별개로, "이 캐릭터가 아는 독이 뭔지"만
// 기록하는 카탈로그다. 같은 이름은 중복으로 쌓지 않는다.
const USED_POISONS_FLAG = "usedPoisons"; // [{id, name, tag}]

export function getUsedPoisons(actor) {
  return actor.getFlag(MODULE_ID, USED_POISONS_FLAG) ?? [];
}

export async function addUsedPoison(actor, { name, tag }) {
  const current = getUsedPoisons(actor);
  if (current.some((p) => p.name === name)) return current;

  const entry = { id: foundry.utils.randomID(), name, tag: tag ?? "" };
  const next = [...current, entry];
  await actor.setFlag(MODULE_ID, USED_POISONS_FLAG, next);
  return next;
}
