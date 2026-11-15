import { MODULE_ID, SETTINGS } from "../constants.js";
import { CompatDialog } from "../lib/dialogs.js";
import { activeGM, queryUser, registerQuery } from "../lib/gm-query.js";
import { setPendingBondBonus, clearPendingBondBonus } from "../lib/bond-roll-bonus.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { setPendingRollBonus } from "../lib/roll-bonus-state.js";
import { getCommandInstinctAmount } from "./command.js";
import { hasEnhancedAid, consumeEnhancedAid } from "./arcane-art.js";
import { filterDisabledNames, isMoveItemDisabled } from "../lib/move-toggles.js";

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
// Command의 본능 보너스는 rollMod로는 반영할 수 없다 — 던전월드 시스템은
// "유대(Bond)" 판정(원조/방해 전용 rollType)에서 item.system.rollMod를 읽지 않는다
// (1.10.0 rolls.js에서도 확인). 예전에는 GM에게 "더해서 입력하라고 알려 달라"는
// 창만 띄웠는데, 0.126.0부터는 lib/bond-roll-bonus.js가 시스템의 판정 실행 함수에
// 끼어들어 이번 유대 판정 공식에 직접 더한다.
//
// 원조/방해 자체의 +1/-2는 "그 사람이 다음에 무슨 판정을 하든" 한 번 적용되고
// 사라지는 보너스라 lib/roll-bonus-state.js(다음 판정 자동 적용 + roll-wrapper.js가
// 소모)에 그대로 얹는다 — 이건 지금 굴리는 이 판정이 아니라 원조/방해를
// "당한" 사람의 미래 판정이므로 그대로 사후 처리다. 대상 액터에 대한 수정
// 권한(Owner)이 없으면(플레이어 서로 다른 캐릭터라 권한이 없는 게 보통이다)
// 접속 중인 GM에게 승인을 구한다 — features/healing.js와 같은 방식(같은
// 소켓 채널을 쓰지만 type 값으로 서로 구분한다).
const pendingDecisions = new Map(); // actor.id -> { targetId, targetName, amount }

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_AID_OR_INTERFERE_ASSISTANT);
}

function splitCommaList(settingKey) {
  const parse = (value) =>
    String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const names = parse(game.settings.get(MODULE_ID, settingKey));
  // 이름 목록이면 설정 기본값(원문 영어 이름)도 항상 포함한다. 번역 자동 채우기가
  // 기본값을 한글로 바꿔 넣어도, 아이템의 원문 이름(flags.babele.originalName)으로
  // 계속 알아볼 수 있게 하기 위해서다. 한글 카드 제목과는 겹치지 않아 해가 없다.
  if (!settingKey.endsWith("Names")) return names;
  const defaults = parse(game.settings.settings.get(`${MODULE_ID}.${settingKey}`)?.default);
  // 직업별 자동화 창에서 끈 액션은 목록에서 뺀다(lib/move-toggles.js)
  return filterDisabledNames([...new Set([...names, ...defaults])]);
}

async function matchesConfiguredNameByTitle(title) {
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

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
async function matchesConfiguredName(title, originalTitle = null) {
  const byTitle = await matchesConfiguredNameByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return await matchesConfiguredNameByTitle(originalTitle);
}

// 바드 친구여 고맙소(A Little Help From My Friends) 원문: "원조에 성공하면
// 자기 자신도 +1 forward를 받는다." — 방해(-2)에는 해당 없이 원조(+1)를
// 실제로 성공시켰을 때만(방해하는 사람에게 걸리는 게 아니라 원조하는 이
// 자신에게) 적용된다.
function findLittleHelpMove(actor) {
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_LITTLE_HELP_ASSISTANT)) return null;
  const names = splitCommaList(SETTINGS.LITTLE_HELP_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && ((names.includes(i.name) || names.includes(i.flags?.babele?.originalName)) && !isMoveItemDisabled(i))) ?? null;
}

// 대상 액터를 고칠 권한이 없을 때 GM에게 보너스를 걸어도 되는지 묻는다(lib/gm-query.js).
async function requestBonusApproval({ target, granterName, amount, source }) {
  const gm = activeGM();
  if (!gm) {
    ui.notifications.warn(game.i18n.format("DWAUTO.AidOrInterfere.NoGmOnline", { name: target.name }));
    return false;
  }
  return !!(await queryUser(gm, "rollBonusPermission", {
    granterName,
    targetActorId: target.id,
    targetName: target.name,
    amount,
    source
  }, false));
}

function formatSigned(amount) {
  return amount >= 0 ? `+${amount}` : `${amount}`;
}

// GM 쪽: 허락 창을 띄우고 고른 결과(true/false)를 돌려준다. 창을 그냥 닫으면 거절.
function promptBonusPermission(data) {
  return new Promise((resolve) => {
  let answered = false;
  // 허락 버튼으로 처리 중이면 창이 닫혀도 거절로 치지 않는다(옛 Dialog는 버튼을 눌러도 close가 불린다)
  let decided = false;
  const respond = (value) => {
    if (answered) return;
    answered = true;
    resolve(value);
  };
  new CompatDialog({
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
          decided = true;
          const target = game.actors.get(data.targetActorId);
          if (target) await setPendingRollBonus(target, data.amount, data.source);
          respond(true);
        }
      },
      no: {
        label: game.i18n.localize("DWAUTO.Healing.PermissionDeny"),
        callback: () => respond(false)
      }
    },
    default: "yes",
    close: () => {
      if (!decided) respond(false);
    }
  }).render(true);
  });
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
    new CompatDialog({
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
// 만족하면 동물의 본능을 이번 유대 판정에 자동으로 더하도록 걸어 둔다
// (lib/bond-roll-bonus.js). 취소해도 굴림 자체는 막지 않는다 —
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

  // 이번 유대 판정(지금 바로 뜨는 시스템의 유대 입력창) 공식에 자동으로 더한다
  setPendingBondBonus(actor, instinctAmount);
  announceInfo(
    actor,
    game.i18n.format("DWAUTO.AidOrInterfere.InstinctAutoApplied", {
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
    const { actor, title, result, originalTitle } = info;
    if (actor.type !== "character") return;

    if (!(await matchesConfiguredName(title, originalTitle))) return;

    // 유대 판정이 아니어서 본능 보너스가 쓰이지 않았다면 여기서 버린다(다음 판정에 새지 않게)
    clearPendingBondBonus(actor);
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

    // 바드 친구여 고맙소: 원조(방해가 아니라)를 실제로 성공시켰을 때만,
    // 자기 자신(actor)에게도 별도로 +1 forward를 건다 — target에게 건
    // 보너스와는 독립적인, actor 자신의 다음 판정용 보너스다.
    if (decision.amount === 1) {
      const littleHelpMove = findLittleHelpMove(actor);
      if (littleHelpMove) {
        await setPendingRollBonus(actor, 1, littleHelpMove.name);
        announceActionApplied(actor, littleHelpMove.name, game.i18n.localize("DWAUTO.AidOrInterfere.LittleHelpApplied"));
      }
    }
  } catch (err) {
    console.error(`${MODULE_ID} | aid-or-interfere: onCreateChatMessage failed`, err);
  }
}

export function registerAidOrInterfereAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  registerQuery("rollBonusPermission", promptBonusPermission);
}
