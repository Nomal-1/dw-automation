import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getPendingRollBonus, setPendingRollBonus, clearPendingRollBonus } from "../lib/roll-bonus-state.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { DEFAULT_SELF_FORWARD_MOVES } from "../data/self-forward-moves.js";

// Reaper(클레릭)/Quick Study(위저드)/An Ear For Magic(바드)/My Love For You Is
// Like A Truck(바바리안)/Unforgettable Face(바드)/Usurper(바바리안)처럼
// "따로 판정 없이, 특정 상황이 벌어지면 자기 자신에게 +1 forward를 받는다"는
// 동일한 구조의 무브들을 이름 목록(테이블) 하나로 처리한다. rollType이
// 아예 없는 무브라 클릭해도 성공/부분성공/실패 구분이 없다 — getMoveCardInfo가
// title/actor만 뽑아주면 충분하다.
//
// restrictToMoveNames가 있는 행(예: "협상 판정에만 +1")은 lib/
// roll-bonus-state.js의 restrictToMoveNames로 그대로 넘긴다 — roll-wrapper.js가
// 그 이름과 일치하는 판정을 만날 때만 소모한다. Unforgettable Face/Usurper는
// 원문상 +1이 "특정 NPC(의 부하)에 대한 판정"에만 적용되지만, 지금 굴리는
// 판정이 그 NPC를 대상으로 하는지 자동으로 판별할 방법이 없다 — 그래서
// 대신 무브 옆에 GM 전용 수동 토글 배지를 둔다: "지금 그 NPC를 상대하는
// 상황"인지는 GM이 직접 보고 판단해서 켜고 끄면(그 판단이 자동 감지를
// 대신한다), 그 다음부터는 다른 자동화와 완전히 동일하게 다음 판정에
// 적용/소모된다. 이 배지는 무브를 실제로 클릭해서 발동했을 때도(다른
// 4개 무브처럼) 똑같이 켜진다 — 두 가지 트리거(클릭/수동 토글)가 같은
// 플래그를 공유한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SELF_FORWARD_ASSISTANT);
}

function getRows() {
  return game.settings.get(MODULE_ID, SETTINGS.SELF_FORWARD_MOVES);
}

function parseRestrictToMoveNames(row) {
  return row.restrictToMoveNames
    ? row.restrictToMoveNames
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
}

// 설정("자기 자신 forward 무브")에 등록된 이름과 채팅 카드 제목을 비교한다.
// features/class-grant.js와 같은 방식으로, 설정값이 아직 번역 전이어도
// 지금 시점의 번역 데이터로 다시 한번 확인한다.
async function matchesConfiguredRow(title) {
  const rows = getRows();
  const direct = rows.find((r) => r.name === title);
  if (direct) return direct;

  try {
    const nameMap = await getMoveNameMap();
    for (const defaultRow of DEFAULT_SELF_FORWARD_MOVES) {
      if (nameMap.get(defaultRow.name) === title) {
        return rows.find((r) => r.name === defaultRow.name) ?? defaultRow;
      }
    }
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return null;
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title } = info;
    if (actor.type !== "character") return;

    const row = await matchesConfiguredRow(title);
    if (!row) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const restrictToMoveNames = parseRestrictToMoveNames(row);

    await setPendingRollBonus(actor, 1, moveItem.name, restrictToMoveNames);

    announceActionApplied(
      actor,
      moveItem.name,
      restrictToMoveNames
        ? game.i18n.format("DWAUTO.SelfForward.AppliedRestricted", { moves: restrictToMoveNames.join(", ") })
        : game.i18n.localize("DWAUTO.SelfForward.Applied")
    );
  } catch (err) {
    console.error(`${MODULE_ID} | self-forward: onCreateChatMessage failed`, err);
  }
}

// 지금 이 무브발 +1 forward가 대기 중인지. pendingRollBonus는 액터당 하나뿐
// 이라(원조/방해가 건 것일 수도, 다른 자기 자신 forward 무브가 건 것일
// 수도 있다) source가 이 무브 이름과 같을 때만 "이 무브가 켜둔 것"으로
// 본다.
function isActiveFor(actor, moveName) {
  const pending = getPendingRollBonus(actor);
  return Boolean(pending && pending.source === moveName);
}

async function toggleSelfForward(actor, row, moveName) {
  if (isActiveFor(actor, moveName)) {
    await clearPendingRollBonus(actor);
  } else {
    await setPendingRollBonus(actor, 1, moveName, parseRestrictToMoveNames(row));
  }
}

// 무브 옆에 "적용중"/"적용 안됨" 배지를 붙인다. 배지 자체는 누구에게나
// 보이지만(지금 상태를 알 수 있어야 하므로), 클릭해서 켜고 끄는 건 GM만
// 가능하다(hold 배지와 같은 패턴). 판정에서 이 보정치가 실제로 소모되면
// (lib/roll-wrapper.js) 플래그 자체가 지워지므로, 다음에 시트가 다시
// 그려질 때 배지도 자동으로 "적용 안됨"으로 돌아온다 — 따로 끄는 코드가
// 필요 없다.
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  for (const row of getRows()) {
    const moveItem = actor.items.find((i) => i.type === "move" && i.name === row.name);
    if (!moveItem) continue;

    const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
    if (!$item.length) continue;

    const $tags = getOrCreateTagsContainer($item);
    if ($tags.find(".dwauto-self-forward-badge").length) continue;

    const active = isActiveFor(actor, moveItem.name);
    const $badge = $(
      `<a class="tag dwauto-self-forward-badge${active ? " dwauto-self-forward-on" : ""}" title="${game.i18n.localize("DWAUTO.SelfForward.ToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.SelfForward.Active" : "DWAUTO.SelfForward.Inactive")}</a>`
    );
    $tags.append($badge);

    if (!game.user.isGM) continue;
    $badge.on("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await toggleSelfForward(actor, row, moveItem.name);
    });
  }
}

// v0.44.0에서 Unforgettable Face/Usurper가 추가됐다. 이미 이 표를 저장해둔
// GM(설정 화면을 한 번이라도 열고 저장한 경우)에게는 새 기본값이 자동
// 반영되지 않으므로, 다른 표들과 같은 패턴으로 누락된 행만 채워 넣는다.
async function migrateAddSurveyedDefaults() {
  if (!game.user.isGM) return;

  const rows = getRows();
  const existingNames = new Set(rows.map((r) => r.name));

  let nameMap = null;
  try {
    nameMap = await getMoveNameMap();
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 이름으로는 추가한다.
  }

  const toAdd = [];
  for (const row of DEFAULT_SELF_FORWARD_MOVES) {
    if (existingNames.has(row.name)) continue;

    const translatedName = nameMap?.get(row.name);
    if (translatedName && existingNames.has(translatedName)) continue;

    toAdd.push(translatedName ? { ...row, name: translatedName } : row);
  }

  if (toAdd.length === 0) return;

  await game.settings.set(MODULE_ID, SETTINGS.SELF_FORWARD_MOVES, [...rows, ...toAdd]);
  console.log(
    `${MODULE_ID} | self-forward: added ${toAdd.length} newly-surveyed default(s)`,
    toAdd.map((r) => r.name)
  );
}

export function registerSelfForwardAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.once("ready", () => {
    migrateAddSurveyedDefaults();
  });
}
