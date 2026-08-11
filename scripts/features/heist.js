import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorMultiTarget } from "../lib/actor-target-picker.js";
import { getPendingHeistBonus, setPendingHeistBonus, clearPendingHeistBonus } from "../lib/heist-state.js";

// 도적 고급액션 대도적(Heist) 원문: "무엇을 훔치고 싶은지 말하고 마스터에게
// 질문 4개를 하십시오. 그 대답에 의거하여 행동하면 자신과 일행이 모두 다음
// 판정에 +1을 받습니다." rollType이 없는 서술형 무브라(바바리안 삼손과
// 같은 방식) 무브를 클릭하면 곧바로 처리한다: 자기 자신은 자동으로
// 포함하고, 씬에 있는 다른 플레이어 캐릭터 토큰 중 원하는 만큼을 추가로
// 고르게 한다. 각자에게 "대기 중" 플래그(lib/heist-state.js)를 걸어두고,
// 그 사람의 다음 판정 직전에 "그 대답에 의거한 것인가요?"를 실제로
// 물어본다 — 예/아니오 무엇으로 답하든 그 순간 기회는 사라진다(조건부
// 보너스라 원조/방해의 자동 적용 보너스와는 다른 별도 플래그를 쓴다).
//
// 대상 액터에 수정 권한(Owner)이 없으면(보통 다른 플레이어의 캐릭터) 접속
// 중인 GM에게 승인을 구한다 — features/aid-or-interfere.js의 requestBonusApproval과
// 같은 소켓 패턴이지만, 보정치가 항상 고정(다음 판정에 한해 조건부 +1)이라
// 금액(amount) 없이 대상/출처만 전달하도록 단순화했다.
const SOCKET_NAME = `module.${MODULE_ID}`;
const pendingApprovals = new Map();

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_HEIST_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.HEIST_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Heist") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function findApprovingGM() {
  return game.users.find((u) => u.active && u.isGM) ?? null;
}

function requestGrantApproval(target, source) {
  return new Promise((resolve) => {
    const gm = findApprovingGM();
    if (!gm) {
      ui.notifications.warn(game.i18n.format("DWAUTO.Heist.NoGmOnline", { name: target.name }));
      resolve(false);
      return;
    }

    const requestId = foundry.utils.randomID();
    pendingApprovals.set(requestId, resolve);

    game.socket.emit(SOCKET_NAME, {
      type: "heistGrantRequest",
      requestId,
      requesterUserId: game.user.id,
      targetActorId: target.id,
      targetName: target.name,
      source
    });
  });
}

function promptGrantPermission(data) {
  new Dialog({
    title: game.i18n.localize("DWAUTO.Heist.PermissionTitle"),
    content: `<p>${game.i18n.format("DWAUTO.Heist.PermissionContent", { target: data.targetName })}</p>`,
    buttons: {
      yes: {
        label: game.i18n.localize("DWAUTO.Healing.PermissionAllow"),
        callback: async () => {
          const target = game.actors.get(data.targetActorId);
          if (target) await setPendingHeistBonus(target, data.source);
          game.socket.emit(SOCKET_NAME, {
            type: "heistGrantResponse",
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
            type: "heistGrantResponse",
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
  if (data?.type === "heistGrantRequest") {
    if (!game.user.isGM) return;
    promptGrantPermission(data);
    return;
  }
  if (data?.type === "heistGrantResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingApprovals.get(data.requestId);
    if (resolve) {
      pendingApprovals.delete(data.requestId);
      resolve(data.approved);
    }
  }
}

async function grantTo(target, source) {
  if (target.isOwner) {
    await setPendingHeistBonus(target, source);
    return true;
  }
  return requestGrantApproval(target, source);
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

    const allies = await promptActorMultiTarget(actor, {
      title: moveItem.name,
      label: game.i18n.localize("DWAUTO.Heist.SelectAlliesLabel"),
      excludeSelf: true,
      filter: (a) => a.type === "character"
    });

    const targets = [actor, ...allies];
    const grantedNames = [];
    for (const target of targets) {
      const granted = await grantTo(target, moveItem.name);
      if (granted) grantedNames.push(target.name);
    }

    if (grantedNames.length === 0) return;
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.Heist.Applied", { names: grantedNames.join(", ") })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | heist: onCreateChatMessage failed`, err);
  }
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 대기 중인 기회가 없으면
// 조용히 통과한다. 있으면 무조건 소모하고(예/아니오 관계없이), "그 대답에
// 의거한 것인가요?"를 물어서 "예"일 때만 +1을 준다.
export async function promptHeistPreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { bonus: 0 };

  // 대도적 자신을 다시 발동하는 클릭도 이 판정 훅을 거치므로, 그건 실제
  // "다음 판정"이 아니라 새 기회를 발급하는 행위다 — 대기 중인 기회를
  // 여기서 잘못 소모하지 않도록 제외한다(수련의 자기 제외와 같은 이유).
  if (splitCommaList(SETTINGS.HEIST_MOVE_NAMES).includes(item.name)) return { bonus: 0 };

  const pending = getPendingHeistBonus(actor);
  if (!pending) return { bonus: 0 };
  await clearPendingHeistBonus(actor);

  const confirmed = await Dialog.confirm({
    title: pending.source,
    content: `<p>${game.i18n.localize("DWAUTO.Heist.ConfirmPrompt")}</p>`,
    defaultYes: false
  });
  if (!confirmed) return { bonus: 0 };

  announceActionApplied(actor, pending.source, game.i18n.localize("DWAUTO.Heist.ConfirmedApplied"));
  return { bonus: 1 };
}

export function registerHeistAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_NAME, onSocketEvent);
  });
}
