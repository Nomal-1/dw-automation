import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getOpenDebilities, getDebilityLabel, hasAllDebilities } from "../lib/debilities.js";
import { getShedCandidate, applyShed } from "./druid.js";
import { getEquippedArmorItems, damageArmorItem } from "./armor-assistant.js";
import { getOutnumberedAskCandidate, applyOutnumberedAnswer, isConditionActive } from "./underdog.js";
import { findDecidingUser } from "../lib/deciding-user.js";

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

// Druid Shed(변신 중 피해를 무효화하며 변신 해제)는 설정 표가 아니라
// druid.js가 관리하는 상태(변신 중인지)에 딸려 있어서, 매번 이 표 기반
// 후보 목록에 조건부로 끼워 넣는다. 변신 중이 아니면 애초에 후보에
// 들어가지 않는다(features/druid.js의 getShedCandidate 참고).
function getHitTriggerCandidates(actor) {
  const table = game.settings.get(MODULE_ID, SETTINGS.HIT_TRIGGER_MOVES);
  const candidates = table.filter((row) => actor.items.some((i) => i.type === "move" && i.name === row.name));

  const shed = getShedCandidate(actor);
  if (shed) candidates.push(shed);

  return candidates;
}

async function grantForward(actor) {
  const current = Number(actor.system.attributes?.forward?.value) || 0;
  await actor.update({ "system.attributes.forward.value": current + 1 });
}

// 무효화를 위해 어느 방어구의 내구도를 깎을지 물어본다. 후보가 하나도 없으면
// (장착 중인 방어구가 없으면) null을 반환해서 아이템 손상 없이 장갑 수치만
// 깎도록 한다.
function promptArmorItemChoice(items) {
  return new Promise((resolve) => {
    const options = items.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");

    new Dialog({
      title: game.i18n.localize("DWAUTO.HitTrigger.ArmorItemPromptTitle"),
      content: `
        <form>
          <p>${game.i18n.localize("DWAUTO.HitTrigger.ArmorItemPromptContent")}</p>
          <div class="form-group">
            <select name="item">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => resolve(html.find('[name="item"]').val())
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve(undefined)
        }
      },
      default: "ok",
      close: () => resolve(undefined)
    }).render(true);
  });
}

// Armor Mastery/Armored Perfection: 무효화하는 대신, 실제로 장착 중인 방어구
// 하나를 골라 그 아이템의 장갑 태그를 1 깎고(0이 되면 태그를 없애고 이름에
// "(파괴됨)"을 붙임) 캐릭터의 장갑 수치도 1 내린다. 태그를 바꾼 뒤 장갑
// 재계산(armor-assistant.js)을 다시 부르지는 않는다 — 재계산을 하면 방금
// 깎은 손상이 바로 다시 합산되어 사라져버리기 때문에, 장갑 수치는 여기서
// 직접 -1 한다.
//
// 장착 중인 방어구가 아예 없으면 아이템 선택 없이 장갑 수치만 깎는다.
// 방어구가 있는데 선택을 취소하면(대화상자 닫기 포함) 이 무효화 자체를
// 취소한 것으로 보고 null을 반환한다 — 호출부가 원래 피해를 그대로
// 적용한다.
async function applyArmorNegation(actor, row, damage) {
  const equippedArmor = getEquippedArmorItems(actor);
  let itemDetail = "";

  if (equippedArmor.length > 0) {
    const itemId = await promptArmorItemChoice(equippedArmor);
    if (itemId === undefined) return null;

    const item = actor.items.get(itemId);
    if (item) {
      const result = await damageArmorItem(item);
      itemDetail = result.destroyed
        ? game.i18n.format("DWAUTO.HitTrigger.ArmorItemDestroyed", { item: result.itemName })
        : game.i18n.format("DWAUTO.HitTrigger.ArmorItemDamaged", { item: result.itemName, value: result.newValue });
    }
  }

  const current = Number(actor.system.attributes?.ac?.value) || 0;
  const next = Math.max(0, current - 1);
  await actor.update({ "system.attributes.ac.value": next });
  if (row.grantsForward) await grantForward(actor);

  const detailKey = row.grantsForward ? "DWAUTO.HitTrigger.ArmorAppliedForward" : "DWAUTO.HitTrigger.ArmorApplied";
  const detail = game.i18n.format(detailKey, { damage, armor: next }) + (itemDetail ? `<br>${itemDetail}` : "");
  announceActionApplied(actor, row.name, detail);

  if (next === 0) {
    ui.notifications.warn(game.i18n.format("DWAUTO.HitTrigger.ArmorDestroyed", { name: actor.name }));
  }

  return true;
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
          } else if (row.effect === "shed") {
            await applyShed(actor, damage);
          } else {
            const applied = await applyArmorNegation(actor, row, damage);
            if (applied === null) await actor.update(originalChanges, { ...originalOptions, [SKIP_FLAG]: true });
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

function buildHpChange(originalChanges, actor, finalDamage) {
  const oldHp = Number(actor.system.attributes?.hp?.value ?? 0);
  const flat = foundry.utils.flattenObject(originalChanges);
  flat["system.attributes.hp.value"] = Math.max(0, oldHp - finalDamage);
  return flat;
}

// 던전월드 시스템의 피해 적용 버튼(전체/절반/두배)은 실제로
// actor.applyDamage()를 거치는데, 거기서 "이번에 장갑이 얼마를 깎아줬는지"
// (options.dw.armor.reduced/piercing/value)를 update()의 옵션에 실어서
// 넘겨준다. 그 덕분에 여기서 "장갑 적용 전 원래 피해량"을 역산할 수 있고
// (damage + reduced), 열세 여부가 바뀌어 장갑이 바뀌면 그 새 장갑 기준으로
// 이번 피해를 다시 계산해서 실제로 "바뀐 장갑으로 피해 적용"이 되게 한다.
// options.dw.armor가 없으면(예: 시트에서 HP를 직접 고친 경우처럼 시스템의
// 피해 적용 버튼을 거치지 않은 갱신) 역산할 근거가 없으므로 원래 피해량을
// 그대로 쓴다.
function recalculateDamageForNewArmor(damage, options, newArmor) {
  const armorInfo = options?.dw?.armor;
  if (!armorInfo) return null;

  const rawAmount = damage + (Number(armorInfo.reduced) || 0);
  const piercing = Number(armorInfo.piercing) || 0;
  const newReduced = Math.max(newArmor - piercing, 0);
  return Math.max(rawAmount - newReduced, 0);
}

// preUpdateActor(로컬이든 소켓으로 넘겨받았든)가 이미 원래 HP 갱신을 막아둔
// 뒤 호출된다. 조건부 장갑 보너스 무브(오기/투지, 나무껍질류 등)들 중
// "피격 때마다 묻기"가 켜진 것들을 무브별로 하나씩 순서대로 Y/N 확인한다.
// (한 액터가 이런 무브를 여러 개 가져도 서로 독립적으로 물어본다.) 답에 따라
// 상태가 실제로 바뀌면 그 무브의 토글과 장갑을 갱신하고, 매번 최신 장갑
// 기준으로 이번 피해량 자체를 다시 계산한다(recalculateDamageForNewArmor는
// 항상 원래 피해량+역산한 원본값을 기준으로 다시 계산하므로 여러 번 불러도
// 누적 오차 없이 항상 정확하다). 그 다음 무효화 무브(Armor Mastery/Bloody
// Aegis류)가 있으면 원래 promptHitTrigger로 이어간다. 없으면 (재계산된)
// 피해량 그대로 HP 갱신을 다시 적용한다.
async function handleIncomingDamage({ actor, damage, changes, options, candidates, outnumberedCandidates }) {
  let finalDamage = damage;

  for (const candidate of outnumberedCandidates ?? []) {
    const nowActive = await Dialog.confirm({
      title: candidate.moveName,
      content: `<p>${game.i18n.format("DWAUTO.Underdog.AskPrompt", { name: candidate.moveName })}</p>`,
      defaultYes: isConditionActive(actor, candidate.moveId)
    });
    const { changed, newArmor } = await applyOutnumberedAnswer(actor, candidate.moveId, candidate.moveName, nowActive);

    if (changed) {
      const recalculated = recalculateDamageForNewArmor(damage, options, newArmor);
      if (recalculated !== null) {
        finalDamage = recalculated;
        announceActionApplied(
          actor,
          candidate.moveName,
          game.i18n.format("DWAUTO.Underdog.DamageRecalculated", { damage: finalDamage })
        );
      }
    }
  }

  const adjustedChanges = buildHpChange(changes, actor, finalDamage);

  if (candidates.length === 0) {
    await actor.update(adjustedChanges, { ...options, [SKIP_FLAG]: true });
    return;
  }

  await promptHitTrigger(actor, candidates, finalDamage, adjustedChanges, options);
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
  const outnumberedCandidates = getOutnumberedAskCandidate(actor);
  if (candidates.length === 0 && outnumberedCandidates.length === 0) return true;

  // 여기서 갱신을 막고(false 반환), 대화상자 결과에 따라 원래 변경사항을 다시
  // 적용하거나 대체 효과를 적용한다. preUpdate 훅은 반환값을 동기적으로만
  // 확인하므로(비동기 함수는 항상 Promise를 반환해 false로 인식되지 않는다)
  // 이 함수 자체는 async로 선언하지 않고, 아래 호출은 기다리지 않는다.
  //
  // 무효화/경감 여부는 피해를 "주는" 사람(지금 이 갱신을 시작한 클라이언트,
  // 보통 GM)이 아니라 피해를 "받는" 캐릭터의 소유 플레이어가 결정해야
  // 하므로, 그 플레이어가 따로 접속해 있다면 소켓으로 넘긴다.
  const decidingUser = findDecidingUser(actor);
  if (decidingUser && decidingUser.id !== game.user.id) {
    console.log(
      `${MODULE_ID} | hit-trigger: relaying prompt for ${actor.name} (damage ${damage}) to ${decidingUser.name} via socket`
    );
    game.socket.emit(SOCKET_NAME, {
      type: "hitTriggerRequest",
      targetUserId: decidingUser.id,
      actorId: actor.id,
      candidates,
      outnumberedCandidates,
      damage,
      changes,
      options
    });
  } else {
    console.log(`${MODULE_ID} | hit-trigger: no other connected owner found for ${actor.name}, prompting locally`);
    handleIncomingDamage({ actor, damage, changes, options, candidates, outnumberedCandidates });
  }
  return false;
}

function onSocketEvent(data) {
  if (data?.type !== "hitTriggerRequest") return;
  console.log(`${MODULE_ID} | hit-trigger: socket event received`, data);
  if (data.targetUserId !== game.user.id) return;
  const actor = game.actors.get(data.actorId);
  if (!actor) {
    console.warn(`${MODULE_ID} | hit-trigger: actor ${data.actorId} not found on this client`);
    return;
  }
  console.log(`${MODULE_ID} | hit-trigger: showing prompt for ${actor.name}`);
  handleIncomingDamage({
    actor,
    damage: data.damage,
    changes: data.changes,
    options: data.options,
    candidates: data.candidates,
    outnumberedCandidates: data.outnumberedCandidates
  });
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
