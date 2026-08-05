import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { DEBILITY_ABILITIES, getDebilityLabel } from "../lib/debilities.js";
import { getBurningRingBond, setBurningRingBond, clearBurningRingBond } from "../lib/burning-ring-state.js";

// 소각술사 고급액션(6레벨 이후) 불로 맺은 언약(Burning Ring Of Fire) 원문:
// "의지가 있는 사람의 영혼을 자신의 것과 융합하면 roll+CHA. 성공(hit,
// 10+)하면 서로 이어져서, 거리와 상관없이 서로를 느낄 수 있고 감정 상태도
// 공유한다. 7-9면 그 연결이 불안정하고 위험해서, 한쪽이 약화를 얻으면
// 상대도 그 약화를 얻는다(반대도 마찬가지). 실패하면 융합이 거부되어 서로의
// 인연이 모두 지워진다."
//
// 안정(10+)은 순수하게 서사적인 효과라 자동화할 게 없다 — 배지로 상태만
// 보여준다. 불안정(7-9)은 약화 전파를 실제로 자동화한다. 실패는 인연을
// 지우는 것까지 자동으로 처리하기엔 위험 부담이 커서(어떤 인연인지 우리가
// 알 방법이 없다) 마스터가 직접 정리하기로 했다 — 이 자동화는 실패를 그냥
// 무시한다.
const SKIP_FLAG = "dwautoSkipBurningRing"; // 우리 자신의 약화 전파 갱신을 다시 가로채지 않기 위함

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_BURNING_RING_OF_FIRE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.BURNING_RING_OF_FIRE_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Burning Ring Of Fire") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function findGM() {
  return game.users.find((u) => u.active && u.isGM) ?? null;
}

const pendingUpdateApprovals = new Map();
const SOCKET_NAME = `module.${MODULE_ID}`;

// features/defend.js의 updateActorSafely와 같은 이유의 같은 패턴 — 결속
// 대상이 다른 플레이어의 캐릭터일 수 있어서, 그쪽에 쓸 권한이 없으면
// 접속 중인 GM에게 대신 적용해달라고 요청한다.
async function updateActorSafely(actor, changes, options = {}) {
  if (actor.isOwner) {
    await actor.update(changes, options);
    return true;
  }

  const gm = findGM();
  if (!gm) {
    console.warn(`${MODULE_ID} | burning-ring-of-fire: no permission on ${actor.name} and no GM online`);
    return false;
  }

  return new Promise((resolve) => {
    const requestId = foundry.utils.randomID();
    pendingUpdateApprovals.set(requestId, resolve);
    game.socket.emit(SOCKET_NAME, {
      type: "burningRingUpdateRequest",
      requestId,
      requesterUserId: game.user.id,
      actorId: actor.id,
      changes,
      options
    });
  });
}

function onSocketEvent(data) {
  if (data?.type === "burningRingUpdateRequest") {
    if (!game.user.isGM) return;
    const actor = game.actors.get(data.actorId);
    const respond = (success) =>
      game.socket.emit(SOCKET_NAME, {
        type: "burningRingUpdateResponse",
        requestId: data.requestId,
        targetUserId: data.requesterUserId,
        success
      });
    if (!actor) {
      respond(false);
      return;
    }
    actor
      .update(data.changes, data.options)
      .then(() => respond(true))
      .catch(() => respond(false));
    return;
  }
  if (data?.type === "burningRingUpdateResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingUpdateApprovals.get(data.requestId);
    if (resolve) {
      pendingUpdateApprovals.delete(data.requestId);
      resolve(data.success);
    }
  }
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, result } = info;
    if (actor.type !== "character") return;
    if (!result || result === "failure") return; // 실패는 마스터가 직접 정리

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const target = await promptActorTarget(actor, {
      title: moveItem.name,
      label: game.i18n.localize("DWAUTO.BurningRingOfFire.TargetLabel"),
      excludeSelf: true,
      filter: (a) => a.type === "character"
    });
    if (!target) return;

    const stability = result === "partial" ? "unstable" : "stable";

    await setBurningRingBond(actor, target.id, target.name, stability);
    await updateActorSafely(target, {
      [`flags.${MODULE_ID}.burningRingBond`]: { partnerActorId: actor.id, partnerName: actor.name, stability }
    });

    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.BurningRingOfFire.Bonded", {
        target: target.name,
        stability:
          stability === "stable"
            ? game.i18n.localize("DWAUTO.BurningRingOfFire.Stable")
            : game.i18n.localize("DWAUTO.BurningRingOfFire.Unstable")
      })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | burning-ring-of-fire: onCreateChatMessage failed`, err);
  }
}

// 결속이 불안정할 때, 한쪽이 약화를 얻으면 상대도 같은 약화를 얻는다(이미
// 갖고 있지 않다면). updateActor는 모든 클라이언트에서 실행되므로, 실제로
// 상대 액터에게 쓸 권한이 있는 클라이언트(대개 GM)만 반응하게 한다 — 판정을
// 시작한 클라이언트로 제한하면(다른 기능들처럼) 그 클라이언트가 상대를
// 소유하지 않은 경우 아무도 반응하지 않게 된다.
async function onUpdateActor(actor, changes, options) {
  if (options[SKIP_FLAG]) return;
  if (game.system.id !== "dungeonworld") return;
  if (!isEnabled()) return;
  if (actor.type !== "character") return;

  const flat = foundry.utils.flattenObject(changes);
  const gainedKeys = DEBILITY_ABILITIES.filter((key) => flat[`system.abilities.${key}.debility`] === true);
  if (gainedKeys.length === 0) return;

  const bond = getBurningRingBond(actor);
  if (!bond || bond.stability !== "unstable") return;

  const partner = game.actors.get(bond.partnerActorId);
  if (!partner || !partner.isOwner) return;

  for (const key of gainedKeys) {
    if (partner.system.abilities?.[key]?.debility) continue; // 상대가 이미 갖고 있으면 건너뛴다(고리 방지 포함)

    await partner.update({ [`system.abilities.${key}.debility`]: true }, { [SKIP_FLAG]: true });
    announceActionApplied(
      partner,
      game.i18n.localize("DWAUTO.BurningRingOfFire.MoveLabel"),
      game.i18n.format("DWAUTO.BurningRingOfFire.DebilityShared", {
        source: actor.name,
        debility: getDebilityLabel(key)
      })
    );
  }
}

function promptSetBondPrompt() {
  // 배지 클릭 시 결속을 지울지 확인만 받는다 — 새로 맺는 건 무브를 다시
  // 발동해야 한다.
  return Dialog.confirm({
    title: game.i18n.localize("DWAUTO.BurningRingOfFire.ClearTitle"),
    content: `<p>${game.i18n.localize("DWAUTO.BurningRingOfFire.ClearContent")}</p>`,
    defaultYes: false
  });
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const names = splitCommaList(SETTINGS.BURNING_RING_OF_FIRE_MOVE_NAMES);
  const moveItem = actor.items.find((i) => i.type === "move" && names.includes(i.name));
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-burning-ring-badge").remove();

  const bond = getBurningRingBond(actor);
  if (!bond) return;

  const stabilityLabel =
    bond.stability === "stable"
      ? game.i18n.localize("DWAUTO.BurningRingOfFire.Stable")
      : game.i18n.localize("DWAUTO.BurningRingOfFire.Unstable");

  const $badge = $(
    `<a class="tag dwauto-burning-ring-badge dwauto-burning-ring-on" title="${game.i18n.localize("DWAUTO.BurningRingOfFire.BadgeTitle")}">${game.i18n.format("DWAUTO.BurningRingOfFire.BadgeLabel", { target: bond.partnerName, stability: stabilityLabel })}</a>`
  );
  $tags.append($badge);

  if (!game.user.isGM) return;
  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = await promptSetBondPrompt();
    if (!confirmed) return;

    await clearBurningRingBond(actor);
    const partner = game.actors.get(bond.partnerActorId);
    if (partner) await updateActorSafely(partner, { [`flags.${MODULE_ID}.-=burningRingBond`]: null });
  });
}

export function registerBurningRingOfFireAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("updateActor", onUpdateActor);
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_NAME, onSocketEvent);
  });
}
