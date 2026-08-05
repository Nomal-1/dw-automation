import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";
import { findDecidingUser } from "../lib/deciding-user.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import {
  getDefendReserve,
  setDefendReserve,
  getDefendProtectedActorId,
  setDefendProtectedActor,
  clearDefendState
} from "../lib/defend-state.js";
import {
  getDefendVengeancePending,
  setDefendVengeancePending,
  clearDefendVengeancePending
} from "../lib/defend-vengeance-state.js";

// 기본액션 방어(Defend) 원문(공식 컴펜디엄 기준, 이 세계관에서 재구성한
// 버전): "누군가/무언가를 지키고 서 있다가 공격받으면 roll+CON. 10+면
// hold 3, 7-9면 hold 1을 얻는다. 방어 태세를 유지하는 동안, 자신이나 지키는
// 대상이 공격받을 때마다 hold를 1점씩 써서 [자신이 대신 맞기 / 피해를 반으로
// 줄이기 / 공격자에게 빈틈을 만들어 아군에게 +1 forward / 자기 레벨만큼
// 반격] 중 하나를 고를 수 있다." 이 모듈은 여기에 "지금은 안 씀"과 "태세
// 해제하고 hold 반납" 두 선택지를 더해 자동화한다.
//
// hold(예비)와 보호대상은 숫자·문자열 단일 값이라 액터당 하나만 유지한다
// (lib/defend-state.js). 방어를 다시 굴리면(이미 예비가 있어도) 항상 통째로
// 덮어쓴다 — 새 판정 결과와 새 보호대상으로 다시 시작한다는 뜻.
//
// "공격자에게 빈틈을 만들어 아군에게 +1 forward" 선택지는 이 자동화가
// 실제 공격자가 누구인지 알 방법이 없어서(시스템이 공격자 액터 정보를
// 넘겨주지 않는다), 위저드 만물박사(features/know-it-all.js)와 완전히
// 같은 방식으로 처리한다: "누가 공격당했는지"(피격자 이름)만 저장해두고
// 지정한 아군의 다음 판정마다 "그 공격자에 대한 판정입니까?"를 직접
// 물어서 사람이 확인한다.
const SOCKET_NAME = `module.${MODULE_ID}`;
const HIT_TRIGGER_SKIP_FLAG = "dwautoSkipHitTrigger"; // features/hit-trigger.js와 같은 값 — 서로의 후속 갱신을 다시 가로채지 않기 위함
const SKIP_FLAG = "dwautoSkipDefend";

const pendingVengeanceApprovals = new Map(); // requestId -> resolve
const pendingUpdateApprovals = new Map(); // requestId -> resolve

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_DEFEND_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findMoveByConfiguredNames(actor) {
  const names = splitCommaList(SETTINGS.DEFEND_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.DEFEND_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Defend") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function findGM() {
  return game.users.find((u) => u.active && u.isGM) ?? null;
}

// actor에 쓰기 권한이 없으면(방어자와 피격자가 서로 다른 플레이어의
// 캐릭터인 경우가 흔하다) 접속 중인 GM에게 대신 적용해달라고 요청한다.
// aid-or-interfere.js/know-it-all.js와 같은 이유의 같은 패턴을, 이 파일
// 안에서 필요한 모든 갱신(피해 재적용/hold 소모/반격 등)에 공용으로 쓴다.
async function updateActorSafely(actor, changes, options = {}) {
  if (actor.isOwner) {
    await actor.update(changes, options);
    return true;
  }

  const gm = findGM();
  if (!gm) {
    ui.notifications.warn(game.i18n.format("DWAUTO.Defend.NoGmOnlineUpdate", { name: actor.name }));
    return false;
  }

  return new Promise((resolve) => {
    const requestId = foundry.utils.randomID();
    pendingUpdateApprovals.set(requestId, resolve);
    game.socket.emit(SOCKET_NAME, {
      type: "defendUpdateRequest",
      requestId,
      requesterUserId: game.user.id,
      actorId: actor.id,
      changes,
      options
    });
  });
}

async function setReserveSafely(actor, value) {
  const clamped = Math.max(0, Math.floor(Number(value) || 0));
  await updateActorSafely(actor, { [`flags.${MODULE_ID}.defendReserve`]: clamped });
}

async function clearDefendStateSafely(actor) {
  await updateActorSafely(actor, {
    [`flags.${MODULE_ID}.defendReserve`]: 0,
    [`flags.${MODULE_ID}.defendProtectedActorId`]: null
  });
}

function requestVengeanceGrantApproval({ ally, victimName, defenderActorId, defenderName }) {
  return new Promise((resolve) => {
    const gm = findGM();
    if (!gm) {
      ui.notifications.warn(game.i18n.format("DWAUTO.Defend.NoGmOnline", { name: ally.name }));
      resolve(false);
      return;
    }

    const requestId = foundry.utils.randomID();
    pendingVengeanceApprovals.set(requestId, resolve);

    game.socket.emit(SOCKET_NAME, {
      type: "defendVengeanceGrantRequest",
      requestId,
      requesterUserId: game.user.id,
      allyActorId: ally.id,
      allyName: ally.name,
      victimName,
      defenderActorId,
      defenderName
    });
  });
}

function promptVengeanceGrantPermission(data) {
  new Dialog({
    title: game.i18n.localize("DWAUTO.Defend.VengeanceGrantPermissionTitle"),
    content: `<p>${game.i18n.format("DWAUTO.Defend.VengeanceGrantPermissionContent", {
      defender: data.defenderName,
      ally: data.allyName,
      victim: data.victimName
    })}</p>`,
    buttons: {
      yes: {
        label: game.i18n.localize("DWAUTO.Healing.PermissionAllow"),
        callback: async () => {
          const ally = game.actors.get(data.allyActorId);
          if (ally) await setDefendVengeancePending(ally, data.victimName, data.defenderActorId, data.defenderName);
          game.socket.emit(SOCKET_NAME, {
            type: "defendVengeanceGrantResponse",
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
            type: "defendVengeanceGrantResponse",
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

async function grantVengeancePending(ally, victimName, defenderActorId, defenderName) {
  if (ally.isOwner) {
    await setDefendVengeancePending(ally, victimName, defenderActorId, defenderName);
    return true;
  }
  return requestVengeanceGrantApproval({ ally, victimName, defenderActorId, defenderName });
}

function promptProtectTarget(actor, moveItem) {
  return promptActorTarget(actor, {
    title: moveItem.name,
    label: game.i18n.localize("DWAUTO.Defend.ProtectTargetLabel"),
    excludeSelf: false,
    selfLabel: game.i18n.localize("DWAUTO.Defend.SelfLabel")
  });
}

// 방어를 굴릴 때마다(이미 예비가 있어도) 항상 기존 예비/보호대상을 버리고
// 이번 판정 결과로 새로 시작한다. 실패하면(hold 0) 보호대상은 묻지 않는다.
async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, result } = info;
    if (actor.type !== "character") return;
    if (!result) return;

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    await clearDefendState(actor);

    const amount = result === "success" ? 3 : result === "partial" ? 1 : 0;
    if (amount === 0) {
      announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.Defend.FailedNoReserve"));
      return;
    }

    await setDefendReserve(actor, amount);

    const target = await promptProtectTarget(actor, moveItem);
    const protectedActor = target ?? actor;
    await setDefendProtectedActor(actor, protectedActor.id);

    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.Defend.ReserveGained", { amount, target: protectedActor.name })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | defend: onCreateChatMessage failed`, err);
  }
}

function promptDefendChoice(defender, victim, damage, reserve, isSelfHit, moveLabel) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const choices = [
      { value: "none", label: game.i18n.localize("DWAUTO.Defend.ChoiceNone") },
      { value: "release", label: game.i18n.localize("DWAUTO.Defend.ChoiceRelease") }
    ];
    if (!isSelfHit) {
      choices.push({ value: "redirect", label: game.i18n.localize("DWAUTO.Defend.ChoiceRedirect") });
    }
    choices.push(
      { value: "halve", label: game.i18n.localize("DWAUTO.Defend.ChoiceHalve") },
      { value: "vengeanceForward", label: game.i18n.localize("DWAUTO.Defend.ChoiceVengeanceForward") },
      { value: "attackBack", label: game.i18n.localize("DWAUTO.Defend.ChoiceAttackBack") }
    );

    const optionsHtml = choices.map((c) => `<option value="${c.value}">${c.label}</option>`).join("");

    new Dialog({
      title: moveLabel,
      content: `
        <form>
          <p>${game.i18n.format("DWAUTO.Defend.PromptContent", {
            defender: defender.name,
            victim: victim.name,
            damage,
            reserve
          })}</p>
          <div class="form-group">
            <select name="choice">${optionsHtml}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => finish(html.find('[name="choice"]').val())
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => finish("none")
        }
      },
      default: "cancel",
      close: () => finish("none")
    }).render(true);
  });
}

function buildHpChange(originalChanges, actor, finalDamage) {
  const oldHp = Number(actor.system.attributes?.hp?.value ?? 0);
  const flat = foundry.utils.flattenObject(originalChanges);
  flat["system.attributes.hp.value"] = Math.max(0, oldHp - finalDamage);
  return flat;
}

async function reapplyToVictim(victim, changes, options) {
  await updateActorSafely(victim, changes, { ...options, [HIT_TRIGGER_SKIP_FLAG]: true, [SKIP_FLAG]: true });
}

// preUpdateActor가 이미 원래 HP 갱신을 막아둔 뒤(defender의 결정을 기다리는
// 동안) 호출된다.
async function handleIncomingDefend({ defender, victim, damage, changes, options }) {
  const isSelfHit = victim.id === defender.id;
  const reserve = getDefendReserve(defender);
  if (reserve <= 0) {
    await reapplyToVictim(victim, changes, options);
    return;
  }

  const moveLabel = findMoveByConfiguredNames(defender)?.name ?? game.i18n.localize("DWAUTO.Defend.DefaultMoveLabel");
  const choice = await promptDefendChoice(defender, victim, damage, reserve, isSelfHit, moveLabel);

  if (choice === "none") {
    await reapplyToVictim(victim, changes, options);
    return;
  }

  if (choice === "release") {
    await clearDefendStateSafely(defender);
    announceActionApplied(defender, moveLabel, game.i18n.localize("DWAUTO.Defend.ReleaseApplied"));
    await reapplyToVictim(victim, changes, options);
    return;
  }

  // 이 아래 선택지는 전부 예비 1점을 소모한다.
  await setReserveSafely(defender, reserve - 1);

  if (choice === "redirect" && !isSelfHit) {
    const defenderOldHp = Number(defender.system.attributes?.hp?.value ?? 0);
    announceActionApplied(
      defender,
      moveLabel,
      game.i18n.format("DWAUTO.Defend.RedirectApplied", { victim: victim.name, damage })
    );
    // victim은 아예 손대지 않는다(공격을 안 받은 것으로 취급). defender는
    // 스킵 플래그 없이 그대로 갱신해서, 이 피해도 다른 피격시 자동화(장갑
    // 무효화, 또 다른 방어 등)를 그대로 다시 탈 수 있게 한다.
    await updateActorSafely(defender, { "system.attributes.hp.value": Math.max(0, defenderOldHp - damage) });
    return;
  }

  if (choice === "halve") {
    const reducedDamage = Math.floor(damage / 2);
    const adjustedChanges = buildHpChange(changes, victim, reducedDamage);
    announceActionApplied(
      defender,
      moveLabel,
      game.i18n.format("DWAUTO.Defend.HalveApplied", { original: damage, damage: reducedDamage })
    );
    await reapplyToVictim(victim, adjustedChanges, options);
    return;
  }

  if (choice === "vengeanceForward") {
    const ally = await promptActorTarget(defender, {
      title: moveLabel,
      label: game.i18n.localize("DWAUTO.Defend.VengeanceTargetLabel"),
      excludeSelf: false,
      filter: (a) => a.type === "character"
    });
    if (ally) {
      const granted = await grantVengeancePending(ally, victim.name, defender.id, defender.name);
      if (granted) {
        announceActionApplied(
          defender,
          moveLabel,
          game.i18n.format("DWAUTO.Defend.VengeanceApplied", { ally: ally.name, victim: victim.name })
        );
      } else {
        ui.notifications.warn(game.i18n.format("DWAUTO.Defend.PermissionDenied", { name: ally.name }));
      }
    }
    await reapplyToVictim(victim, changes, options);
    return;
  }

  if (choice === "attackBack") {
    const attacker = await promptActorTarget(defender, {
      title: moveLabel,
      label: game.i18n.localize("DWAUTO.Defend.AttackerTargetLabel"),
      excludeSelf: false
    });
    if (attacker) {
      const level = Number(defender.system?.attributes?.level?.value) || 1;
      const attackerOldHp = Number(attacker.system.attributes?.hp?.value ?? 0);
      announceActionApplied(
        defender,
        moveLabel,
        game.i18n.format("DWAUTO.Defend.AttackBackApplied", { attacker: attacker.name, damage: level })
      );
      // attacker도 defender의 redirect와 같은 이유로 스킵 플래그 없이 갱신한다.
      await updateActorSafely(attacker, { "system.attributes.hp.value": Math.max(0, attackerOldHp - level) });
    }
    await reapplyToVictim(victim, changes, options);
    return;
  }

  await reapplyToVictim(victim, changes, options);
}

// 이 victim을 지금 지키고 있는(hold>0, 보호대상==victim) 첫 번째 방어자를
// 찾는다. 자기 자신을 지키는 경우도 protectedActorId==defender.id==victim.id
// 조건으로 자연스럽게 포함된다. 같은 대상을 동시에 지키는 방어자가 둘 이상
// 있는 경우는(드문 상황이라) 첫 번째만 처리한다.
function findFirstDefenderFor(victim) {
  return (
    game.actors.find(
      (a) => a.type === "character" && getDefendReserve(a) > 0 && getDefendProtectedActorId(a) === victim.id
    ) ?? null
  );
}

function onPreUpdateActor(victim, changes, options, userId) {
  if (options[HIT_TRIGGER_SKIP_FLAG] || options[SKIP_FLAG]) return true;
  if (game.system.id !== "dungeonworld") return true;
  if (!isEnabled()) return true;
  if (userId !== game.user.id) return true;

  const flat = foundry.utils.flattenObject(changes);
  const newHp = flat["system.attributes.hp.value"];
  if (newHp === undefined || newHp === null) return true;

  const oldHp = Number(victim.system.attributes?.hp?.value ?? 0);
  const damage = oldHp - Number(newHp);
  if (damage <= 0) return true;

  const defender = findFirstDefenderFor(victim);
  if (!defender) return true;

  // 예비를 쓸지 말지는 지키는 쪽(defender)이 결정해야 하므로, 그 소유
  // 플레이어가 따로 접속해 있다면 소켓으로 넘긴다. features/hit-trigger.js와
  // 같은 패턴이지만, 결정을 내리는 사람과 실제로 피해를 받는 사람(victim)이
  // 다를 수 있다는 점이 다르다 — 그래서 최종 갱신은 updateActorSafely로
  // 권한이 있는 쪽(대개 GM)이 대신 적용한다.
  const decidingUser = findDecidingUser(defender);
  if (decidingUser && decidingUser.id !== game.user.id) {
    game.socket.emit(SOCKET_NAME, {
      type: "defendRequest",
      targetUserId: decidingUser.id,
      defenderActorId: defender.id,
      victimActorId: victim.id,
      damage,
      changes,
      options
    });
  } else {
    handleIncomingDefend({ defender, victim, damage, changes, options });
  }
  return false;
}

function onSocketEvent(data) {
  if (data?.type === "defendRequest") {
    if (data.targetUserId !== game.user.id) return;
    const defender = game.actors.get(data.defenderActorId);
    const victim = game.actors.get(data.victimActorId);
    if (!defender || !victim) return;
    handleIncomingDefend({ defender, victim, damage: data.damage, changes: data.changes, options: data.options });
    return;
  }

  if (data?.type === "defendUpdateRequest") {
    if (!game.user.isGM) return;
    const actor = game.actors.get(data.actorId);
    const respond = (success) =>
      game.socket.emit(SOCKET_NAME, {
        type: "defendUpdateResponse",
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
  if (data?.type === "defendUpdateResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingUpdateApprovals.get(data.requestId);
    if (resolve) {
      pendingUpdateApprovals.delete(data.requestId);
      resolve(data.success);
    }
    return;
  }

  if (data?.type === "defendVengeanceGrantRequest") {
    if (!game.user.isGM) return;
    promptVengeanceGrantPermission(data);
    return;
  }
  if (data?.type === "defendVengeanceGrantResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingVengeanceApprovals.get(data.requestId);
    if (resolve) {
      pendingVengeanceApprovals.delete(data.requestId);
      resolve(data.approved);
    }
  }
}

// lib/roll-wrapper.js가 액터가 굴리는 모든 판정 전에 호출한다. 대기 중인
// "빈틈 노림" 보정이 없으면 즉시 통과, 있으면 "이 판정이 그 공격자에 대한
// 판정입니까?"를 물어서 "예"면 이번 판정에 +1을 얹고 대기를 지운다.
// "아니오"면 보정치를 그대로 아껴두고(features/know-it-all.js와 같은 방식)
// 판정은 평소대로 진행한다.
export async function promptDefendVengeancePreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor) return { bonus: 0 };

  const pending = getDefendVengeancePending(actor);
  if (!pending) return { bonus: 0 };

  const confirmed = await Dialog.confirm({
    title: pending.defenderName,
    content: `<p>${game.i18n.format("DWAUTO.Defend.VengeancePrompt", { victim: pending.victimName })}</p>`,
    defaultYes: false
  });
  if (!confirmed) return { bonus: 0 };

  await clearDefendVengeancePending(actor);
  announceActionApplied(actor, pending.defenderName, game.i18n.localize("DWAUTO.Defend.VengeanceConsumed"));
  return { bonus: 1 };
}

function promptSetReserve(current) {
  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("DWAUTO.Defend.AdjustTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Defend.AdjustLabel")}</label>
            <input type="number" name="amount" value="${current}" min="0">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => resolve(Math.max(0, Number(html.find('[name="amount"]').val()) || 0))
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

// 무브 옆에 배지를 붙인다: 현재 예비(hold)와 보호대상(GM만 클릭해서 예비를
// 직접 고칠 수 있음), 그리고 이 방어자가 걸어둔 "빈틈 노림" 대기가 있는
// 아군마다 하나씩(만물박사와 같은 이유로 매번 지우고 다시 그린다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findMoveByConfiguredNames(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-defend-badge").remove();

  const reserve = getDefendReserve(actor);
  const protectedId = getDefendProtectedActorId(actor);
  const protectedActor = protectedId ? game.actors.get(protectedId) : null;
  const reserveTitle = protectedActor
    ? game.i18n.format("DWAUTO.Defend.ReserveBadgeTitleWithTarget", { name: protectedActor.name })
    : game.i18n.localize("DWAUTO.Defend.ReserveBadgeTitle");

  const $reserveBadge = $(
    `<a class="tag dwauto-defend-badge dwauto-defend-reserve-badge${reserve > 0 ? " dwauto-defend-on" : ""}" title="${reserveTitle}">${game.i18n.format("DWAUTO.Defend.ReserveLabel", { reserve })}</a>`
  );
  $tags.append($reserveBadge);
  if (game.user.isGM) {
    $reserveBadge.on("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = await promptSetReserve(reserve);
      if (next !== null) await setDefendReserve(actor, next);
    });
  }

  const vengeanceTargets = game.actors.filter((a) => getDefendVengeancePending(a)?.defenderActorId === actor.id);
  for (const ally of vengeanceTargets) {
    const $vengeanceBadge = $(
      `<a class="tag dwauto-defend-badge dwauto-defend-vengeance-badge dwauto-defend-on" title="${game.i18n.localize("DWAUTO.Defend.VengeanceBadgeTitle")}">${game.i18n.format("DWAUTO.Defend.VengeancePendingOn", { name: ally.name })}</a>`
    );
    $tags.append($vengeanceBadge);
    if (!game.user.isGM) continue;
    $vengeanceBadge.on("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await clearDefendVengeancePending(ally);
    });
  }
}

// "빈틈 노림" 대기 상태는 방어자가 아니라 그 대기를 받은 아군 액터에
// 저장되므로, features/know-it-all.js의 onUpdateActor와 같은 이유로 방어자의
// 시트를 수동으로 다시 그려준다.
function onUpdateActor(actor, changes) {
  if (!isEnabled()) return;

  const flat = foundry.utils.flattenObject(changes);
  const relevant = Object.keys(flat).some((key) => key.includes("defendVengeancePending"));
  if (!relevant) return;

  setTimeout(() => {
    for (const app of Object.values(ui.windows)) {
      if (app.actor?.type === "character" && findMoveByConfiguredNames(app.actor) && typeof app.render === "function") {
        app.render(true);
      }
    }
  }, 50);
}

export function registerDefendAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("preUpdateActor", onPreUpdateActor);
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.on("updateActor", onUpdateActor);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_NAME, onSocketEvent);
  });
}
