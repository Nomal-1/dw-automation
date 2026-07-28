import { MODULE_ID, SETTINGS } from "../constants.js";
import { injectActorTab } from "../lib/actor-tabs.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// Cleric Deity/Apotheosis, Druid Born of the Soil, Ranger Animal Companion처럼
// "이름/영역/증표 같은 것을 자유롭게 정해서 기록해두는" 무브들. 던전월드
// 자체가 이런 무브는 정형화된 수치가 아니라 서사적 설정이라, 주사위나
// 선택지를 자동화하는 대신 그 무브 이름을 그대로 딴 탭 하나를 만들어
// 자유 메모란을 붙여준다(무브 자체의 설명도 같이 보여줘서 정할 항목을
// 다시 찾아볼 필요가 없게 한다).
//
// 메모는 무브 이름이 아니라 그 무브 "아이템의 _id"로 저장한다 — 이름은
// 번역 모듈이 나중에 바꿀 수 있는데, 그때 이미 적어둔 메모가 옛 이름 밑에
// 고아로 남아버리는 걸 막기 위해서다.
const NOTES_FLAG = "noteMoves";

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getNoteText(actor, moveItem) {
  return actor.getFlag(MODULE_ID, NOTES_FLAG)?.[moveItem.id] ?? "";
}

async function setNoteText(actor, moveItem, text) {
  const current = actor.getFlag(MODULE_ID, NOTES_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, NOTES_FLAG, { ...current, [moveItem.id]: text });
}

async function resetNote(actor, moveItem) {
  const current = actor.getFlag(MODULE_ID, NOTES_FLAG) ?? {};
  if (!(moveItem.id in current)) return;
  const next = { ...current };
  delete next[moveItem.id];
  await actor.setFlag(MODULE_ID, NOTES_FLAG, next);
}

function renderNoteTab(actor, moveItem, html) {
  const $body = injectActorTab({
    html,
    actor,
    tabKey: `dwauto-note-${moveItem.id}`,
    navLabel: moveItem.name,
    onReset: () => resetNote(actor, moveItem)
  });
  $body.addClass("dwauto-tab");

  const description = moveItem.system?.description ?? "";
  const text = getNoteText(actor, moveItem);

  const $section = $(`
    <div class="cell dwauto-note-move">
      ${description ? `<div class="dwauto-note-description">${description}</div>` : ""}
      <label class="cell__title">${game.i18n.localize("DWAUTO.NoteMoves.NotesLabel")}</label>
      <textarea class="dwauto-note-textarea" rows="8">${text}</textarea>
    </div>
  `);

  $section.find(".dwauto-note-textarea").on("change", (event) => {
    setNoteText(actor, moveItem, event.currentTarget.value);
  });

  $body.append($section);
}

function onRenderActorSheet(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_NOTE_MOVES)) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const names = splitCommaList(SETTINGS.NOTE_MOVE_NAMES);
  if (names.length === 0) return;

  for (const moveItem of actor.items) {
    if (moveItem.type !== "move" || !names.includes(moveItem.name)) continue;
    renderNoteTab(actor, moveItem, html);
  }
}

// 대지의 아들/딸은 v0.22.0부터 이 기능(소유만으로 탭 생성) 대신
// features/born-of-the-soil.js(실제 발동해야 팝업+탭)로 옮겨갔다. 하지만
// 그 전에 이미 "메모형 무브 이름" 설정을 저장해둔 세계는 그 값이 그대로
// 남아있어서(기본값을 코드에서 바꿔도 이미 저장된 설정엔 영향이 없다),
// 이 이름이 여전히 목록에 남아 예전처럼 소유만으로 탭이 뜬다. 세계 설정을
// 딱 한 번 조용히 정리해서, 영문 기본값("Born of the Soil")과 지금
// dungeonworld-ko가 알려주는 번역명을 둘 다 확인해 남아있으면 제거한다.
async function migrateBornOfTheSoilOut() {
  if (!game.user.isGM) return;

  const raw = game.settings.get(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES);
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) return;

  const toRemove = new Set(["Born of the Soil"]);
  try {
    const nameMap = await getMoveNameMap();
    const translated = nameMap.get("Born of the Soil");
    if (translated) toRemove.add(translated);
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 기본값은 제거한다.
  }

  const next = names.filter((n) => !toRemove.has(n));
  if (next.length === names.length) return;

  await game.settings.set(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES, next.join(", "));
  console.log(
    `${MODULE_ID} | note-moves: removed Born of the Soil from Note-Taking Move Names (now handled by features/born-of-the-soil.js)`
  );
}

// v0.23.x 전수조사로 새로 찾은 "자유 기입형" 무브(팔라딘 Quest/Divine Favor,
// 레인저 God Amidst The Wastes)를 이미 이 설정을 저장해둔 세계에도 반영한다.
// 이미 목록에 있는 이름(영문이든 번역명이든)은 건드리지 않고, 없는 것만 한 번
// 추가한다.
async function migrateAddSurveyedNoteMoves() {
  if (!game.user.isGM) return;

  const NEW_DEFAULTS = ["Quest", "Divine Favor", "God Amidst The Wastes"];

  const raw = game.settings.get(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES);
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const existing = new Set(names);

  let nameMap = null;
  try {
    nameMap = await getMoveNameMap();
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 이름으로는 추가한다.
  }

  const toAdd = [];
  for (const name of NEW_DEFAULTS) {
    if (existing.has(name)) continue;
    const translated = nameMap?.get(name);
    if (translated && existing.has(translated)) continue;
    toAdd.push(translated ?? name);
  }

  if (toAdd.length === 0) return;

  await game.settings.set(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES, [...names, ...toAdd].join(", "));
  console.log(`${MODULE_ID} | note-moves: added newly-surveyed default(s) to Note-Taking Move Names`, toAdd);
}

export function registerNoteMoves() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.once("ready", () => {
    migrateBornOfTheSoilOut();
    migrateAddSurveyedNoteMoves();
  });
}
