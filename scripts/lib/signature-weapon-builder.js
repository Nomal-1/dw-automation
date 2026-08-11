import { RANGE_OPTIONS, ENHANCEMENT_OPTIONS, LOOK_OPTIONS } from "../data/signature-weapon-tables.js";

// apps/signature-weapon-builder-app.js가 제출한 폼 값({base, range,
// enhancements:{value:bool}, extraRange, glowsCreature, look, name})을 받아
// data/signature-weapon-tables.js의 선택 효과를 누적해서 무기 아이템에 바로
// 쓸 수 있는 형태로 돌려준다. 피해/관통 보너스는 불타는 낙인과 같은 방식으로
// "+N damage"/"N piercing" 태그 문자열로 접어 넣는다(던전월드 시스템의 피해
// 적용 버튼이 채팅 메시지 전체를 정규식으로 훑어서 그 문구를 자동 인식하기
// 때문 — lib/tag-catalog.js 참고).
export function computeSignatureWeapon(data) {
  const range = RANGE_OPTIONS.find((o) => o.value === data.range) ?? RANGE_OPTIONS[0];
  const look = LOOK_OPTIONS.find((o) => o.value === data.look);
  const selectedEnhancements = ENHANCEMENT_OPTIONS.filter((o) => data.enhancements?.[o.value]);

  let weight = 2;
  let damageMod = 0;
  let pierce = 0;
  const tags = new Set([range.value]);

  for (const enh of selectedEnhancements) {
    weight += enh.weightMod ?? 0;
    damageMod += enh.damageMod ?? 0;
    pierce += enh.pierce ?? 0;
    for (const t of enh.tags ?? []) tags.add(t);
  }

  if (selectedEnhancements.some((e) => e.value === "versatile")) {
    const extraRange = RANGE_OPTIONS.find((o) => o.value === data.extraRange);
    if (extraRange) tags.add(extraRange.value);
  }

  if (damageMod > 0) tags.add(`+${damageMod} damage`);
  if (pierce > 0) tags.add(`${pierce} piercing`);

  weight = Math.max(0, weight);

  const glowsChosen = selectedEnhancements.some((e) => e.value === "glows");
  const descriptionLines = [];
  if (look) descriptionLines.push(`외양: ${look.label}`);
  if (glowsChosen && data.glowsCreature) descriptionLines.push(`${data.glowsCreature} 앞에서 빛남`);

  return {
    name: (data.name ?? "").trim(),
    weight,
    tags: [...tags],
    description: descriptionLines.join("<br>")
  };
}
