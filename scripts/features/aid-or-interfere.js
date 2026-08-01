import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { setPendingRollBonus } from "../lib/roll-bonus-state.js";
import { getCommandInstinctBonusForInterference } from "./command.js";

// 던전월드 기본 무브 "원조/방해(Aid or Interfere)" 원문: "유대가 있는 사람을
// 돕거나 방해할 때 +유대로 판정한다. 맞히면(7+) 그 사람의 판정에 +1 또는
// -2(내 선택)를 준다. 7-9면 그것에 더해 스스로도 위험/보복/대가에 노출된다."
// "맞히면"은 7-9/10+ 모두 포함하므로 이 모듈에서도 둘 다 트리거로 삼는다
// (7-9의 "노출" 부분은 서사적 판단이라 자동화하지 않고 채팅에 안내만 남긴다).
//
// 대상을 고르고 원조/방해를 정하는 시점이 굴리기 "전"이라는 게 핵심이다
// (lib/roll-wrapper.js가 이 무브를 굴리기 직전에 promptAidOrInterferePreRoll을
// 부른다) — 그래야 레인저 Command의 "다른 PC가 방해할 때 동물의 본능이 그
// 판정(=지금 이 굴림)에 더해진다"를 실제로 "이번 판정"에 반영할 수 있다.
// 굴린 뒤에야 방해인지 알 수 있다면 이미 끝난 판정에는 보정치를 소급 적용할
// 방법이 없다. 결정 내용(누구를, 얼마를)은 굴리는 순간부터 결과 채팅 카드가
// 생성되는 순간까지만 잠깐 살아있으면 되므로, 액터 플래그가 아니라 이
// 모듈 안의 Map에 액터 id로 잠깐 들고 있는다.
//
// 원조/방해 자체의 +1/-2는 "그 사람이 다음에 무슨 판정을 하든" 한 번 적용되고
// 사라지는 보너스라 lib/roll-bonus-state.js(다음 판정 자동 적용 + roll-wrapper.js가
// 소모)에 그대로 얹는다 — 이건 지금 굴리는 이 판정이 아니라 원조/방해를
// "당한" 사람의 미래 판정이므로 그대로 사후 처리다. 대상 액터에 대한 수정
// 권한(Owner)이 없으면(플레이어 서로 다른 캐릭터라 권한이 없는 게 보통이다)
// 접속 중인 GM에게 승인을 구한다 — features/healing.js와 같은 방식(같은
// 소켓 채널을 쓰지만 type 값으로 서로 구분한다).
const SOCKET_NAME = `module.${MODULE_ID}`;
const pendingApprovals = new Map();
const pendingDecisions = new Map(); // actor.id -> { targetId, targetName, amount }

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

// lib/roll-wrapper.js가 이 무브를 실제로 굴리기 "직전에" 호출한다. 대상과
// 원조/방해 여부를 먼저 확정해서 pendingDecisions에 담아두고(onCreateChatMessage가
// 굴린 뒤 결과를 보고 이어받는다), "방해"를 선택했다면 Command의 본능
// 보너스를 지금 이 판정의 rollMod에 바로 더할 수 있도록 그 값을 반환한다
// (원조를 선택했거나 이 무브가 아니거나 취소했으면 0). 취소해도 굴림 자체는
// 막지 않는다 — 그냥 이번 굴림에는 아무 자동화도 적용되지 않을 뿐이다.
export async function promptAidOrInterferePreRoll(item) {
  if (!isEnabled()) return 0;
  const actor = item.actor;
  if (!actor || actor.type !== "character") return 0;
  if (!(await matchesConfiguredName(item.name))) return 0;

  const target = await promptActorTarget(actor, {
    title: item.name,
    label: game.i18n.localize("DWAUTO.AidOrInterfere.TargetLabel"),
    excludeSelf: true
  });
  if (!target) return 0;

  const amount = await promptAidOrInterfereChoice(item);
  if (amount === null) return 0;

  pendingDecisions.set(actor.id, { targetId: target.id, targetName: target.name, amount });

  // 원문: "다른 PC가 자신을 방해하려 들 때, 동물의 본능이 그 판정에 더해진다."
  // "그 판정"은 방해하는 사람(지금 이 액터)의 판정이므로, 방해를 선택했을
  // 때만 대상(target)의 Command 조건을 조회해서 지금 이 굴림에 반영한다.
  return amount === -2 ? getCommandInstinctBonusForInterference(target) : 0;
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

    if (!(await matchesConfiguredName(title))) return;

    const decision = pendingDecisions.get(actor.id);
    if (!decision) return; // 굴리기 전에 취소했거나, 애초에 이 무브가 아니었다.
    pendingDecisions.delete(actor.id);

    if (result !== "success" && result !== "partial") return; // 6-는 아무 효과 없음 — 결정은 그냥 버려진다.

    const moveItem = findMoveItem(actor, title);
    const target = game.actors.get(decision.targetId);
    if (!target) return;

    const applied = await applyBonus(actor, target, decision.amount);
    if (!applied) {
      ui.notifications.warn(game.i18n.format("DWAUTO.AidOrInterfere.PermissionDenied", { name: target.name }));
      return;
    }

    const detail =
      result === "partial"
        ? game.i18n.format("DWAUTO.AidOrInterfere.AppliedPartial", {
            target: target.name,
            amount: formatSigned(decision.amount)
          })
        : game.i18n.format("DWAUTO.AidOrInterfere.Applied", { target: target.name, amount: formatSigned(decision.amount) });
    announceActionApplied(actor, moveItem?.name ?? title, detail);
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
