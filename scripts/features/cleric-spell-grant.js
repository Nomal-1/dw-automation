import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getPaladinClericLevel } from "./note-moves.js";

// 예배(Commune)를 가진 액터의 주문 탭에 "현재 레벨 사제 주문 모두 얻기"
// 버튼을 붙인다. 실제 클레릭은 자기 레벨을, 팔라딘 신의 은혜(Divine
// Favor)로 예배를 얻은 경우는 그 클레릭 레벨(features/note-moves.js가
// 관리, features/spell-preparation.js의 예배 준비 한도 계산과 동일한
// 기준)을 쓴다 — 둘 다 "그 레벨 이하의 클레릭 기본 주문 컴펜디엄 전체"를
// 대상으로, 이미 갖고 있는 주문(이름 기준, 스펠북 증보/신의 은혜로 이미
// 받은 것 포함)은 제외하고 나머지를 한 번에 스펠북에 추가한다(system.prepared는
// false로 시작 — 실제로 쓰려면 예배/주문 준비를 따로 해야 한다).
const CLERIC_SPELL_PACK_ID = "dungeonworld.the-cleric-spells";

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_CLERIC_SPELL_GRANT_ASSISTANT);
}

// Commune인지는 이름이 아니라(번역되면 원문과 달라지므로) "주문 준비 무브"
// 표(features/spell-preparation.js와 공유)의 enforceIndividualLevelCap
// 표식으로 구분한다 — 위저드 Prepare Spells만 이 표식이 없다(data/
// prepare-spells-moves.js 참고).
function findCommuneMove(actor) {
  const rows = game.settings.get(MODULE_ID, SETTINGS.PREPARE_SPELLS_MOVES);
  const communeRow = rows.find((r) => r.enforceIndividualLevelCap);
  if (!communeRow) return null;
  return actor.items.find((i) => i.type === "move" && i.name === communeRow.name) ?? null;
}

function getEffectiveClericLevel(actor) {
  const paladinLevel = getPaladinClericLevel(actor);
  if (paladinLevel !== null) return paladinLevel;
  return Number(actor.system?.attributes?.level?.value) || 1;
}

async function loadClericSpellDocs() {
  const pack = game.packs.get(CLERIC_SPELL_PACK_ID);
  if (!pack) return [];
  try {
    return await pack.getDocuments();
  } catch (err) {
    console.warn(`${MODULE_ID} | cleric-spell-grant: failed to load pack ${CLERIC_SPELL_PACK_ID}`, err);
    return [];
  }
}

function promptConfirmGrant(moveLabel, level, docs) {
  const listHtml = docs
    .map((d) => `<li>${d.name} (Lv.${d.system?.spellLevel ?? "?"})</li>`)
    .join("");

  return Dialog.confirm({
    title: moveLabel,
    content: `
      <p>${game.i18n.format("DWAUTO.ClericSpellGrant.ConfirmContent", { level, count: docs.length })}</p>
      <ul>${listHtml}</ul>
    `,
    defaultYes: true
  });
}

async function grantClericSpells(actor, moveItem) {
  const level = getEffectiveClericLevel(actor);
  const allSpells = await loadClericSpellDocs();
  const owned = new Set(actor.items.filter((i) => i.type === "spell").map((i) => i.name));

  const toAdd = allSpells.filter((d) => {
    const spellLevel = Number(d.system?.spellLevel) || 0;
    return spellLevel <= level && !owned.has(d.name);
  });

  if (toAdd.length === 0) {
    ui.notifications.info(game.i18n.format("DWAUTO.ClericSpellGrant.NothingToAdd", { level }));
    return;
  }

  const confirmed = await promptConfirmGrant(moveItem.name, level, toAdd);
  if (!confirmed) return;

  await actor.createEmbeddedDocuments(
    "Item",
    toAdd.map((d) => d.toObject())
  );

  announceActionApplied(
    actor,
    moveItem.name,
    game.i18n.format("DWAUTO.ClericSpellGrant.Added", { count: toAdd.length, level })
  );
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findCommuneMove(actor);
  if (!moveItem) return;

  const $cell = html.find(".tab.spells .cell--spells");
  if (!$cell.length || $cell.find(".dwauto-cleric-spell-grant-button").length) return;

  const $button = $(
    `<button type="button" class="dwauto-cleric-spell-grant-button">${game.i18n.localize("DWAUTO.ClericSpellGrant.ButtonLabel")}</button>`
  );
  $cell.prepend($button);

  $button.on("click", async (event) => {
    event.preventDefault();
    await grantClericSpells(actor, moveItem);
  });
}

export function registerClericSpellGrantAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
