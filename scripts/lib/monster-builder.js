import {
  DAMAGE_DICE,
  ORGANIZATION_OPTIONS,
  SIZE_OPTIONS,
  ARMOR_OPTIONS,
  FAME_OPTIONS,
  ATTACK_TRAIT_OPTIONS,
  TRAIT_OPTIONS,
  TREASURE_TABLE
} from "../data/monster-tables.js";

// apps/monster-builder-app.js가 제출한 폼 값({organization, size, armor,
// fame:{value:bool}, blessedChoice, attackName, attackTraits:{value:bool},
// traits:{value:bool}, applyDuplicateBonus})을 받아 data/monster-tables.js의
// 각 선택지 효과를 누적한다. "두 질문이 같은 태그를 주는 경우, 나중 태그는
// 무시해도 됩니다. 태그가 겹칠 때마다 피해나 HP를 2씩 조정해도 되지만 필수는
// 아닙니다"는 폼의 applyDuplicateBonus 체크박스로 선택하게 한다(기본 꺼짐).
// "공격 솜씨"(우세)와 "폭력을 싫어함"(열세)이 동시에 걸리면 서로 상쇄해서
// 평범한 굴림으로 되돌아간다.
export function computeMonsterBuild(data) {
  const org = ORGANIZATION_OPTIONS.find((o) => o.value === data.organization) ?? ORGANIZATION_OPTIONS[1];
  const size = SIZE_OPTIONS.find((o) => o.value === data.size) ?? SIZE_OPTIONS[2];
  const armorOpt = ARMOR_OPTIONS.find((o) => o.value === data.armor) ?? ARMOR_OPTIONS[1];

  let dieIndex = DAMAGE_DICE.indexOf(org.damageDie);
  let damageMod = 0;
  let armor = armorOpt.armor;
  let hp = org.hp;
  let pierce = 0;
  const rollModes = [];
  const rawTags = [org.tag];
  const rangeTags = new Set();
  const reminders = ["이 괴물이 무엇을 한다고 알려져 있는지 설명하는 액션을 만드십시오."];

  const addTags = (arr) => rawTags.push(...(arr ?? []));
  const addRangeTags = (arr) => {
    for (const t of arr ?? []) rangeTags.add(t);
  };

  addTags(size.tags);
  addRangeTags(size.rangeTags);
  hp += size.hp ?? 0;
  damageMod += size.damageMod ?? 0;

  addTags(armorOpt.tags);

  const selectedFame = FAME_OPTIONS.filter((o) => data.fame?.[o.value]);
  for (const opt of selectedFame) {
    damageMod += opt.damageMod ?? 0;
    armor += opt.armor ?? 0;
    hp += opt.hp ?? 0;
    pierce += opt.pierce ?? 0;
    if (opt.rollMode) rollModes.push(opt.rollMode);
    addTags(opt.tags);
    if (opt.reminder) reminders.push(opt.reminder);
  }
  if (selectedFame.some((o) => o.value === "blessed")) {
    if (data.blessedChoice === "damage" || data.blessedChoice === "both") damageMod += 2;
    if (data.blessedChoice === "hp" || data.blessedChoice === "both") hp += 2;
  }

  const selectedAttackTraits = ATTACK_TRAIT_OPTIONS.filter((o) => data.attackTraits?.[o.value]);
  const useShred = selectedAttackTraits.some((o) => o.value === "metalShred");
  for (const opt of selectedAttackTraits) {
    if (opt.value === "metal" && useShred) continue; // "찢어발김"이 관통+1 대신 관통+3로 대체한다
    damageMod += opt.damageMod ?? 0;
    dieIndex += opt.dieStep ?? 0;
    pierce += opt.pierce ?? 0;
    addTags(opt.tags);
    addRangeTags(opt.rangeTags);
  }

  const selectedTraits = TRAIT_OPTIONS.filter((o) => data.traits?.[o.value]);
  for (const opt of selectedTraits) {
    damageMod += opt.damageMod ?? 0;
    armor += opt.armor ?? 0;
    hp += opt.hp ?? 0;
    dieIndex += opt.dieStep ?? 0;
    if (opt.rollMode) rollModes.push(opt.rollMode);
    addTags(opt.tags);
    if (opt.reminder) reminders.push(opt.reminder);
  }

  const hasAdvantage = rollModes.includes("advantage");
  const hasDisadvantage = rollModes.includes("disadvantage");
  const rollMode = hasAdvantage && hasDisadvantage ? null : hasAdvantage ? "advantage" : hasDisadvantage ? "disadvantage" : null;

  if (pierce > 0) rawTags.push(`관통 +${pierce}`);

  const uniqueTags = [...new Set(rawTags)];
  const duplicateCount = rawTags.length - uniqueTags.length;
  if (data.applyDuplicateBonus && duplicateCount > 0) {
    damageMod += duplicateCount * 2;
    hp += duplicateCount * 2;
  }

  dieIndex = Math.max(0, Math.min(DAMAGE_DICE.length - 1, dieIndex));
  const damageDie = DAMAGE_DICE[dieIndex];
  armor = Math.max(0, armor);
  hp = Math.max(1, hp);

  return {
    attackName: (data.attackName ?? "").trim(),
    damageDie,
    damageMod,
    rollMode,
    armor,
    hp,
    pierce,
    tags: uniqueTags,
    rangeTags: [...rangeTags],
    duplicateCount,
    reminders
  };
}

// "d8"+2+우세 -> "d8+2 (우세)" 형태의 표시용 문자열. 시트의 데미지 칸이
// 좁아서 짧게 표시하고, "우세/열세가 정확히 뭘 뜻하는지"는
// features/monster-generator.js의 결과 패널에 풀어서 보여준다.
export function formatDamageFormula(damageDie, damageMod, rollMode) {
  let formula = damageDie;
  if (damageMod > 0) formula += `+${damageMod}`;
  else if (damageMod < 0) formula += `${damageMod}`;
  if (rollMode === "advantage") formula += " (우세)";
  else if (rollMode === "disadvantage") formula += " (열세)";
  return formula;
}

async function evaluateRoll(formula) {
  const roll = new Roll(formula);
  await roll.evaluate();
  return roll;
}

// 보물 표(1~18)를 찾기 위해 괴물의 피해 주사위를 굴린다. 보물지기면 두 번
// 굴려 높은 값, 우두머리/오래된 존재면 추가로 1d4씩 더한다(원문: "다른
// 괴물들의 지배자"/"나이가 많고 특별한 존재" — 제작 절차의 태그가 아니라
// 보물을 굴리는 시점에 마스터가 그때그때 판단하는 조건이라 apps/에서 별도로
// 물어본다).
async function rollTreasureIndex(damageDie, { hoarder = false, leaderBonus = false, elderBonus = false } = {}) {
  const dieFaces = damageDie.replace(/^d/, "");
  const baseFormula = hoarder ? `{1d${dieFaces},1d${dieFaces}}kh` : `1d${dieFaces}`;
  const roll = await evaluateRoll(baseFormula);
  let total = roll.total;

  const extraRolls = [];
  if (leaderBonus) extraRolls.push(await evaluateRoll("1d4"));
  if (elderBonus) extraRolls.push(await evaluateRoll("1d4"));
  for (const r of extraRolls) total += r.total;

  const index = Math.min(TREASURE_TABLE.length, Math.max(1, total));
  return { roll, extraRolls, total, index };
}

async function resolveTreasureRow(row) {
  if (row.composite) {
    const parts = [];
    for (const part of row.composite) {
      const r = await evaluateRoll(part.formula);
      parts.push(`${r.total}${part.unit ?? ""} (${part.formula})`);
    }
    return `${row.text} ${parts.join(", ")}`;
  }
  if (row.formula) {
    const r = await evaluateRoll(row.formula);
    const weightText = row.weight ? `, 무게 ${row.weight}` : "";
    return `${row.text} ${r.total}${row.unit ?? ""}${weightText} (${row.formula})`;
  }
  return row.text;
}

// "15/16/17번: 그리고 한 번 더 굴립니다"를 재귀로 처리한다(depth 상한으로
// 무한 루프 방지).
export async function rollTreasure(damageDie, adjustments = {}, depth = 0) {
  const { index, total } = await rollTreasureIndex(damageDie, adjustments);
  const row = TREASURE_TABLE[index - 1];
  const lines = [`${index}. ${await resolveTreasureRow(row)}`];

  if (row.rollAgain && depth < 4) {
    const more = await rollTreasure(damageDie, adjustments, depth + 1);
    lines.push(...more.lines);
  }

  return { lines, total };
}
