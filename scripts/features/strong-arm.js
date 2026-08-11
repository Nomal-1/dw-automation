import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";

// 도적 고급액션 철완의 투척(Strong Arm, True Aim) 원문: "아무 근거리 무기나
// 던져서 사격을 할 수 있습니다. 한 번 던진 근거리 무기는 손을 떠나기
// 때문에, 7~9가 나왔을 때 발수를 소비하는 선택지를 고를 수 없습니다."
//
// 이 무브의 공식 영문 이름 자체에 쉼표가 들어있어("Strong Arm, True Aim"),
// 다른 무브 이름 설정들처럼 splitCommaList로 쪼개면 "Strong Arm"과
// "True Aim" 두 조각으로 갈라져 실제 아이템 이름과 절대 일치하지 않는다
// (번역 자동 채우기도 같은 이유로 조각마다 따로 찾다 실패해 원문 그대로
// 남는다). 그래서 이 설정만 쉼표 목록이 아니라 "정식 명칭 전체"를 담는
// 단일 값으로 다루고, 다른 무브들처럼 번역 매핑(getMoveNameMap)도 함께
// 확인한다.
//
// 매번 "근접무기를 던지시겠습니까?"를 묻는 게 귀찮을 수 있어(근접무기를
// 아예 안 던지는 캐릭터라면 매번 아니오만 누르게 된다), 정밀 태그 토글과
// 같은 방식으로 무브 옆에 2단계 토글(항상 묻기/미적용)을 붙인다. 플레이어와
// 마스터 둘 다 클릭할 수 있다(정밀 태그와 같은 이유 — GM 전용으로 막을
// 이유가 없는 개인 판단 토글).
const MODE_FLAG = "strongArmMode"; // "ask" | "off"
const MODES = ["ask", "off"];

function getStrongArmMode(actor) {
  const value = actor.getFlag(MODULE_ID, MODE_FLAG);
  return MODES.includes(value) ? value : "ask";
}

async function setStrongArmMode(actor, mode) {
  await actor.setFlag(MODULE_ID, MODE_FLAG, mode);
}

function nextMode(mode) {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}

function modeLabel(mode) {
  return mode === "off"
    ? game.i18n.localize("DWAUTO.StrongArm.ModeOff")
    : game.i18n.localize("DWAUTO.StrongArm.ModeAsk");
}

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_STRONG_ARM_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesStrongArmName(title) {
  const configured = game.settings.get(MODULE_ID, SETTINGS.STRONG_ARM_MOVE_NAMES).trim();
  if (configured && configured === title) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Strong Arm, True Aim") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

async function findStrongArmMove(actor) {
  for (const item of actor.items) {
    if (item.type !== "move") continue;
    if (await matchesStrongArmName(item.name)) return item;
  }
  return null;
}

// 시트 렌더링(토글 배지 부착)에서 쓰는 동기 버전. 번역 매핑까지 확인하는
// 위 비동기 버전과 달리 설정값과의 직접 비교만 한다 — 다른 토글 배지들
// (정밀 태그 등)도 렌더 시점에는 같은 방식을 쓴다.
function findMoveSync(actor) {
  const configured = game.settings.get(MODULE_ID, SETTINGS.STRONG_ARM_MOVE_NAMES).trim();
  return actor.items.find((i) => i.type === "move" && i.name === configured) ?? null;
}

function isRangedTitle(title) {
  return splitCommaList(SETTINGS.RANGED_MOVE_NAMES).includes(title);
}

// features/attack-assistant.js가 사격의 선택지를 보여주기 직전에 호출한다.
// 이 무브가 없거나 지금 굴린 게 사격이 아니면 조용히 통과한다. 토글이
// "미적용"이면 묻지도 않고 바로 통과한다.
export async function promptStrongArmThrow(actor, moveTitle) {
  if (!isEnabled()) return { throwing: false };
  if (!isRangedTitle(moveTitle)) return { throwing: false };

  const moveItem = await findStrongArmMove(actor);
  if (!moveItem) return { throwing: false };

  if (getStrongArmMode(actor) === "off") return { throwing: false };

  const throwing = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.StrongArm.Prompt")}</p>`,
    defaultYes: false
  });
  if (!throwing) return { throwing: false };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.StrongArm.Applied"));
  return { throwing: true };
}

// 근접 무브(예: 접근전) 옆 정밀 태그 배지와 같은 방식으로, 철완의 투척
// 옆에 항상 묻기/미적용 2단계 토글 배지를 붙인다. 클릭할 때마다 순서대로
// 바뀌고, 플레이어와 마스터 둘 다 클릭할 수 있다.
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const strongArmMove = findMoveSync(actor);
  if (!strongArmMove) return;

  const $item = html.find(`.item[data-item-id="${strongArmMove.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-strong-arm-mode-badge").remove();

  const mode = getStrongArmMode(actor);
  const $badge = $(
    `<a class="tag dwauto-strong-arm-mode-badge${mode === "off" ? " dwauto-strong-arm-mode-on" : ""}" title="${game.i18n.localize("DWAUTO.StrongArm.ToggleTitle")}">${modeLabel(mode)}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setStrongArmMode(actor, nextMode(mode));
  });
}

// 사격 7-9 선택지에서 "발수 소비" 항목(설정한 인덱스, 1부터 시작)을
// 제외한다. 인덱스가 범위를 벗어나면(GM이 컴펜디엄 문구를 크게 바꾼 경우)
// 안전하게 원래 목록을 그대로 돌려준다.
export function removeAmmoChoice(options) {
  const index = Number(game.settings.get(MODULE_ID, SETTINGS.STRONG_ARM_AMMO_CHOICE_INDEX));
  if (!Number.isFinite(index) || index < 1 || index > options.length) return options;
  return options.filter((_, i) => i + 1 !== index);
}

export function registerStrongArmAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
