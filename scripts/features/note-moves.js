import { MODULE_ID, SETTINGS } from "../constants.js";
import { injectActorTab } from "../lib/actor-tabs.js";

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

export function registerNoteMoves() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
