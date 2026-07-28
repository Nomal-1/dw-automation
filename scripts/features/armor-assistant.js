import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getFormshaperArmorContribution } from "./druid.js";

// 던전월드 공식 방어구 컴펜디엄 기준(가죽 갑옷 "1 armor", 방패 "+1 armor" 등)
// 태그 문구에서 숫자만 뽑아낸다. itemType이 "armor"인 장비에만 이 패턴을
// 적용하므로, 다른 태그(예: 무기의 "ignores armor")와는 절대 겹치지 않는다.
const ARMOR_TAG_PATTERN = /\+?(\d+)\s*armor/gi;

function getArmorTagValue(tagsString) {
  let total = 0;
  let match;
  const re = new RegExp(ARMOR_TAG_PATTERN);
  while ((match = re.exec(tagsString ?? "")) !== null) {
    total += Number(match[1]) || 0;
  }
  return total;
}

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_ARMOR_ASSISTANT);
}

// "장비됨(equipped)" 설정이 켜진 방어구 계열(itemType: armor) 아이템만
// 대상으로 한다 — 가방 속에 넣어둔 여분의 갑옷 등은 제외된다.
function getEquippedArmorItems(actor) {
  return actor.items.filter((i) => i.type === "equipment" && i.system?.itemType === "armor" && i.system?.equipped);
}

function getGearBreakdown(actor) {
  return getEquippedArmorItems(actor).map((item) => ({
    name: item.name,
    value: getArmorTagValue(item.system?.tagsString)
  }));
}

// 장비 태그 외에, "지금 활성화된" 모듈 자동화 보정도 더한다. 지금은
// Formshaper의 변신 중 장갑 선택 하나뿐이지만, 앞으로 비슷한 게 생기면
// 여기에 항목만 추가하면 된다. Armor Mastery류 무효화가 이미 깎아둔 장갑은
// 여기 포함하지 않는다 — 그건 "지금 활성 상태"가 아니라 과거에 누적된
// 손상이라 재계산 때마다 사라지면 안 되기 때문이다(대신 hit-trigger.js가
// 그 순간 ac.value를 직접 깎아서 이미 반영해뒀다).
function getModifierBreakdown(actor) {
  const contributions = [];
  const formshaper = getFormshaperArmorContribution(actor);
  if (formshaper) contributions.push(formshaper);
  return contributions;
}

function computeRecalculatedArmor(actor) {
  const gearRows = getGearBreakdown(actor);
  const modifierRows = getModifierBreakdown(actor);
  const total =
    gearRows.reduce((sum, row) => sum + row.value, 0) + modifierRows.reduce((sum, row) => sum + row.amount, 0);
  return { total, gearRows, modifierRows };
}

function formatSigned(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function buildTooltip(actor) {
  const { total, gearRows, modifierRows } = computeRecalculatedArmor(actor);
  const lines = [];

  if (gearRows.length === 0 && modifierRows.length === 0) {
    lines.push(game.i18n.localize("DWAUTO.Armor.NoContributors"));
  } else {
    for (const row of gearRows) lines.push(`${row.name}: ${formatSigned(row.value)}`);
    for (const row of modifierRows) lines.push(`${row.source}: ${formatSigned(row.amount)}`);
  }

  lines.push(game.i18n.format("DWAUTO.Armor.TooltipTotal", { total }));
  lines.push(game.i18n.localize("DWAUTO.Armor.TooltipClickHint"));
  return lines.join("\n");
}

async function recalcArmor(actor) {
  const { total } = computeRecalculatedArmor(actor);
  await actor.update({ "system.attributes.ac.value": total });
  announceActionApplied(actor, game.i18n.localize("DWAUTO.Armor.RecalcLabel"), game.i18n.format("DWAUTO.Armor.RecalcApplied", { total }));
}

// 캐릭터 시트의 '장갑' 라벨(순정 시스템에서는 클릭이 안 되는 평범한 텍스트)을
// '피해' 라벨처럼 눌리는 버튼으로 바꾼다. 던전월드 시스템 자체는 장비
// 소지/장착 여부로 장갑을 자동 계산해주지 않고, 플레이어가 직접 숫자를
// 입력하는 칸일 뿐이다 — 이 버튼은 그 계산을 대신 해주는 것뿐, 시스템
// 필드 자체의 동작을 바꾸지 않는다(직접 수정도 여전히 가능).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const $label = html.find(".cell--ac .cell__title");
  if (!$label.length) return;

  $label.addClass("rollable dwauto-armor-recalc");
  $label.attr("title", buildTooltip(actor));

  $label.off("click.dwautoArmor").on("click.dwautoArmor", async (event) => {
    event.preventDefault();
    await recalcArmor(actor);
  });
}

export function registerArmorAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
