// 독 아이템 인벤토리 반영 공용 헬퍼. features/poisoner.js(독의 기술)와
// features/poison-tab.js(독의 달인/독제사 조제)가 함께 쓴다.
//
// 같은 이름의 독 아이템이 이미 인벤토리에 있으면 그 아이템의 사용 횟수
// (system.uses, 화살/탄약과 같은 관례)만 늘리고, 없으면 새로 만든다.
export async function createOrIncrementPoisonItem(actor, name, tag, amount, description = "") {
  const existing = actor.items.find((i) => i.type === "equipment" && i.name === name);
  if (existing) {
    const next = (Number(existing.system.uses) || 0) + amount;
    await existing.update({ "system.uses": next });
    return next;
  }

  await actor.createEmbeddedDocuments("Item", [
    {
      name,
      type: "equipment",
      system: {
        description: description || tag || "",
        quantity: 1,
        weight: 0,
        uses: amount,
        tagsString: tag ?? "",
        tags: tag ? JSON.stringify([{ value: tag }]) : "[]"
      }
    }
  ]);
  return amount;
}
