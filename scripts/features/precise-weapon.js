import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";

// 던전월드 공식 무기 태그 정밀(Precise) 원문: "It rewards careful strikes.
// You use DEX to hack and slash with this weapon, not STR." 전사 전용
// 무브가 아니라 무기 태그 자체의 효과다. 처음엔 무기를 직접 골라서 태그를
// 확인하는 방식이었는데, 매번 무기를 고르는 게 번거롭다는 피드백을 받아
// "정밀 태그가 있습니까?"라고 간단히 물어보는 방식으로 바꿨다. 그리고
// 매번 묻는 것도 귀찮을 수 있어(항상 정밀 무기만 쓰는 캐릭터, 또는
// 애초에 정밀 무기가 없는 캐릭터) 3단계 토글(매번 묻기/항상 정밀/정밀
// 없음)을 만들어 플레이어와 마스터 둘 다 조정할 수 있게 한다.
const PRECISE_MODE_FLAG = "preciseWeaponMode"; // "ask" | "always" | "never"
const MODES = ["ask", "always", "never"];

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_PRECISE_WEAPON_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getPreciseMode(actor) {
  const value = actor.getFlag(MODULE_ID, PRECISE_MODE_FLAG);
  return MODES.includes(value) ? value : "ask";
}

async function setPreciseMode(actor, mode) {
  await actor.setFlag(MODULE_ID, PRECISE_MODE_FLAG, mode);
}

function nextMode(mode) {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}

function modeLabel(mode) {
  if (mode === "always") return game.i18n.localize("DWAUTO.PreciseWeapon.ModeAlways");
  if (mode === "never") return game.i18n.localize("DWAUTO.PreciseWeapon.ModeNever");
  return game.i18n.localize("DWAUTO.PreciseWeapon.ModeAsk");
}

function findMeleeMoveItem(actor) {
  const names = splitCommaList(SETTINGS.MELEE_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 지금 굴리려는 무브가
// 근접(Hack & Slash류)이 아니면 아무 것도 묻지 않는다. "정밀 없음" 모드면
// 조용히 통과하고, "항상 정밀"이면 묻지 않고 바로 적용하고, "매번 묻기"면
// 그때그때 확인한다.
export async function promptPrecisePreRoll(item) {
  if (!isEnabled()) return { statOverride: null };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { statOverride: null };

  const meleeNames = splitCommaList(SETTINGS.MELEE_MOVE_NAMES);
  if (!meleeNames.includes(item.name)) return { statOverride: null };

  const mode = getPreciseMode(actor);
  if (mode === "never") return { statOverride: null };

  let isPrecise = mode === "always";
  if (mode === "ask") {
    isPrecise = await Dialog.confirm({
      title: item.name,
      content: `<p>${game.i18n.localize("DWAUTO.PreciseWeapon.Prompt")}</p>`,
      defaultYes: false
    });
  }
  if (!isPrecise) return { statOverride: null };

  announceActionApplied(actor, item.name, game.i18n.localize("DWAUTO.PreciseWeapon.Applied"));
  return { statOverride: "DEX" };
}

// 근접 무브(예: 접근전) 옆에 3단계 토글 배지를 붙인다. 클릭할 때마다
// 매번 묻기 → 항상 정밀 → 정밀 없음 순으로 돌아가고, 플레이어와 마스터
// 둘 다 클릭할 수 있다(GM 전용으로 막지 않는다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findMeleeMoveItem(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-precise-mode-badge").remove();

  const mode = getPreciseMode(actor);
  const $badge = $(
    `<a class="tag dwauto-precise-mode-badge${mode !== "ask" ? " dwauto-precise-mode-on" : ""}" title="${game.i18n.localize("DWAUTO.PreciseWeapon.ToggleTitle")}">${modeLabel(mode)}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setPreciseMode(actor, nextMode(mode));
  });
}

export function registerPreciseWeaponAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
