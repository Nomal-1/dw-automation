import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getFormshaperArmorContribution } from "./druid.js";

// 던전월드 공식 방어구 컴펜디엄 기준(가죽 갑옷 "1 armor", 방패 "+1 armor" 등)
// 태그 문구에서 숫자만 뽑아낸다. "+" 유무는 그 방어구가 기본 장갑값인지
// (플레이트 "3 armor") 가산 보너스인지(방패 "+1 armor")를 구분하는 표기라
// 값을 깎을 때도 그대로 유지해야 한다(damageArmorItem 참고).
const ARMOR_TAG_ANCHORED = /^(\+?)(\d+)\s*armor$/i;

// 태그는 system.tagsString(문자열)이 아니라 system.tags(JSON 배열)를 원본으로
// 읽는다 — 던전월드 시스템의 아이템 편집창(태그 위젯)은 실제로 system.tags만
// 갱신하고 tagsString은 컴펜디엄에서 아이템을 처음 만들었을 때의 값 그대로
// 남아있을 수 있어서(시스템 소스 확인: item-sheet.js가 tagsString을 시트
// 렌더링용으로만 그때그때 재계산함), 태그를 나중에 고친 아이템에서는
// tagsString이 오래된 값일 위험이 있다.
function parseTagsArray(item) {
  try {
    const raw = item.system?.tags;
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function tagsToString(tagsArray) {
  return tagsArray.map((t) => t?.value ?? "").join(", ");
}

function getArmorTagValue(tagsArray) {
  let total = 0;
  for (const tag of tagsArray) {
    const match = ARMOR_TAG_ANCHORED.exec((tag?.value ?? "").trim());
    if (match) total += Number(match[2]) || 0;
  }
  return total;
}

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_ARMOR_ASSISTANT);
}

// "장비됨(equipped)" 설정이 켜진 방어구 계열(itemType: armor) 아이템만
// 대상으로 한다 — 가방 속에 넣어둔 여분의 갑옷 등은 제외된다. hit-trigger.js가
// Armor Mastery류 무효화에서 "어느 장비의 내구도를 깎을지" 물어볼 때도
// 재사용한다.
export function getEquippedArmorItems(actor) {
  return actor.items.filter((i) => i.type === "equipment" && i.system?.itemType === "armor" && i.system?.equipped);
}

// 선택된 방어구 아이템의 장갑 태그를 1 줄인다. "+" 표기가 있었으면 그대로
// 유지한 채(예: "+2 armor" -> "+1 armor") 새 값으로 바꾸고, 0 이하가 되면
// 장갑 태그 자체를 없앤 뒤 아이템 이름 뒤에 "(파괴됨)"을 붙인다. 장갑 태그가
// 아예 없는 아이템이면 아무것도 하지 않는다. 여기서는 장갑 재계산(recalcArmor)을
// 부르지 않는다 — 캐릭터의 장갑 수치 자체는 호출부가 별도로 처리한다.
export async function damageArmorItem(item) {
  const tags = parseTagsArray(item);
  let matchedIndex = -1;
  let hasPlus = false;
  let oldValue = 0;

  for (let i = 0; i < tags.length; i++) {
    const match = ARMOR_TAG_ANCHORED.exec((tags[i]?.value ?? "").trim());
    if (match) {
      matchedIndex = i;
      hasPlus = match[1] === "+";
      oldValue = Number(match[2]) || 0;
      break;
    }
  }

  if (matchedIndex === -1) return { changed: false, destroyed: false, newValue: null, itemName: item.name };

  const newValue = oldValue - 1;
  const nextTags = [...tags];
  const destroyed = newValue <= 0;

  if (destroyed) {
    nextTags.splice(matchedIndex, 1);
  } else {
    nextTags[matchedIndex] = { value: `${hasPlus ? "+" : ""}${newValue} armor` };
  }

  const itemName = item.name;
  const nextName = destroyed ? `${itemName}${game.i18n.localize("DWAUTO.Armor.DestroyedSuffix")}` : itemName;

  await item.update({
    name: nextName,
    "system.tags": JSON.stringify(nextTags),
    "system.tagsString": tagsToString(nextTags)
  });

  return { changed: true, destroyed, newValue: destroyed ? 0 : newValue, itemName };
}

function getGearBreakdown(actor) {
  return getEquippedArmorItems(actor).map((item) => ({
    name: item.name,
    value: getArmorTagValue(parseTagsArray(item))
  }));
}

// 장비 태그 외에, "지금 활성화된" 모듈 자동화 보정도 더한다. 지금은
// Formshaper의 변신 중 장갑 선택 하나뿐이지만, 앞으로 비슷한 게 생기면
// 여기에 항목만 추가하면 된다. Armor Mastery류 무효화는 여기 포함하지
// 않는다 — 그건 "지금 활성 상태"가 아니라 무효화할 때 직접 방어구 태그와
// 장갑 수치를 같이 깎아두는 방식으로 바뀌었으므로(hit-trigger.js 참고),
// 재계산 때 다시 반영할 별도 보정값이 아니라 이미 방어구 태그 자체에
// 영구히 새겨진 손상이다.
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
