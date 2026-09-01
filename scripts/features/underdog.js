import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { DEFAULT_DAMAGE_REDUCTION_MOVES } from "../data/hit-trigger-moves.js";
import { getMoveNameMap, resolveDamageReductionMoveName } from "../lib/translation-import.js";
import { isNoteMoveActive } from "./note-moves.js";
import { getEffectiveSpellLevel } from "./spell-preparation.js";

// "조건부 장갑 보너스 무브" 설정 표(Conditional Armor Bonus Moves)는
// 이름/평소 보너스/조건 충족 시 보너스로 이루어진 일반 표라 GM이 서로 무관한
// 여러 무브를 자유롭게 등록할 수 있다. 예:
//   Underdog(오기): 조건 미충족(0) / 조건 충족(1) — "숫적으로 열세일 때"
//   Serious Underdog(투지): 조건 미충족(1) / 조건 충족(2) — "숫적으로 열세일 때"
//   나무껍질류: 조건 미충족(0) / 조건 충족(1) — "땅에 발이 닿아있을 때" 등
// "그 조건이 지금 충족되었는가"는 씬 정보로 자동 판정할 수 없는 서사적
// 판단이라, 무브별로 독립된(액터 플래그를 무브 _id로 나눈) 토글로 관리한다:
// 캐릭터 시트에서 무브마다 따로 켜고 끌 수 있고, 무브별로 "피격 때마다
// 묻기"가 켜져 있으면 맞을 때마다 hit-trigger.js가 그 무브에 대해서만 Y/N으로
// 다시 확인해서 상태가 바뀌면 그 토글도 같이 갱신한다. 한 액터가 이런 무브를
// 여러 개 동시에 가져도(예: 멀티클래스) 서로 완전히 독립적으로 동작한다.
//
// 이 토글들은 armor-assistant.js의 장갑 재계산에 "지금 활성 보정"으로 함께
// 반영되고, 토글이 실제로 바뀌는 순간에는 재계산을 다시 부르는 대신 그 무브의
// 두 상태(평소/조건 충족) 사이의 실제 보너스 차이만큼만 장갑 수치를 그
// 자리에서 직접 조정한다(무브마다 차이가 다를 수 있어 더 이상 ±1로 고정하지
// 않는다).
const CONDITION_ACTIVE_FLAG = "underdogConditionActive"; // { [moveId]: boolean }
const ASK_EACH_HIT_FLAG = "underdogAskEachHit"; // { [moveId]: boolean }, 기본값 true

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_HIT_TRIGGER_ASSISTANT);
}

function getRows() {
  return game.settings.get(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES);
}

// 액터가 실제로 가진 모든 조건부 장갑 무브 행을 찾는다(무브별로 독립적이므로
// 첫 번째 하나만 찾던 이전 방식과 달리 전부 반환한다).
function getOwnedRows(actor) {
  const owned = [];
  for (const row of getRows()) {
    const move = actor.items.find((i) => i.type === "move" && i.name === row.name);
    if (move) owned.push({ row, move });
  }
  return owned;
}

// v0.22.x까지는 액터당 하나의 boolean 플래그(무브 하나만 지원)였다. 이미
// 그 상태로 저장된 세계를 위해, 아직 무브별 맵으로 바뀌지 않은(boolean 그대로인)
// 경우 그 값을 그대로 켜짐/꺼짐으로 취급한다(그 시점엔 실제로 무브가 하나뿐이었
// 으므로 안전하다). 토글을 다시 누르면 자동으로 무브별 맵 형태로 바뀐다.
export function isConditionActive(actor, moveId) {
  const flag = actor.getFlag(MODULE_ID, CONDITION_ACTIVE_FLAG);
  if (typeof flag === "boolean") return flag;
  return Boolean(flag?.[moveId]);
}

// 위저드 Arcane Ward/Arcane Armor 전용: "1레벨 이상 주문을 하나라도 준비하고
// 있는가"를 액터의 주문 아이템에서 직접 읽어 판정한다(features/spell-preparation.js가
// system.prepared를 정확히 유지해준다). 원문 레벨이 아니라 getEffectiveSpellLevel로
// 확인해서, 천재/대가 등으로 0레벨(암송주문)까지 낮춰둔 주문은 더 이상
// 조건을 만족시키지 않게 한다.
function hasPreparedSpellOfLevel1Plus(actor) {
  return actor.items.some((i) => i.type === "spell" && i.system?.prepared && getEffectiveSpellLevel(actor, i) >= 1);
}

// 팔라딘 Holy Protection처럼 linkedMoveName이 있는 행은 수동 토글이 아니라
// 다른 메모형 무브(퀘스트 등)의 발동 상태를 그대로 조건으로 쓴다 — GM/플레이어가
// 따로 켜고 끌 필요가 없다. autoCheckPreparedSpell이 있는 행(Arcane Ward/Armor)도
// 마찬가지로 완전히 자동 판정이라 수동 토글이 필요 없다.
function isRowConditionActive(actor, row, move) {
  if (row.autoCheckPreparedSpell) return hasPreparedSpellOfLevel1Plus(actor);
  if (row.linkedMoveName) return isNoteMoveActive(actor, row.linkedMoveName);
  return isConditionActive(actor, move.id);
}

function shouldAskEachHit(actor, moveId) {
  const flag = actor.getFlag(MODULE_ID, ASK_EACH_HIT_FLAG);
  if (typeof flag === "boolean") return flag;
  return flag?.[moveId] ?? true;
}

async function setConditionActive(actor, moveId, active) {
  const current = actor.getFlag(MODULE_ID, CONDITION_ACTIVE_FLAG);
  const base = typeof current === "object" && current !== null ? current : {};
  await actor.setFlag(MODULE_ID, CONDITION_ACTIVE_FLAG, { ...base, [moveId]: active });
}

async function setAskEachHit(actor, moveId, ask) {
  const current = actor.getFlag(MODULE_ID, ASK_EACH_HIT_FLAG);
  const base = typeof current === "object" && current !== null ? current : {};
  await actor.setFlag(MODULE_ID, ASK_EACH_HIT_FLAG, { ...base, [moveId]: ask });
}

// armor-assistant.js의 장갑 재계산이 호출한다. 액터가 가진 모든 조건부 장갑
// 무브 각각의 현재 토글 상태에 맞는 보너스를 배열로 돌려준다(무브가 없으면
// 빈 배열). 조건 미충족이라 보너스가 0이어도 "이 무브가 지금 아무것도 안
// 주고 있다"는 걸 보여주기 위해 그대로 포함한다(합계에는 영향 없음).
export function getOutnumberedArmorContribution(actor) {
  if (!isEnabled()) return [];
  return getOwnedRows(actor).map(({ row, move }) => ({
    source: move.name,
    amount: Number(isRowConditionActive(actor, row, move) ? row.outnumberedBonus : row.baseBonus) || 0
  }));
}

// hit-trigger.js가 피격 훅에서 호출한다. "피격 때마다 묻기"가 켜진 무브들만
// 후보로 돌려준다(무브마다 독립적이므로 여러 개일 수 있다). linkedMoveName이나
// autoCheckPreparedSpell이 있는 행은 물어볼 게 없다 — 조건이 다른 곳(메모형
// 무브 발동 상태, 준비된 주문 목록)에서 자동으로 정해지므로 애초에 후보에서 뺀다.
export function getOutnumberedAskCandidate(actor) {
  if (!isEnabled()) return [];
  return getOwnedRows(actor)
    .filter(({ row, move }) => !row.linkedMoveName && !row.autoCheckPreparedSpell && shouldAskEachHit(actor, move.id))
    .map(({ move }) => ({ moveId: move.id, moveName: move.name }));
}

// 조건 충족 여부 답(수동 토글 클릭이든, 피격 때마다 묻기의 Y/N 답이든)을
// 반영한다. 실제로 상태가 바뀐 경우에만 장갑을 조정한다. 이 무브의
// 평소/조건 충족 보너스 차이만큼만 조정하므로(더 이상 ±1 고정 아님) 무브마다
// 다른 보너스 폭을 정확히 반영한다. hit-trigger.js가 { changed, newArmor }를
// 보고 "지금 이 피격"의 피해량을 새 장갑 기준으로 다시 계산할지 판단한다.
export async function applyOutnumberedAnswer(actor, moveId, moveName, nowActive) {
  const currentArmor = Number(actor.system.attributes?.ac?.value) || 0;
  const wasActive = isConditionActive(actor, moveId);
  if (wasActive === nowActive) return { changed: false, newArmor: currentArmor };

  const row = getRows().find((r) => r.name === moveName);
  const delta = row
    ? (nowActive ? row.outnumberedBonus : row.baseBonus) - (wasActive ? row.outnumberedBonus : row.baseBonus)
    : nowActive
      ? 1
      : -1;

  await setConditionActive(actor, moveId, nowActive);

  const next = Math.max(0, currentArmor + delta);
  await actor.update({ "system.attributes.ac.value": next });

  const messageKey = nowActive ? "DWAUTO.Underdog.BecameOutnumbered" : "DWAUTO.Underdog.NoLongerOutnumbered";
  announceActionApplied(actor, moveName, game.i18n.format(messageKey, { armor: next }));

  return { changed: true, newArmor: next };
}

function renderBadges(actor, html) {
  for (const { row, move } of getOwnedRows(actor)) {
    const $item = html.find(`.item[data-item-id="${move.id}"]`);
    if (!$item.length) continue;

    const $tags = getOrCreateTagsContainer($item);

    // linkedMoveName이 있는 행(팔라딘 Holy Protection 등)이나 autoCheckPreparedSpell이
    // 있는 행(위저드 Arcane Ward/Armor)은 다른 곳에서 조건이 자동으로 정해지므로
    // 수동으로 켜고 끌 게 없다 — 지금 상태를 읽기 전용 표시로만 보여준다.
    if (row.linkedMoveName || row.autoCheckPreparedSpell) {
      if ($tags.find(".dwauto-underdog-linked-badge").length) continue;
      const active = isRowConditionActive(actor, row, move);
      const title = row.autoCheckPreparedSpell
        ? game.i18n.localize("DWAUTO.Underdog.AutoPreparedSpellToggleTitle")
        : game.i18n.format("DWAUTO.Underdog.LinkedToggleTitle", { linked: row.linkedMoveName });
      const $badge = $(
        `<a class="tag dwauto-underdog-linked-badge${active ? " dwauto-underdog-on" : ""}" title="${title}">${game.i18n.localize(active ? "DWAUTO.Underdog.OutnumberedOn" : "DWAUTO.Underdog.OutnumberedOff")}</a>`
      );
      $tags.append($badge);
      continue;
    }

    if (!$tags.find(".dwauto-underdog-outnumbered-badge").length) {
      const active = isConditionActive(actor, move.id);
      const $badge = $(
        `<a class="tag dwauto-underdog-outnumbered-badge${active ? " dwauto-underdog-on" : ""}" title="${game.i18n.localize("DWAUTO.Underdog.OutnumberedToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.Underdog.OutnumberedOn" : "DWAUTO.Underdog.OutnumberedOff")}</a>`
      );
      $tags.append($badge);

      $badge.on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await applyOutnumberedAnswer(actor, move.id, move.name, !active);
      });
    }

    if (!$tags.find(".dwauto-underdog-ask-badge").length) {
      const ask = shouldAskEachHit(actor, move.id);
      const $askBadge = $(
        `<a class="tag dwauto-underdog-ask-badge${ask ? " dwauto-underdog-on" : ""}" title="${game.i18n.localize("DWAUTO.Underdog.AskEachHitTitle")}">${game.i18n.localize(ask ? "DWAUTO.Underdog.AskEachHitOn" : "DWAUTO.Underdog.AskEachHitOff")}</a>`
      );
      $tags.append($askBadge);

      $askBadge.on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await setAskEachHit(actor, move.id, !ask);
      });
    }
  }
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  renderBadges(actor, html);
}

// v0.16.0 전에는 이 표(당시 "피해 경감 무브")가 {name, amount} 구조였다.
// 그 뒤 baseBonus/outnumberedBonus로 바뀌었는데, 이미 그 표를 저장해둔
// 세계는 옛 amount 필드만 남아있어서(baseBonus/outnumberedBonus가 아예
// 없어서) getOutnumberedArmorContribution이 항상 0을 돌려주고 있었다.
// amount만으로는 어느 무브인지 알 수 없지만, 실제 기본값과 겹치는 값
// 기준으로 안전하게 채워 넣는다(amount 1 -> 오기(0/1), amount 2 이상 ->
// 투지류(amount-1/amount) — 투지는 원문상 열세가 아니어도 +1이 상시
// 적용되는데 예전 데이터엔 그 구분이 아예 없었으므로 이 값이 최선이다).
async function migrateLegacyAmountField() {
  if (!game.user.isGM) return;

  const rows = game.settings.get(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES);
  let changed = false;

  const next = rows.map((row) => {
    if (typeof row.baseBonus === "number" || typeof row.outnumberedBonus === "number") return row;
    if (typeof row.amount !== "number") return row;

    changed = true;
    const outnumberedBonus = row.amount;
    const baseBonus = row.amount >= 2 ? row.amount - 1 : 0;
    const { amount, ...rest } = row;
    return { ...rest, baseBonus, outnumberedBonus };
  });

  if (!changed) return;

  await game.settings.set(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES, next);
  console.log(
    `${MODULE_ID} | underdog: migrated legacy "amount" field on Conditional Armor Bonus Moves to baseBonus/outnumberedBonus`
  );
}

// v0.23.x 전수조사로 새로 찾은 기본값(Unencumbered Unharmed, Barkskin, Divine
// Protection/Armor 등)은 이미 세계를 설정해둔 GM에게는 그냥 코드 기본값을
// 바꾸는 것만으로 반영되지 않는다(game.settings 기본값은 한 번도 저장된 적
// 없는 세계에만 적용된다). 이미 저장된 표에 없는 이름만 골라 한 번 추가해준다
// — GM이 이미 그 이름을 지웠었다 해도(이 조사 전부터 그 이름을 쓴 적이
// 없으므로) 구분할 방법이 없어 그냥 다시 채워 넣는다. 이름은 번역 데이터가
// 있으면 번역된 이름 기준으로 저장해서, 이미 번역된 세계에서도 즉시 매칭된다.
async function migrateAddSurveyedDefaults() {
  if (!game.user.isGM) return;

  const rows = game.settings.get(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES);
  // 이름만으로 구분하면 "Divine Protection"처럼 linkedMoveName 유무로만
  // 갈리는 두 기본 행(클레릭/팔라딘)을 서로 같은 것으로 착각해 하나를
  // 빠뜨릴 수 있다 — 이름+연동 무브 이름을 합쳐서 구분한다.
  const rowKey = (r) => `${r.name}|${r.linkedMoveName || ""}`;
  const existingKeys = new Set(rows.map(rowKey));

  let nameMap = null;
  try {
    nameMap = await getMoveNameMap();
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 이름으로는 추가한다.
  }

  const toAdd = [];
  for (const row of DEFAULT_DAMAGE_REDUCTION_MOVES) {
    if (existingKeys.has(rowKey(row))) continue;

    // "Divine Protection"처럼 클레릭/팔라딘이 이름을 공유하는 경우는
    // getMoveNameMap()에서 아예 빠져있다(모호해서 제외됨). 그런 이름만
    // runTranslationImport과 같은 규칙(linkedMoveName 유무)으로 다시 알아본다
    // — 안 그러면 이미 번역되어 저장된 행("믿음의 갑옷"/"신의 갑옷")과 다르다고
    // 착각해서 중복으로 또 추가해버린다(실제로 발생했던 버그).
    let translatedName = nameMap?.get(row.name);
    if (!translatedName) {
      try {
        translatedName = await resolveDamageReductionMoveName(row.name, row.linkedMoveName);
      } catch (err) {
        // 못 알아내면 영문 이름으로 계속한다.
      }
    }
    // linkedMoveName(Holy Protection의 "Quest" 등)도 무브 이름이라 이 시점의
    // 번역 데이터로 같이 바꿔줘야 features/note-moves.js가 실제 캐릭터가
    // 들고 있는 (번역된) 이름으로 정확히 찾을 수 있다.
    const translatedLinked = row.linkedMoveName ? nameMap?.get(row.linkedMoveName) : row.linkedMoveName;
    const translatedKey = `${translatedName ?? row.name}|${translatedLinked || ""}`;
    if (existingKeys.has(translatedKey)) continue;

    let finalRow = translatedName ? { ...row, name: translatedName } : row;
    if (translatedLinked) finalRow = { ...finalRow, linkedMoveName: translatedLinked };
    toAdd.push(finalRow);
  }

  if (toAdd.length === 0) return;

  await game.settings.set(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES, [...rows, ...toAdd]);
  console.log(
    `${MODULE_ID} | underdog: added ${toAdd.length} newly-surveyed default(s) to Conditional Armor Bonus Moves`,
    toAdd.map((r) => r.name)
  );
}

// 위 migrateAddSurveyedDefaults가 예전엔(이 수정 전) "Divine Protection"의
// 모호한-이름 번역을 제대로 못 알아봐서, 이미 "믿음의 갑옷"/"신의 갑옷"으로
// 번역되어 저장된 세계에 같은 행을 중복으로 추가해버린 적이 있다(실제로
// 사용자 화면에서 확인된 버그). 이름+연동 무브 이름이 완전히 같은 행이 두
// 번 이상 있으면, 먼저 나온 것만 남기고 나머지는 지운다.
async function migrateDedupeRows() {
  if (!game.user.isGM) return;

  const rows = game.settings.get(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES);
  const rowKey = (r) => `${r.name}|${r.linkedMoveName || ""}`;
  const seen = new Set();
  const deduped = [];
  let removed = 0;

  for (const row of rows) {
    const key = rowKey(row);
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }

  if (removed === 0) return;

  await game.settings.set(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES, deduped);
  console.log(`${MODULE_ID} | underdog: removed ${removed} duplicate row(s) from Conditional Armor Bonus Moves`);
}

export function registerUnderdogAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
  // 세 마이그레이션 모두 이 표를 읽고 다시 통째로 쓰기 때문에, 순서 없이
  // 동시에 실행하면 서로의 쓰기를 덮어쓸 수 있다 — 반드시 순서대로 기다린다.
  Hooks.once("ready", async () => {
    await migrateLegacyAmountField();
    await migrateDedupeRows();
    await migrateAddSurveyedDefaults();
  });
}
