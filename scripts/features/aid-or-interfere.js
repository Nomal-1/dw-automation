import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { setPendingRollBonus } from "../lib/roll-bonus-state.js";

// 던전월드 기본 무브 "원조/방해(Aid or Interfere)" 원문: "유대가 있는 사람을
// 돕거나 방해할 때 +유대로 판정한다. 맞히면(7+) 그 사람의 판정에 +1 또는
// -2(내 선택)를 준다. 7-9면 그것에 더해 스스로도 위험/보복/대가에 노출된다."
// "맞히면"은 7-9/10+ 모두 포함하므로 이 모듈에서도 둘 다 트리거로 삼는다
// (7-9의 "노출" 부분은 서사적 판단이라 자동화하지 않고 채팅에 안내만 남긴다).
//
// +1/-2는 "그 사람이 다음에 무슨 판정을 하든" 한 번 적용되고 사라지는
// 보너스라 lib/roll-bonus-state.js(다음 판정 자동 적용 + lib/roll-wrapper.js가
// 소모)에 그대로 얹는다. 대상 액터에 대한 수정 권한(Owner)이 없으면(플레이어
// 서로 다른 캐릭터라 권한이 없는 게 보통이다) 접속 중인 GM에게 승인을
// 구한다 — features/healing.js와 같은 방식(같은 소켓 채널을 쓰지만 type
// 값으로 서로 구분한다).
const SOCKET_NAME = `module.${MODULE_ID}`;
const pendingApprovals = new Map();

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_AID_OR_INTERFERE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.AID_OR_INTERFERE_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Aid or Interfere") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function findApprovingGM() {
  return game.users.find((u) => u.active && u.isGM) ?? null;
}

function requestBonusApproval({ target, granterName, amount, source }) {
  return new Promise((resolve) => {
    const gm = findApprovingGM();
    if (!gm) {
      ui.notifications.warn(game.i18n.format("DWAUTO.AidOrInterfere.NoGmOnline", { name: target.name }));
      resolve(false);
      return;
    }

    const requestId = foundry.utils.randomID();
    pendingApprovals.set(requestId, resolve);

    game.socket.emit(SOCKET_NAME, {
      type: "rollBonusPermissionRequest",
      requestId,
      requesterUserId: game.user.id,
      granterName,
      targetActorId: target.id,
      targetName: target.name,
      amount,
      source
    });
  });
}

function formatSigned(amount) {
  return amount >= 0 ? `+${amount}` : `${amount}`;
}

function promptBonusPermission(data) {
  new Dialog({
    title: game.i18n.localize("DWAUTO.AidOrInterfere.PermissionTitle"),
    content: `<p>${game.i18n.format("DWAUTO.AidOrInterfere.PermissionContent", {
      granter: data.granterName,
      target: data.targetName,
      amount: formatSigned(data.amount)
    })}</p>`,
    buttons: {
      yes: {
        label: game.i18n.localize("DWAUTO.Healing.PermissionAllow"),
        callback: async () => {
          const target = game.actors.get(data.targetActorId);
          if (target) await setPendingRollBonus(target, data.amount, data.source);
          game.socket.emit(SOCKET_NAME, {
            type: "rollBonusPermissionResponse",
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
            type: "rollBonusPermissionResponse",
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

function onSocketEvent(data) {
  if (data?.type === "rollBonusPermissionRequest") {
    if (!game.user.isGM) return;
    promptBonusPermission(data);
    return;
  }
  if (data?.type === "rollBonusPermissionResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingApprovals.get(data.requestId);
    if (resolve) {
      pendingApprovals.delete(data.requestId);
      resolve(data.approved);
    }
  }
}

// target에 대한 수정 권한(Owner)이 있으면 바로 걸고, 없으면 접속 중인 GM에게
// 승인을 구한 뒤 건다. features/healing.js의 applyHealAmount와 같은 구조.
async function applyBonus(granter, target, amount) {
  if (target.isOwner) {
    await setPendingRollBonus(target, amount, granter.name);
    return true;
  }
  return requestBonusApproval({ target, granterName: granter.name, amount, source: granter.name });
}

function promptAidOrInterfereChoice(moveItem) {
  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `<p>${game.i18n.localize("DWAUTO.AidOrInterfere.ChoicePrompt")}</p>`,
      buttons: {
        aid: { label: game.i18n.localize("DWAUTO.AidOrInterfere.Aid"), callback: () => resolve(1) },
        interfere: { label: game.i18n.localize("DWAUTO.AidOrInterfere.Interfere"), callback: () => resolve(-2) }
      },
      default: "aid",
      close: () => resolve(null)
    }).render(true);
  });
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
    if (result !== "success" && result !== "partial") return; // 6-는 아무 효과 없음

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const target = await promptActorTarget(actor, {
      title: moveItem.name,
      label: game.i18n.localize("DWAUTO.AidOrInterfere.TargetLabel"),
      excludeSelf: true
    });
    if (!target) return;

    const amount = await promptAidOrInterfereChoice(moveItem);
    if (amount === null) return;

    const applied = await applyBonus(actor, target, amount);
    if (!applied) {
      ui.notifications.warn(game.i18n.format("DWAUTO.AidOrInterfere.PermissionDenied", { name: target.name }));
      return;
    }

    const detail =
      result === "partial"
        ? game.i18n.format("DWAUTO.AidOrInterfere.AppliedPartial", { target: target.name, amount: formatSigned(amount) })
        : game.i18n.format("DWAUTO.AidOrInterfere.Applied", { target: target.name, amount: formatSigned(amount) });
    announceActionApplied(actor, moveItem.name, detail);
  } catch (err) {
    console.error(`${MODULE_ID} | aid-or-interfere: onCreateChatMessage failed`, err);
  }
}

export function registerAidOrInterfereAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_NAME, onSocketEvent);
  });
}
