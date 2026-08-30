import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { getMoveChoiceData, promptChoiceSelection, extractInlineRoll } from "../lib/move-choices.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { applyHealAmount } from "./healing.js";
import { setPendingDamageForward } from "../lib/damage-forward-state.js";

// 바드 마법의 곡조(Arcane Art) 원문: "음악을 엮어서 마법 효과를 만들 때,
// 아군 한 명과 효과 하나를 고른다: (1) 1d8 피해 치유 (2) 다음번에 가하는
// 피해에 +1d4 (3) 정신에 걸린 마법 하나 해제 (4) 다음에 누군가 대상을
// 원조하면 +1이 아니라 +2. 성공(10+)만 효과가 실제로 적용된다. 부분성공
// (7-9)은 "효과는 발휘되지만 원치 않는 주목을 끌거나 다른 대상에게도
// 영향을 준다"는 서사적 판단이라 GM에게 안내만 남기고 자동화하지 않는다.
//
// 어느 선택지가 어느 효과인지는 텍스트로 판별하면 번역에 깨지므로(Cast a
// Spell 부분성공과 같은 이유) 설정에서 숫자(순번)로 지정한다 — 던전월드
// 기본 순서(치유/피해보너스/마법해제/원조강화)를 기본값으로 쓴다.
//
// 이계의 음률(Eldritch Tones)을 갖고 있으면 "효과 하나" 대신 "효과 둘"을
// 고를 수 있다(원문: "당신의 마법의 곡조는 강력해서, 효과 하나 대신 둘을
// 고를 수 있습니다") — count를 2로 올리고 선택된 둘을 순서대로 각각
// 적용한다. 치유의 노래(Healing Song)/날카로운 불협화음(Vicious Cacophony)는
// 각각 치유·피해보너스 선택지에 주사위를 더 얹는 보조 무브다(applyHeal/
// applyDamageForward 참고). 셋 다 마법의 곡조를 강화하는 보조 무브라 별도
// 사용 스위치 없이 ENABLE_ARCANE_ART_ASSISTANT 하나로 같이 켜고 끈다.
//
// (2) 피해 보너스는 lib/damage-forward-state.js(다음 데미지 굴림 자동 적용,
// features/attack-assistant.js가 소모)에 얹는다. (4) 원조 강화는 이 파일이
// 관리하는 플래그를 features/aid-or-interfere.js가 읽어서 "원조" 선택 시
// +1 대신 +2를 걸도록 소비한다. (1) 치유는 features/healing.js의
// applyHealAmount를 그대로 재사용한다(권한 없는 대상이면 GM 승인까지 이미
// 처리해준다). (2)/(4)처럼 이 파일이 직접 다른 액터에 플래그를 거는
// 경우에도 같은 권한 문제가 있어서, 아래에 자체 소켓 승인 절차를 둔다
// (features/healing.js·aid-or-interfere.js와 같은 패턴 — 소켓 채널은
// 공유하되 type으로 구분).
const SOCKET_NAME = `module.${MODULE_ID}`;
const pendingFlagApprovals = new Map();
const ENHANCED_AID_FLAG = "arcaneArtEnhancedAid"; // { source: string } | undefined

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_ARCANE_ART_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.ARCANE_ART_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Arcane Art") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function hasEldritchTones(actor) {
  const names = splitCommaList(SETTINGS.ELDRITCH_TONES_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

function hasHealingSong(actor) {
  const names = splitCommaList(SETTINGS.HEALING_SONG_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

function hasViciousCacophony(actor) {
  const names = splitCommaList(SETTINGS.VICIOUS_CACOPHONY_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

// features/aid-or-interfere.js가 "원조"를 적용하기 직전에 재사용한다.
export function hasEnhancedAid(actor) {
  return Boolean(actor.getFlag(MODULE_ID, ENHANCED_AID_FLAG));
}

export async function consumeEnhancedAid(actor) {
  await actor.unsetFlag(MODULE_ID, ENHANCED_AID_FLAG);
}

async function setEnhancedAidRaw(target, source) {
  await target.setFlag(MODULE_ID, ENHANCED_AID_FLAG, { source });
}

function findApprovingGM() {
  return game.users.find((u) => u.active && u.isGM) ?? null;
}

async function applyFlagByKind(kind, target, payload) {
  if (kind === "damageForward") await setPendingDamageForward(target, payload.amount, payload.source);
  else if (kind === "enhancedAid") await setEnhancedAidRaw(target, payload.source);
}

function promptFlagPermission(data, callback) {
  new Dialog({
    title: game.i18n.localize("DWAUTO.ArcaneArt.FlagPermissionTitle"),
    content: `<p>${game.i18n.format("DWAUTO.ArcaneArt.FlagPermissionContent", {
      granter: data.granterName,
      target: data.targetName,
      description: data.description
    })}</p>`,
    buttons: {
      yes: { label: game.i18n.localize("DWAUTO.Healing.PermissionAllow"), callback: () => callback(true) },
      no: { label: game.i18n.localize("DWAUTO.Healing.PermissionDeny"), callback: () => callback(false) }
    },
    default: "yes"
  }).render(true);
}

// target에 대한 수정 권한이 없을 때 GM에게 위임한다. kind로 "damageForward"
// (피해 보너스 플래그)/"enhancedAid"(원조 강화 플래그) 중 뭘 걸어야 하는지
// 구분한다 — 실제 setFlag는 항상 권한이 있는 쪽(GM의 클라이언트, 또는 지금
// 클라이언트가 이미 GM이면 바로 이 자리)에서 수행한다. 지금 클라이언트가
// 이미 GM이면 소켓 왕복 없이 로컬에서 바로 묻는다(features/
// aid-or-interfere.js에서 확인된 것과 같은 이유 — 모듈 소켓은 보낸 사람
// 본인에게는 돌아오지 않아 그 경우 영영 응답이 안 온다).
function requestFlagApproval({ target, granterName, description, kind, payload }) {
  if (game.user.isGM) {
    return new Promise((resolve) => {
      promptFlagPermission({ granterName, targetName: target.name, description }, async (approved) => {
        if (approved) await applyFlagByKind(kind, target, payload);
        resolve(approved);
      });
    });
  }

  return new Promise((resolve) => {
    const gm = findApprovingGM();
    if (!gm) {
      ui.notifications.warn(game.i18n.format("DWAUTO.ArcaneArt.NoGmOnline", { name: target.name }));
      resolve(false);
      return;
    }

    const requestId = foundry.utils.randomID();
    pendingFlagApprovals.set(requestId, resolve);

    game.socket.emit(SOCKET_NAME, {
      type: "arcaneArtFlagPermissionRequest",
      requestId,
      requesterUserId: game.user.id,
      granterName,
      targetActorId: target.id,
      targetName: target.name,
      description,
      kind,
      payload
    });
  });
}

function onSocketEvent(data) {
  if (data?.type === "arcaneArtFlagPermissionRequest") {
    if (!game.user.isGM) return;
    const target = game.actors.get(data.targetActorId);
    promptFlagPermission(data, async (approved) => {
      if (approved && target) await applyFlagByKind(data.kind, target, data.payload);
      game.socket.emit(SOCKET_NAME, {
        type: "arcaneArtFlagPermissionResponse",
        requestId: data.requestId,
        targetUserId: data.requesterUserId,
        approved
      });
    });
    return;
  }
  if (data?.type === "arcaneArtFlagPermissionResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingFlagApprovals.get(data.requestId);
    if (resolve) {
      pendingFlagApprovals.delete(data.requestId);
      resolve(data.approved);
    }
  }
}

async function applyHeal(actor, target, moveItem, optionHtml) {
  const baseFormula = extractInlineRoll(optionHtml) || "1d8";
  const formula = hasHealingSong(actor) ? `${baseFormula}+1d8` : baseFormula;
  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game.i18n.format("DWAUTO.ArcaneArt.HealRollFlavor", { name: moveItem.name })
  });
  await applyHealAmount(actor, target, moveItem.name, roll.total);
}

async function applyDamageForward(actor, target, moveItem, optionHtml) {
  const baseFormula = extractInlineRoll(optionHtml) || "1d4";
  const formula = hasViciousCacophony(actor) ? `${baseFormula}+1d4` : baseFormula;
  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game.i18n.format("DWAUTO.ArcaneArt.DamageForwardRollFlavor", { name: moveItem.name })
  });

  if (target.isOwner) {
    await setPendingDamageForward(target, roll.total, moveItem.name);
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.ArcaneArt.DamageForwardApplied", { target: target.name, amount: roll.total })
    );
    return;
  }

  const approved = await requestFlagApproval({
    target,
    granterName: actor.name,
    description: game.i18n.format("DWAUTO.ArcaneArt.DamageForwardDescription", { amount: roll.total }),
    kind: "damageForward",
    payload: { amount: roll.total, source: moveItem.name }
  });
  if (approved) {
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.ArcaneArt.DamageForwardApplied", { target: target.name, amount: roll.total })
    );
  } else {
    ui.notifications.warn(game.i18n.format("DWAUTO.ArcaneArt.PermissionDenied", { name: target.name }));
  }
}

async function applyEnhanceAid(actor, target, moveItem) {
  if (target.isOwner) {
    await setEnhancedAidRaw(target, actor.name);
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.ArcaneArt.AidEnhanced", { target: target.name }));
    return;
  }

  const approved = await requestFlagApproval({
    target,
    granterName: actor.name,
    description: game.i18n.localize("DWAUTO.ArcaneArt.AidEnhanceDescription"),
    kind: "enhancedAid",
    payload: { source: actor.name }
  });
  if (approved) {
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.ArcaneArt.AidEnhanced", { target: target.name }));
  } else {
    ui.notifications.warn(game.i18n.format("DWAUTO.ArcaneArt.PermissionDenied", { name: target.name }));
  }
}

async function applyEffect(actor, target, moveItem, picked, optionHtml) {
  const healIndex = Number(game.settings.get(MODULE_ID, SETTINGS.ARCANE_ART_HEAL_INDEX)) || 0;
  const forwardIndex = Number(game.settings.get(MODULE_ID, SETTINGS.ARCANE_ART_DAMAGE_FORWARD_INDEX)) || 0;
  const enchantIndex = Number(game.settings.get(MODULE_ID, SETTINGS.ARCANE_ART_CLEAR_ENCHANTMENT_INDEX)) || 0;
  const aidIndex = Number(game.settings.get(MODULE_ID, SETTINGS.ARCANE_ART_ENHANCE_AID_INDEX)) || 0;

  if (picked === healIndex) {
    await applyHeal(actor, target, moveItem, optionHtml);
  } else if (picked === forwardIndex) {
    await applyDamageForward(actor, target, moveItem, optionHtml);
  } else if (picked === enchantIndex) {
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.ArcaneArt.EnchantmentCleared", { target: target.name })
    );
  } else if (picked === aidIndex) {
    await applyEnhanceAid(actor, target, moveItem);
  } else {
    // 설정 인덱스가 실제 선택지 개수와 안 맞는 등 알 수 없는 경우 — 그냥
    // 무엇을 골랐는지만 채팅에 남긴다.
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.ArcaneArt.AppliedUnknown", { target: target.name }));
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

    if (!(await matchesConfiguredName(title))) return;
    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    // 원문: "Your spell still works" — 7-9도 효과 자체는 그대로 적용되고,
    // 거기에 "원치 않는 주목을 끌거나 다른 대상에게도 영향을 준다"는
    // 서사적 덤이 붙을 뿐이다(그 덤은 GM이 정하는 것이라 자동화하지 않고
    // 안내만 남긴다). 그래서 6-만 제외하고 성공/부분성공 둘 다 아군+효과
    // 선택 흐름을 그대로 탄다.
    if (result !== "success" && result !== "partial") return;

    const { options: choiceOptions } = getMoveChoiceData(moveItem, "success");
    if (choiceOptions.length === 0) return;

    const target = await promptActorTarget(actor, {
      title: moveItem.name,
      label: game.i18n.localize("DWAUTO.ArcaneArt.TargetLabel"),
      excludeSelf: true
    });
    if (!target) return;

    const eldritchTones = hasEldritchTones(actor);
    const choiceCount = eldritchTones ? 2 : 1;

    promptChoiceSelection({
      title: moveItem.name,
      instruction: game.i18n.localize(
        eldritchTones ? "DWAUTO.ArcaneArt.EffectInstructionTwo" : "DWAUTO.ArcaneArt.EffectInstruction"
      ),
      options: choiceOptions,
      count: choiceCount,
      minCount: eldritchTones ? 1 : choiceCount,
      onConfirm: async (selected, indexes) => {
        for (let i = 0; i < indexes.length; i++) {
          await applyEffect(actor, target, moveItem, indexes[i], selected[i]);
        }
        if (result === "partial") {
          announceInfo(actor, game.i18n.localize("DWAUTO.ArcaneArt.PartialNotice"));
        }
      }
    });
  } catch (err) {
    console.error(`${MODULE_ID} | arcane-art: onCreateChatMessage failed`, err);
  }
}

export function registerArcaneArtAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_NAME, onSocketEvent);
  });
}
