import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";

// Thief Underdog(오기)/Serious Underdog(투지): "숫적으로 열세일 때 장갑
// +N"이라는 조건부 보너스. 실제 원문은 다음과 같다.
//   Underdog: 열세일 때만 +1 장갑(그 외엔 보너스 없음)
//   Serious Underdog: 항상 +1 장갑, 열세일 때는 +1 대신 +2
// "지금 열세인가"는 씬의 적대 토큰 수로 자동 판정할 수 없는 서사적 정보라,
// 액터 플래그로 된 토글로 관리한다: 캐릭터 시트에서 직접 켜고 끌 수 있고,
// "피격 때마다 묻기"가 켜져 있으면 맞을 때마다 hit-trigger.js가 Y/N으로
// 다시 확인해서 상태가 바뀌면 이 토글도 같이 갱신한다.
//
// 이 토글은 armor-assistant.js의 장갑 재계산에 "지금 활성 보정"으로
// 반영되고(Formshaper와 같은 방식), 토글이 실제로 바뀌는 순간에는 재계산을
// 다시 부르는 대신 장갑 수치를 그 자리에서 ±1 직접 조정한다 — 오기든
// 투지든 열세/열세아님 사이의 차이는 항상 정확히 1이기 때문에(오기: 0↔1,
// 투지: 1↔2) 어느 무브인지 몰라도 ±1로 충분하다.
const OUTNUMBERED_FLAG = "underdogOutnumbered";
const ASK_EACH_HIT_FLAG = "underdogAskEachHit";

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_HIT_TRIGGER_ASSISTANT);
}

function getRows() {
  return game.settings.get(MODULE_ID, SETTINGS.DAMAGE_REDUCTION_MOVES);
}

function getOwnedRow(actor) {
  for (const row of getRows()) {
    const move = actor.items.find((i) => i.type === "move" && i.name === row.name);
    if (move) return { row, move };
  }
  return null;
}

export function isOutnumbered(actor) {
  return Boolean(actor.getFlag(MODULE_ID, OUTNUMBERED_FLAG));
}

function shouldAskEachHit(actor) {
  return actor.getFlag(MODULE_ID, ASK_EACH_HIT_FLAG) ?? true;
}

// armor-assistant.js의 장갑 재계산이 호출한다. 지금 열세 토글 상태에 맞는
// 보너스(오기: 0 또는 1, 투지: 1 또는 2)를 돌려준다. 열세가 아니라 보너스가
// 0이어도 "이 무브가 지금 아무것도 안 주고 있다"는 걸 보여주기 위해 그대로
// 반환한다(합계에는 영향 없음).
export function getOutnumberedArmorContribution(actor) {
  if (!isEnabled()) return null;
  const owned = getOwnedRow(actor);
  if (!owned) return null;

  const amount = isOutnumbered(actor) ? owned.row.outnumberedBonus : owned.row.baseBonus;
  return { source: owned.move.name, amount: Number(amount) || 0 };
}

// hit-trigger.js가 피격 훅에서 호출한다. "피격 때마다 묻기"가 꺼져 있으면
// 물어보지 않고 지금 토글 상태를 그대로 유지한다(null 반환).
export function getOutnumberedAskCandidate(actor) {
  if (!isEnabled()) return null;
  const owned = getOwnedRow(actor);
  if (!owned) return null;
  if (!shouldAskEachHit(actor)) return null;
  return { moveName: owned.move.name };
}

// 열세 여부 답(수동 토글 클릭이든, 피격 때마다 묻기의 Y/N 답이든)을
// 반영한다. 실제로 상태가 바뀐 경우에만 장갑을 조정한다 — 같은 답이
// 반복되면(예: 계속 열세 상태) 아무것도 하지 않는다. hit-trigger.js가
// { changed, newArmor }를 보고 "지금 이 피격"의 피해량을 새 장갑 기준으로
// 다시 계산할지 판단한다.
export async function applyOutnumberedAnswer(actor, moveName, nowOutnumbered) {
  const currentArmor = Number(actor.system.attributes?.ac?.value) || 0;
  const wasOutnumbered = isOutnumbered(actor);
  if (wasOutnumbered === nowOutnumbered) return { changed: false, newArmor: currentArmor };

  await actor.setFlag(MODULE_ID, OUTNUMBERED_FLAG, nowOutnumbered);

  const next = Math.max(0, currentArmor + (nowOutnumbered ? 1 : -1));
  await actor.update({ "system.attributes.ac.value": next });

  const messageKey = nowOutnumbered ? "DWAUTO.Underdog.BecameOutnumbered" : "DWAUTO.Underdog.NoLongerOutnumbered";
  announceActionApplied(actor, moveName, game.i18n.format(messageKey, { armor: next }));

  return { changed: true, newArmor: next };
}

function renderBadges(actor, html) {
  const owned = getOwnedRow(actor);
  if (!owned) return;

  const $item = html.find(`.item[data-item-id="${owned.move.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);

  if (!$tags.find(".dwauto-underdog-outnumbered-badge").length) {
    const outnumbered = isOutnumbered(actor);
    const $badge = $(
      `<a class="tag dwauto-underdog-outnumbered-badge${outnumbered ? " dwauto-underdog-on" : ""}" title="${game.i18n.localize("DWAUTO.Underdog.OutnumberedToggleTitle")}">${game.i18n.localize(outnumbered ? "DWAUTO.Underdog.OutnumberedOn" : "DWAUTO.Underdog.OutnumberedOff")}</a>`
    );
    $tags.append($badge);

    $badge.on("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await applyOutnumberedAnswer(actor, owned.move.name, !outnumbered);
    });
  }

  if (!$tags.find(".dwauto-underdog-ask-badge").length) {
    const ask = shouldAskEachHit(actor);
    const $askBadge = $(
      `<a class="tag dwauto-underdog-ask-badge${ask ? " dwauto-underdog-on" : ""}" title="${game.i18n.localize("DWAUTO.Underdog.AskEachHitTitle")}">${game.i18n.localize(ask ? "DWAUTO.Underdog.AskEachHitOn" : "DWAUTO.Underdog.AskEachHitOff")}</a>`
    );
    $tags.append($askBadge);

    $askBadge.on("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await actor.setFlag(MODULE_ID, ASK_EACH_HIT_FLAG, !ask);
    });
  }
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  renderBadges(actor, html);
}

export function registerUnderdogAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
