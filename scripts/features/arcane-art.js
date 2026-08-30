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
// 이계의 음률(Eldritch Tones)/이계의 화음(Eldritch Chord, 이계의 음률의
// 6레벨 상위 무브)을 갖고 있으면 "효과 하나" 대신 "효과 둘까지" 고를 수
// 있다(원문: "당신의 마법의 곡조는 강력해서, 효과 하나 대신 둘을 고를 수
// 있습니다" — 꼭 둘을 다 고를 필요는 없어서 최대 개수로만 다룬다) —
// count를 2로 올리고 선택된 만큼(1개 또는 2개) 순서대로 각각 적용한다.
// 이계의 화음은 추가로 "그 중 하나를 골라 두 배로 적용"할 수 있다(원문:
// "효과 하나를 골라 두 배로 만들 수 있다") — 주사위 개수를 두 배로 굴리는
// 게 아니라, 다른 보조 무브(치유의 노래/치유의 합창, 날카로운 불협화음/
// 폭발음 등)까지 다 반영된 그 효과의 최종 수치를 두 배로 적용한다
// (promptDoubleChoice/applyEffect의 multiplier 참고).
//
// 치유의 노래(Healing Song, +1d8)/치유의 합창(Healing Chorus, 치유의
// 노래의 6레벨 상위 무브, +2d8)은 치유 선택지에, 날카로운 불협화음
// (Vicious Cacophony, +1d4)/날카로운 폭발음(Vicious Blast, 날카로운
// 불협화음의 6레벨 상위 무브, +2d4)은 피해 보너스 선택지에 주사위를 더
// 얹는다(getHealBonusDie/getDamageForwardBonusDie 참고) — 상위 무브를
// 배우면 무브 업그레이드 자동화가 하위 무브를 지우므로 둘 다 갖고 있는
// 경우는 없다고 가정하고 상위 쪽을 우선 확인한다. 이 보조 무브들은 전부
// 마법의 곡조를 강화만 할 뿐이라 별도 사용 스위치 없이
// ENABLE_ARCANE_ART_ASSISTANT 하나로 같이 켜고 끈다.
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

function hasAnyMove(actor, settingKey) {
  const names = splitCommaList(settingKey);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

function hasEldritchTones(actor) {
  return hasAnyMove(actor, SETTINGS.ELDRITCH_TONES_MOVE_NAMES);
}

function hasEldritchChord(actor) {
  return hasAnyMove(actor, SETTINGS.ELDRITCH_CHORD_MOVE_NAMES);
}

function getHealBonusDie(actor) {
  if (hasAnyMove(actor, SETTINGS.HEALING_CHORUS_MOVE_NAMES)) return "+2d8";
  if (hasAnyMove(actor, SETTINGS.HEALING_SONG_MOVE_NAMES)) return "+1d8";
  return "";
}

function getDamageForwardBonusDie(actor) {
  if (hasAnyMove(actor, SETTINGS.VICIOUS_BLAST_MOVE_NAMES)) return "+2d4";
  if (hasAnyMove(actor, SETTINGS.VICIOUS_CACOPHONY_MOVE_NAMES)) return "+1d4";
  return "";
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

async function applyHeal(actor, target, moveItem, optionHtml, multiplier = 1) {
  const baseFormula = extractInlineRoll(optionHtml) || "1d8";
  const formula = `${baseFormula}${getHealBonusDie(actor)}`;
  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game.i18n.format("DWAUTO.ArcaneArt.HealRollFlavor", { name: moveItem.name })
  });

  const finalAmount = roll.total * multiplier;
  if (multiplier > 1) {
    announceInfo(actor, game.i18n.format("DWAUTO.ArcaneArt.DoubledAmount", { amount: finalAmount }));
  }
  await applyHealAmount(actor, target, moveItem.name, finalAmount);
}

async function applyDamageForward(actor, target, moveItem, optionHtml, multiplier = 1) {
  const baseFormula = extractInlineRoll(optionHtml) || "1d4";
  const formula = `${baseFormula}${getDamageForwardBonusDie(actor)}`;
  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game.i18n.format("DWAUTO.ArcaneArt.DamageForwardRollFlavor", { name: moveItem.name })
  });

  const finalAmount = roll.total * multiplier;
  if (multiplier > 1) {
    announceInfo(actor, game.i18n.format("DWAUTO.ArcaneArt.DoubledAmount", { amount: finalAmount }));
  }

  if (target.isOwner) {
    await setPendingDamageForward(target, finalAmount, moveItem.name);
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.ArcaneArt.DamageForwardApplied", { target: target.name, amount: finalAmount })
    );
    return;
  }

  const approved = await requestFlagApproval({
    target,
    granterName: actor.name,
    description: game.i18n.format("DWAUTO.ArcaneArt.DamageForwardDescription", { amount: finalAmount }),
    kind: "damageForward",
    payload: { amount: finalAmount, source: moveItem.name }
  });
  if (approved) {
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.ArcaneArt.DamageForwardApplied", { target: target.name, amount: finalAmount })
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

async function applyEffect(actor, target, moveItem, picked, optionHtml, multiplier = 1) {
  const healIndex = Number(game.settings.get(MODULE_ID, SETTINGS.ARCANE_ART_HEAL_INDEX)) || 0;
  const forwardIndex = Number(game.settings.get(MODULE_ID, SETTINGS.ARCANE_ART_DAMAGE_FORWARD_INDEX)) || 0;
  const enchantIndex = Number(game.settings.get(MODULE_ID, SETTINGS.ARCANE_ART_CLEAR_ENCHANTMENT_INDEX)) || 0;
  const aidIndex = Number(game.settings.get(MODULE_ID, SETTINGS.ARCANE_ART_ENHANCE_AID_INDEX)) || 0;

  if (picked === healIndex) {
    await applyHeal(actor, target, moveItem, optionHtml, multiplier);
  } else if (picked === forwardIndex) {
    await applyDamageForward(actor, target, moveItem, optionHtml, multiplier);
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

// 이계의 화음이 있으면 방금 고른 효과(들) 중 하나를 두 배로 만들지
// 물어본다. selectedOptions는 방금 promptChoiceSelection에서 실제로 고른
// 선택지 텍스트들(1개 또는 2개) — 그대로 라디오 버튼 목록으로 보여주고,
// 맨 끝에 "두 배로 하지 않는다"를 항상 덧붙인다(하나만 골랐어도 그 하나
// + "두 배로 하지 않는다" 총 2개짜리 선택지가 된다). 반환값은
// selectedOptions 안에서의 인덱스(0부터) 또는 아무것도 두 배로 하지
// 않으면 -1.
function promptDoubleChoice(moveName, selectedOptions) {
  return new Promise((resolve) => {
    const optionsHtml =
      selectedOptions
        .map(
          (opt, i) => `
            <div class="form-group dwauto-choice-option">
              <label><input type="radio" name="dwautoDouble" value="${i}"> ${opt}</label>
            </div>
          `
        )
        .join("") +
      `
        <div class="form-group dwauto-choice-option">
          <label><input type="radio" name="dwautoDouble" value="none" checked> ${game.i18n.localize("DWAUTO.ArcaneArt.DoubleNone")}</label>
        </div>
      `;

    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title: moveName,
      content: `<p>${game.i18n.localize("DWAUTO.ArcaneArt.DoublePrompt")}</p><form>${optionsHtml}</form>`,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const value = html.find('[name="dwautoDouble"]:checked').val();
            finish(value === "none" ? -1 : Number(value));
          }
        }
      },
      default: "ok",
      close: () => finish(-1)
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

    const eldritchChord = hasEldritchChord(actor);
    const multiEffect = eldritchChord || hasEldritchTones(actor);
    const choiceCount = multiEffect ? 2 : 1;

    promptChoiceSelection({
      title: moveItem.name,
      instruction: game.i18n.localize(
        multiEffect ? "DWAUTO.ArcaneArt.EffectInstructionTwo" : "DWAUTO.ArcaneArt.EffectInstruction"
      ),
      options: choiceOptions,
      count: choiceCount,
      minCount: multiEffect ? 1 : choiceCount,
      onConfirm: async (selected, indexes) => {
        const doubleLocalIndex = eldritchChord ? await promptDoubleChoice(moveItem.name, selected) : -1;
        for (let i = 0; i < indexes.length; i++) {
          const multiplier = i === doubleLocalIndex ? 2 : 1;
          await applyEffect(actor, target, moveItem, indexes[i], selected[i], multiplier);
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
