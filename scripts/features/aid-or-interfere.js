import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { setPendingRollBonus } from "../lib/roll-bonus-state.js";
import { getCommandInstinctAmount } from "./command.js";
import { hasEnhancedAid, consumeEnhancedAid } from "./arcane-art.js";

// 던전월드 기본 무브 "원조/방해(Aid or Interfere)" 원문: "유대가 있는 사람을
// 돕거나 방해할 때 +유대로 판정한다. 맞히면(7+) 그 사람의 판정에 +1 또는
// -2(내 선택)를 준다. 7-9면 그것에 더해 스스로도 위험/보복/대가에 노출된다."
// "맞히면"은 7-9/10+ 모두 포함하므로 이 모듈에서도 둘 다 트리거로 삼는다
// (7-9의 "노출" 부분은 서사적 판단이라 자동화하지 않고 채팅에 안내만 남긴다).
//
// 대상을 고르고 원조/방해를 정하는 시점이 굴리기 "전"이라는 게 핵심이다
// (lib/roll-wrapper.js가 이 무브를 굴리기 직전에 promptAidOrInterferePreRoll을
// 부른다) — 그래야 레인저 Command의 "다른 PC가 방해할 때 동물의 본능이 그
// 판정(=지금 이 굴림)에 더해진다"는 것을 "이번 판정" 시점에 알 수 있다.
// 결정 내용(누구를, 얼마를)은 굴리는 순간부터 결과 채팅 카드가 생성되는
// 순간까지만 잠깐 살아있으면 되므로, 액터 플래그가 아니라 이 모듈 안의
// Map에 액터 id로 잠깐 들고 있는다.
//
// 다만 Command의 본능 보너스는 rollMod로 자동 반영할 수 없다 — 던전월드
// 시스템 자체의 결함으로, "유대(Bond)" 판정(원조/방해 전용 rollType)은
// item.system.rollMod를 아예 읽지 않는다(features/command.js의
// getCommandInstinctAmount 주석 참고, v1.8.2 rolls.js에서 직접 확인).
// 그래서 이 값은 GM에게 팝업으로 안내하고, GM이 "공지했다"고 확인을 눌러야
// (그래야 GM이 실제로 플레이어에게 알려줄 시간을 확보한다) 비로소 원조/
// 방해 판정(시스템 자체의 유대 입력창)이 진행되도록 막아둔다 — 플레이어가
// 안내를 못 보고 먼저 굴려버리는 걸 방지한다.
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
const pendingInstinctAcks = new Map(); // requestId -> resolve

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

// GM에게 보여줄 팝업 자체를 만드는 부분만 따로 뺐다. onAck은 "GM이 확인
// 눌렀다"는 신호만 전달하면 된다 — 로컬에서 바로 resolve할지, 소켓으로
// 응답을 돌려보낼지는 호출부가 정한다.
function showInstinctReminderDialog({ interfererName, targetName, amount }, onAck) {
  let acked = false;
  const ack = () => {
    if (acked) return;
    acked = true;
    onAck();
  };

  new Dialog({
    title: game.i18n.localize("DWAUTO.AidOrInterfere.InstinctReminderTitle"),
    content: `<p>${game.i18n.format("DWAUTO.AidOrInterfere.InstinctReminderContent", {
      interferer: interfererName,
      target: targetName,
      amount: formatSigned(amount)
    })}</p>`,
    buttons: {
      ok: {
        label: game.i18n.localize("DWAUTO.AidOrInterfere.InstinctReminderAck"),
        callback: ack
      }
    },
    default: "ok",
    close: ack
  }).render(true);
}

// Command의 본능 보너스는 rollMod로 반영이 안 되므로(파일 상단 주석 참고),
// GM에게 팝업으로 "플레이어의 유대 입력창에 직접 더해서 입력하도록
// 공지해달라"고 요청한다. GM이 확인을 누르기 전까지는 원조/방해 판정
// 자체(=시스템의 유대 입력창)가 뜨지 않는다 — 그래야 안내를 놓치고 먼저
// 굴려버리는 일이 없다.
//
// 지금 이 클라이언트가 이미 GM이면(예: GM이 직접 방해 판정을 굴렸거나,
// 방해 주체와 대상이 둘 다 GM 소유 캐릭터인 경우) 소켓으로 요청을 보내봐야
// 소용없다 — Foundry의 모듈 소켓(game.socket.emit)은 서버가 "보낸 사람을
// 제외한" 다른 클라이언트에게만 중계하므로, 받을 다른 GM 클라이언트가
// 없으면 응답이 영영 안 와서 굴림 자체가 멈춰버린다(원조/방해 무브 옆에서
// GM이 스스로 테스트할 때 흔히 걸리는 경우). 이 경우는 소켓을 거치지 않고
// 지금 이 자리에서 바로 팝업을 띄운다. GM이 아니고 접속 중인 GM도 없으면
// 막을 사람이 없으므로 방해하는 플레이어 본인에게라도 안내하고 바로
// 진행한다.
function requestInstinctReminderAck({ interfererName, targetName, amount }) {
  if (game.user.isGM) {
    return new Promise((resolve) => {
      showInstinctReminderDialog({ interfererName, targetName, amount }, resolve);
    });
  }

  return new Promise((resolve) => {
    const gm = findApprovingGM();
    if (!gm) {
      ui.notifications.warn(
        game.i18n.format("DWAUTO.AidOrInterfere.InstinctReminderNoGm", { target: targetName, amount: formatSigned(amount) })
      );
      resolve();
      return;
    }

    const requestId = foundry.utils.randomID();
    pendingInstinctAcks.set(requestId, resolve);

    game.socket.emit(SOCKET_NAME, {
      type: "instinctReminderRequest",
      requestId,
      requesterUserId: game.user.id,
      interfererName,
      targetName,
      amount
    });
  });
}

function promptInstinctReminder(data) {
  showInstinctReminderDialog(data, () => {
    game.socket.emit(SOCKET_NAME, {
      type: "instinctReminderResponse",
      requestId: data.requestId,
      targetUserId: data.requesterUserId
    });
  });
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
    return;
  }
  if (data?.type === "instinctReminderRequest") {
    if (!game.user.isGM) return;
    promptInstinctReminder(data);
    return;
  }
  if (data?.type === "instinctReminderResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingInstinctAcks.get(data.requestId);
    if (resolve) {
      pendingInstinctAcks.delete(data.requestId);
      resolve();
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
// 굴린 뒤 결과를 보고 이어받는다), "방해"를 선택했고 대상이 Command 조건을
// 만족하면 GM에게 안내 팝업을 띄우고 확인을 받을 때까지 기다린다(그 뒤에야
// 이 함수가 끝나서 실제 판정이 진행된다 — rollMod로는 반영이 안 되므로
// 수동 입력을 GM이 챙기게 하는 것). 취소해도 굴림 자체는 막지 않는다 —
// 그냥 이번 굴림에는 아무 자동화도 적용되지 않을 뿐이다.
export async function promptAidOrInterferePreRoll(item) {
  if (!isEnabled()) return;
  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  if (!(await matchesConfiguredName(item.name))) return;

  const target = await promptActorTarget(actor, {
    title: item.name,
    label: game.i18n.localize("DWAUTO.AidOrInterfere.TargetLabel"),
    excludeSelf: true
  });
  if (!target) return;

  const amount = await promptAidOrInterfereChoice(item);
  if (amount === null) return;

  pendingDecisions.set(actor.id, { targetId: target.id, targetName: target.name, amount });

  // 원문: "다른 PC가 자신을 방해하려 들 때, 동물의 본능이 그 판정에 더해진다."
  // "그 판정"은 방해하는 사람(지금 이 액터)의 판정이므로, 방해를 선택했을
  // 때만 대상(target)의 Command 조건을 조회한다.
  if (amount !== -2) return;
  const instinctAmount = getCommandInstinctAmount(target);
  if (!instinctAmount) return;

  await requestInstinctReminderAck({ interfererName: actor.name, targetName: target.name, amount: instinctAmount });
  announceInfo(
    actor,
    game.i18n.format("DWAUTO.AidOrInterfere.InstinctReminderLogged", {
      target: target.name,
      amount: formatSigned(instinctAmount)
    })
  );
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

    // 바드 마법의 곡조(Arcane Art)가 "다음에 누군가 대상을 원조하면 +1이
    // 아니라 +2"를 걸어뒀을 수 있다 — 방해(-2)에는 해당 없이 원조(+1)일
    // 때만, 그리고 딱 한 번만 소비된다.
    let amount = decision.amount;
    if (amount === 1 && hasEnhancedAid(target)) {
      amount = 2;
      await consumeEnhancedAid(target);
    }

    const applied = await applyBonus(actor, target, amount);
    if (!applied) {
      ui.notifications.warn(game.i18n.format("DWAUTO.AidOrInterfere.PermissionDenied", { name: target.name }));
      return;
    }

    const detail =
      result === "partial"
        ? game.i18n.format("DWAUTO.AidOrInterfere.AppliedPartial", {
            target: target.name,
            amount: formatSigned(amount)
          })
        : game.i18n.format("DWAUTO.AidOrInterfere.Applied", { target: target.name, amount: formatSigned(amount) });
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
