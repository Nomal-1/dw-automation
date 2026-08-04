import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { getKnowItAllPending, setKnowItAllPending, clearKnowItAllPending } from "../lib/know-it-all-state.js";

// 위저드 Know-It-All 원문: "다른 플레이어의 캐릭터가 조언을 구하러 오고
// 당신이 최선이라 생각하는 걸 말해주면, 그들이 그 조언을 따를 때 +1
// forward를 받고, 그들이 그러면 당신은 경험치를 마크한다."
//
// "조언을 따랐는지"는 원조/방해의 대상 보정치(다음 판정 아무거나에 적용)와
// 달리 매번 판단이 필요하다 — features/i-am-the-law.js와 완전히 같은 방식
// (대기 상태 + 다음 판정마다 확인)으로 처리하되, 대기 상태는 조언을 받은
// 대상 액터에 저장한다(그 대상이 판정을 하는 쪽이므로). 대상을 고르고
// 대기 상태를 거는 시점(onCreateChatMessage)과 그 대상의 다음 판정에서
// 실제로 확인/소비하는 시점(promptKnowItAllPreRoll, lib/roll-wrapper.js가
// 호출) 둘 다 대상 액터에 대한 쓰기 권한이 없을 수 있어(플레이어가 서로
// 다른 캐릭터), features/aid-or-interfere.js와 같은 방식으로 접속 중인
// GM에게 승인을 구한다. 조언한 위저드의 XP 마크도 마찬가지로 그 위저드
// 액터에 대한 쓰기 권한이 없을 수 있어 같은 방식을 한 번 더 쓴다.
const SOCKET_NAME = `module.${MODULE_ID}`;
const pendingGrantApprovals = new Map(); // requestId -> resolve
const pendingXpApprovals = new Map(); // requestId -> resolve

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_KNOW_IT_ALL_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.KNOW_IT_ALL_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Know-It-All") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function findApprovingGM() {
  return game.users.find((u) => u.active && u.isGM) ?? null;
}

function requestGrantApproval({ target, grantorActorId, grantorName }) {
  return new Promise((resolve) => {
    const gm = findApprovingGM();
    if (!gm) {
      ui.notifications.warn(game.i18n.format("DWAUTO.KnowItAll.NoGmOnline", { name: target.name }));
      resolve(false);
      return;
    }

    const requestId = foundry.utils.randomID();
    pendingGrantApprovals.set(requestId, resolve);

    game.socket.emit(SOCKET_NAME, {
      type: "knowItAllGrantRequest",
      requestId,
      requesterUserId: game.user.id,
      grantorActorId,
      grantorName,
      targetActorId: target.id,
      targetName: target.name
    });
  });
}

function promptGrantPermission(data) {
  new Dialog({
    title: game.i18n.localize("DWAUTO.KnowItAll.GrantPermissionTitle"),
    content: `<p>${game.i18n.format("DWAUTO.KnowItAll.GrantPermissionContent", {
      grantor: data.grantorName,
      target: data.targetName
    })}</p>`,
    buttons: {
      yes: {
        label: game.i18n.localize("DWAUTO.Healing.PermissionAllow"),
        callback: async () => {
          const target = game.actors.get(data.targetActorId);
          if (target) await setKnowItAllPending(target, data.grantorActorId, data.grantorName);
          game.socket.emit(SOCKET_NAME, {
            type: "knowItAllGrantResponse",
            requestId: data.requestId,
            targetUserId: data.requesterUserId,
            approved: true
          });
        }
      },
      no: {
        label: game.i18n.localize("DWAUTO.Healing.PermissionDeny"),
        callback: () => {
          game.socket.emit(SOCKET_NAME, {
            type: "knowItAllGrantResponse",
            requestId: data.requestId,
            targetUserId: data.requesterUserId,
            approved: false
          });
        }
      }
    },
    default: "yes"
  }).render(true);
}

// target에 대한 수정 권한(Owner)이 있으면 바로 걸고, 없으면 접속 중인 GM에게
// 승인을 구한다.
async function grantPending(grantor, target) {
  if (target.isOwner) {
    await setKnowItAllPending(target, grantor.id, grantor.name);
    return true;
  }
  return requestGrantApproval({ target, grantorActorId: grantor.id, grantorName: grantor.name });
}

async function addXp(actor) {
  if (!actor.system?.attributes?.xp) return;
  const xp = Number(actor.system.attributes.xp.value) || 0;
  await actor.update({ "system.attributes.xp.value": xp + 1 });
  announceInfo(actor, game.i18n.localize("DWAUTO.KnowItAll.XpMarked"));
}

function requestXpApproval({ grantorActorId, grantorName }) {
  return new Promise((resolve) => {
    const gm = findApprovingGM();
    if (!gm) {
      ui.notifications.warn(game.i18n.format("DWAUTO.KnowItAll.XpNoGm", { name: grantorName }));
      resolve(false);
      return;
    }

    const requestId = foundry.utils.randomID();
    pendingXpApprovals.set(requestId, resolve);

    game.socket.emit(SOCKET_NAME, {
      type: "knowItAllXpRequest",
      requestId,
      requesterUserId: game.user.id,
      grantorActorId,
      grantorName
    });
  });
}

function promptXpPermission(data) {
  new Dialog({
    title: game.i18n.localize("DWAUTO.KnowItAll.XpPermissionTitle"),
    content: `<p>${game.i18n.format("DWAUTO.KnowItAll.XpPermissionContent", { name: data.grantorName })}</p>`,
    buttons: {
      yes: {
        label: game.i18n.localize("DWAUTO.Healing.PermissionAllow"),
        callback: async () => {
          const grantor = game.actors.get(data.grantorActorId);
          if (grantor) await addXp(grantor);
          game.socket.emit(SOCKET_NAME, {
            type: "knowItAllXpResponse",
            requestId: data.requestId,
            targetUserId: data.requesterUserId,
            approved: true
          });
        }
      },
      no: {
        label: game.i18n.localize("DWAUTO.Healing.PermissionDeny"),
        callback: () => {
          game.socket.emit(SOCKET_NAME, {
            type: "knowItAllXpResponse",
            requestId: data.requestId,
            targetUserId: data.requesterUserId,
            approved: false
          });
        }
      }
    },
    default: "yes"
  }).render(true);
}

async function markExperience(grantorActorId, grantorName) {
  const grantor = game.actors.get(grantorActorId);
  if (!grantor) return;

  if (grantor.isOwner) {
    await addXp(grantor);
    return;
  }
  await requestXpApproval({ grantorActorId, grantorName });
}

function onSocketEvent(data) {
  if (data?.type === "knowItAllGrantRequest") {
    if (!game.user.isGM) return;
    promptGrantPermission(data);
    return;
  }
  if (data?.type === "knowItAllGrantResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingGrantApprovals.get(data.requestId);
    if (resolve) {
      pendingGrantApprovals.delete(data.requestId);
      resolve(data.approved);
    }
    return;
  }
  if (data?.type === "knowItAllXpRequest") {
    if (!game.user.isGM) return;
    promptXpPermission(data);
    return;
  }
  if (data?.type === "knowItAllXpResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingXpApprovals.get(data.requestId);
    if (resolve) {
      pendingXpApprovals.delete(data.requestId);
      resolve(data.approved);
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
    const { actor, title } = info;
    if (actor.type !== "character") return;

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const target = await promptActorTarget(actor, {
      title: moveItem.name,
      label: game.i18n.localize("DWAUTO.KnowItAll.TargetLabel"),
      excludeSelf: true,
      filter: (a) => a.type === "character"
    });
    if (!target) return;

    const granted = await grantPending(actor, target);
    if (!granted) {
      ui.notifications.warn(game.i18n.format("DWAUTO.KnowItAll.PermissionDenied", { name: target.name }));
      return;
    }

    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.KnowItAll.Granted", { target: target.name }));
  } catch (err) {
    console.error(`${MODULE_ID} | know-it-all: onCreateChatMessage failed`, err);
  }
}

// lib/roll-wrapper.js가 액터가 굴리는 모든 판정 전에 호출한다. 대기 중인
// 조언이 없으면 즉시 통과, 있으면 "이 판정이 그 조언을 따른 것입니까?"를
// 물어서 "예"면 이번 판정에 +1을 얹고 대기를 풀며 조언한 위저드의 XP를
// 마크한다. "아니오"면 보정치를 그대로 아껴두고 판정은 평소대로 진행한다.
export async function promptKnowItAllPreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor) return { bonus: 0 };

  const pending = getKnowItAllPending(actor);
  if (!pending) return { bonus: 0 };

  const confirmed = await Dialog.confirm({
    title: pending.grantorName,
    content: `<p>${game.i18n.format("DWAUTO.KnowItAll.TargetPrompt", { name: pending.grantorName })}</p>`,
    defaultYes: false
  });
  if (!confirmed) return { bonus: 0 };

  await clearKnowItAllPending(actor);
  announceActionApplied(actor, pending.grantorName, game.i18n.localize("DWAUTO.KnowItAll.TargetApplied"));
  await markExperience(pending.grantorActorId, pending.grantorName);
  return { bonus: 1 };
}

export function registerKnowItAllAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_NAME, onSocketEvent);
  });
}
