import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getOpenDebilities, getDebilityLabel, hasAllDebilities } from "../lib/debilities.js";

// preUpdateActor에서 원래 HP 갱신을 취소해뒀다가(대화상자 결과를 기다리는 동안),
// 플레이어가 결국 무효화를 포기하면 이 플래그를 달아 "그대로 다시 적용"한다.
// 이 플래그가 있는 갱신은 우리 훅이 다시 가로채지 않는다(무한 루프 방지).
const SKIP_FLAG = "dwautoSkipHitTrigger";

// 데미지를 적용하는 사람(GM 등)이 아니라, 그 피해를 받는 캐릭터의 소유
// 플레이어가 무효화 여부를 결정해야 하므로 소켓으로 그 플레이어의 클라이언트에
// 대화상자를 띄운다.
const SOCKET_NAME = `module.${MODULE_ID}`;

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getHitTriggerCandidates(actor) {
  const table = game.settings.get(MODULE_ID, SETTINGS.HIT_TRIGGER_MOVES);
  return table.filter((row) => actor.items.some((i) => i.type === "move" && i.name === row.name));
}

async function grantForward(actor) {
  const current = Number(actor.system.attributes?.forward?.value) || 0;
  await actor.update({ "system.attributes.forward.value": current + 1 });
}

async function applyArmorNegation(actor, row, damage) {
  const current = Number(actor.system.attributes?.ac?.value) || 0;
  const next = Math.max(0, current - 1);
  await actor.update({ "system.attributes.ac.value": next });
  if (row.grantsForward) await grantForward(actor);

  const detailKey = row.grantsForward ? "DWAUTO.HitTrigger.ArmorAppliedForward" : "DWAUTO.HitTrigger.ArmorApplied";
  announceActionApplied(actor, row.name, game.i18n.format(detailKey, { damage, armor: next }));

  if (next === 0) {
    ui.notifications.warn(game.i18n.format("DWAUTO.HitTrigger.ArmorDestroyed", { name: actor.name }));
  }
}

function promptDebilityChoice(actor, row) {
  return new Promise((resolve) => {
    const open = getOpenDebilities(actor);
    const options = open.map((key) => `<option value="${key}">${getDebilityLabel(key)}</option>`).join("");

    new Dialog({
      title: row.name,
      content: `
        <form>
          <p>${game.i18n.localize("DWAUTO.HitTrigger.DebilityInstruction")}</p>
          <div class="form-group">
            <select name="debility">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: async (html) => {
            const key = html.find('[name="debility"]').val();
            await actor.update({ [`system.abilities.${key}.debility`]: true });
            announceActionApplied(
              actor,
              row.name,
              game.i18n.format("DWAUTO.HitTrigger.DebilityApplied", { debility: getDebilityLabel(key) })
            );
            resolve(true);
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve(false)
        }
      },
      default: "ok",
      close: () => resolve(false)
    }).render(true);
  });
}

// preUpdateActor가 이미 원래 HP 갱신을 막아둔 뒤 호출된다. 플레이어가 결국
// 무효화를 포기하면(선택 취소, 대화상자 닫기 포함) 원래 변경사항을 그대로
// 다시 적용해서 피해를 정상적으로 받게 한다.
async function promptHitTrigger(actor, candidates, damage, originalChanges, originalOptions) {
  const usable = candidates.filter((row) => row.effect !== "debility" || !hasAllDebilities(actor));
  if (usable.length === 0) {
    await actor.update(originalChanges, { ...originalOptions, [SKIP_FLAG]: true });
    return;
  }

  let resolved = false;
  const reapplyOriginal = async () => {
    if (resolved) return;
    resolved = true;
    await actor.update(originalChanges, { ...originalOptions, [SKIP_FLAG]: true });
  };

  const optionsHtml = usable.map((row, index) => `<option value="${index}">${row.name}</option>`).join("");

  new Dialog({
    title: game.i18n.localize("DWAUTO.HitTrigger.PromptTitle"),
    content: `
      <form>
        <p>${game.i18n.format("DWAUTO.HitTrigger.PromptContent", { name: actor.name, damage })}</p>
        <div class="form-group">
          <select name="choice">
            <option value="-1">${game.i18n.localize("DWAUTO.HitTrigger.TakeDamage")}</option>
            ${optionsHtml}
          </select>
        </div>
      </form>
    `,
    buttons: {
      ok: {
        label: game.i18n.localize("DWAUTO.Confirm"),
        callback: async (html) => {
          resolved = true;
          const idx = Number(html.find('[name="choice"]').val());
          if (idx < 0) {
            await actor.update(originalChanges, { ...originalOptions, [SKIP_FLAG]: true });
            return;
          }

          const row = usable[idx];
          if (row.effect === "debility") {
            const accepted = await promptDebilityChoice(actor, row);
            if (!accepted) await actor.update(originalChanges, { ...originalOptions, [SKIP_FLAG]: true });
          } else {
            await applyArmorNegation(actor, row, damage);
          }
        }
      },
      cancel: {
        label: game.i18n.localize("DWAUTO.Cancel"),
        callback: reapplyOriginal
      }
    },
    default: "cancel",
    close: reapplyOriginal
  }).render(true);
}

// 이 액터를 자신의 캐릭터로 지정해둔 접속 중인 플레이어를 우선 찾고, 없으면
// 소유권(OWNER)을 가진 접속 중인 플레이어를 찾는다. 그런 플레이어가 아무도
// 없으면(예: GM 혼자 테스트하는 상황) null을 반환하고, 이 경우 지금 갱신을
// 시작한 클라이언트에서 바로 물어본다 — 결정권자가 아예 없는 것보다는 낫다.
function findDecidingUser(actor) {
  const assigned = game.users.find((u) => u.active && !u.isGM && u.character?.id === actor.id);
  if (assigned) return assigned;
  return game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER")) ?? null;
}

function onPreUpdateActor(actor, changes, options, userId) {
  if (options[SKIP_FLAG]) return true;
  if (game.system.id !== "dungeonworld") return true;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_HIT_TRIGGER_ASSISTANT)) return true;
  if (actor.type !== "character") return true;
  // preUpdate 훅은 그 갱신을 시작한 클라이언트에서만 실행되므로, 이 체크는
  // 방어적인 목적일 뿐이다(다른 클라이언트에서 이 훅이 불릴 일은 없다).
  if (userId !== game.user.id) return true;

  const flat = foundry.utils.flattenObject(changes);
  const newHp = flat["system.attributes.hp.value"];
  if (newHp === undefined || newHp === null) return true;

  const oldHp = Number(actor.system.attributes?.hp?.value ?? 0);
  const damage = oldHp - Number(newHp);
  if (damage <= 0) return true;

  const candidates = getHitTriggerCandidates(actor);
  if (candidates.length === 0) return true;

  // 여기서 갱신을 막고(false 반환), 대화상자 결과에 따라 원래 변경사항을 다시
  // 적용하거나 대체 효과를 적용한다. preUpdate 훅은 반환값을 동기적으로만
  // 확인하므로(비동기 함수는 항상 Promise를 반환해 false로 인식되지 않는다)
  // 이 함수 자체는 async로 선언하지 않고, 아래 호출은 기다리지 않는다.
  //
  // 무효화 여부는 피해를 "주는" 사람(지금 이 갱신을 시작한 클라이언트, 보통
  // GM)이 아니라 피해를 "받는" 캐릭터의 소유 플레이어가 결정해야 하므로,
  // 그 플레이어가 따로 접속해 있다면 소켓으로 넘긴다.
  const decidingUser = findDecidingUser(actor);
  if (decidingUser && decidingUser.id !== game.user.id) {
    game.socket.emit(SOCKET_NAME, {
      type: "hitTriggerRequest",
      targetUserId: decidingUser.id,
      actorId: actor.id,
      candidates,
      damage,
      changes,
      options
    });
  } else {
    promptHitTrigger(actor, candidates, damage, changes, options);
  }
  return false;
}

function onSocketEvent(data) {
  if (data?.type !== "hitTriggerRequest") return;
  if (data.targetUserId !== game.user.id) return;
  const actor = game.actors.get(data.actorId);
  if (!actor) return;
  promptHitTrigger(actor, data.candidates, data.damage, data.changes, data.options);
}

// 약화를 새로 얻으면(피의 보루로 얻은 경우 포함, 원인 불문) Indomitable을
// 가진 캐릭터는 +1 forward를 받는다. updateActor는 모든 클라이언트에서
// 실행되므로, 실제로 그 갱신을 수행한 클라이언트에서만 반응하도록 userId를
// 확인한다(그렇지 않으면 접속자 수만큼 중복 적용된다).
function onUpdateActor(actor, changes, options, userId) {
  if (options[SKIP_FLAG]) return;
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_HIT_TRIGGER_ASSISTANT)) return;
  if (actor.type !== "character") return;
  if (userId !== game.user.id) return;

  const flat = foundry.utils.flattenObject(changes);
  const gainedDebility = Object.entries(flat).some(
    ([key, value]) => key.startsWith("system.abilities.") && key.endsWith(".debility") && value === true
  );
  if (!gainedDebility) return;

  const indomitableNames = splitCommaList(SETTINGS.INDOMITABLE_MOVE_NAMES);
  const hasIndomitable = actor.items.some((i) => i.type === "move" && indomitableNames.includes(i.name));
  if (!hasIndomitable) return;

  const moveName = actor.items.find((i) => i.type === "move" && indomitableNames.includes(i.name)).name;
  grantForward(actor).then(() => {
    announceActionApplied(actor, moveName, game.i18n.localize("DWAUTO.HitTrigger.IndomitableApplied"));
  });
}

export function registerHitTriggerAssistant() {
  Hooks.on("preUpdateActor", onPreUpdateActor);
  Hooks.on("updateActor", onUpdateActor);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_NAME, onSocketEvent);
  });
}
