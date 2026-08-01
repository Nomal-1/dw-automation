import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { extractInlineRoll } from "../lib/move-choices.js";
import { announceActionApplied } from "../lib/announce.js";
import { DEFAULT_HOSPITALLER_MOVES } from "../data/healing-moves.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { promptActorTarget } from "../lib/actor-target-picker.js";

// 관찰(Observer) 권한만 있는 대상(적인지 아군인지 애매한 NPC 등)도 치유
// 대상으로 고를 수는 있게 하되, 실제로 HP를 쓸 권한(Owner)이 없으면 GM에게
// 승인을 구한다 — hit-trigger.js와 같은 방식으로 소켓을 통해 GM의 화면에
// 대화상자를 띄운다(같은 채널을 쓰지만 type 값으로 서로 구분한다).
const SOCKET_NAME = `module.${MODULE_ID}`;
const pendingHealApprovals = new Map();

function getHealingRow(name) {
  const table = game.settings.get(MODULE_ID, SETTINGS.HEALING_MOVES);
  return table.find((row) => row.name === name) ?? null;
}

// "auto"는 주문 아이템이면 system.rollFormula(구조적 필드, 번역 무관하게 항상
// 정확)를 읽고, 무브 아이템이면 성공/부분성공 결과 텍스트에 박힌 인라인
// 주사위 표기([[1d8]], 번역되어 괄호가 사라졌다면 "1d8" 형태)를 파싱한다.
function resolveFormula(item, row) {
  if (row.formulaMode === "custom") return row.customFormula || null;
  if (row.formulaMode === "max") return null;

  if (item?.type === "spell" && item.system?.rollFormula) return item.system.rollFormula;

  const text = item?.system?.moveResults?.success?.value || item?.system?.moveResults?.partial?.value || "";
  return extractInlineRoll(text) || row.customFormula || null;
}

function getHospitallerBonusRows(actor) {
  const table = game.settings.get(MODULE_ID, SETTINGS.HOSPITALLER_MOVES);
  return table.filter((row) => actor.items.some((i) => i.type === "move" && i.name === row.name));
}

// 치유 대상을 고른다. 토큰을 하나만 타겟팅해뒀다면 그걸 기본 선택값으로
// 띄워준다(캔버스 선택/컨트롤과는 다른, 던전월드 데미지 버튼과 무관한
// 별도의 타겟팅이라 서로 간섭하지 않는다). Druid Balance처럼 다른 기능에서도
// 같은 대상 선택 UI가 필요해서 export한다 — 실제 목록/다이얼로그 로직은
// lib/actor-target-picker.js에 공용으로 뺐다(features/aid-or-interfere.js도
// 재사용).
export function promptHealTarget(healer) {
  return promptActorTarget(healer, {
    title: game.i18n.localize("DWAUTO.Healing.TargetTitle"),
    label: game.i18n.localize("DWAUTO.Healing.TargetLabel"),
    selfLabel: game.i18n.localize("DWAUTO.Healing.Self")
  });
}

// Heal 주문처럼 주사위 대신 "치유자 최대 HP까지 원하는 만큼"인 경우 숫자를
// 입력받는다.
function promptMaxHealAmount(max) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title: game.i18n.localize("DWAUTO.Healing.MaxAmountTitle"),
      content: `
        <form>
          <p>${game.i18n.format("DWAUTO.Healing.MaxAmountInstruction", { max })}</p>
          <div class="form-group">
            <input type="number" name="amount" value="${max}" min="0" max="${max}">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const raw = Number(html.find('[name="amount"]').val());
            finish(Math.max(0, Math.min(max, Number.isFinite(raw) ? raw : max)));
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => finish(null)
        }
      },
      default: "ok",
      close: () => finish(null)
    }).render(true);
  });
}

function findApprovingGM() {
  return game.users.find((u) => u.active && u.isGM) ?? null;
}

// 적인지 아군인지 애매한, 관찰(Observer) 권한만 있는 대상에게 치유를 주는
// 것도 서사적으로 재미있는 연출일 수 있어서 막지 않는다 — 다만 실제로 HP를
// 쓸 권한(Owner)이 없으니, 굴린 치유량을 들고 접속 중인 GM에게 승인을
// 구한다. GM이 허락하면 GM의 클라이언트가 직접 적용한다(GM은 항상 모든
// 액터에 대한 권한이 있으므로).
function requestHealApproval({ target, healerName, itemName, amount }) {
  return new Promise((resolve) => {
    const gm = findApprovingGM();
    if (!gm) {
      ui.notifications.warn(game.i18n.format("DWAUTO.Healing.NoGmOnline", { name: target.name }));
      resolve(false);
      return;
    }

    const requestId = foundry.utils.randomID();
    pendingHealApprovals.set(requestId, resolve);

    game.socket.emit(SOCKET_NAME, {
      type: "healPermissionRequest",
      requestId,
      requesterUserId: game.user.id,
      healerName,
      targetActorId: target.id,
      targetName: target.name,
      itemName,
      amount
    });
  });
}

function promptHealPermission(data) {
  new Dialog({
    title: game.i18n.localize("DWAUTO.Healing.PermissionTitle"),
    content: `<p>${game.i18n.format("DWAUTO.Healing.PermissionContent", {
      healer: data.healerName,
      target: data.targetName,
      amount: data.amount,
      item: data.itemName
    })}</p>`,
    buttons: {
      yes: {
        label: game.i18n.localize("DWAUTO.Healing.PermissionAllow"),
        callback: async () => {
          const target = game.actors.get(data.targetActorId);
          if (target) {
            const targetHp = Number(target.system.attributes?.hp?.value) || 0;
            const targetMax = Number(target.system.attributes?.hp?.max) || 0;
            await target.update({ "system.attributes.hp.value": Math.min(targetHp + data.amount, targetMax) });
          }
          game.socket.emit(SOCKET_NAME, {
            type: "healPermissionResponse",
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
            type: "healPermissionResponse",
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
  if (data?.type === "healPermissionRequest") {
    if (!game.user.isGM) return;
    promptHealPermission(data);
    return;
  }
  if (data?.type === "healPermissionResponse") {
    if (data.targetUserId !== game.user.id) return;
    const resolve = pendingHealApprovals.get(data.requestId);
    if (resolve) {
      pendingHealApprovals.delete(data.requestId);
      resolve(data.approved);
    }
  }
}

// 실제로 target의 HP에 amount를 더한다. target에 대한 수정 권한(Owner)이
// 있으면 바로 적용하고, 관찰 권한만 있으면(적인지 아군인지 애매한 대상 등)
// 접속 중인 GM에게 승인을 구한 뒤 적용한다. Druid Balance처럼 다른 기능에서도
// 같은 절차가 필요해서 export한다.
export async function applyHealAmount(healer, target, moveName, amount) {
  if (target.isOwner) {
    const targetHp = Number(target.system.attributes?.hp?.value) || 0;
    const targetMax = Number(target.system.attributes?.hp?.max) || 0;
    const newHp = Math.min(targetHp + amount, targetMax);
    await target.update({ "system.attributes.hp.value": newHp });

    announceActionApplied(healer, moveName, game.i18n.format("DWAUTO.Healing.Applied", { target: target.name, amount }));
  } else {
    const approved = await requestHealApproval({ target, healerName: healer.name, itemName: moveName, amount });
    if (approved) {
      announceActionApplied(healer, moveName, game.i18n.format("DWAUTO.Healing.Applied", { target: target.name, amount }));
    } else {
      ui.notifications.warn(game.i18n.format("DWAUTO.Healing.PermissionDenied", { name: target.name }));
    }
  }
}

async function performHeal({ healer, target, item, row, resultTag }) {
  let total = 0;

  if (row.formulaMode === "max") {
    const max = Number(healer.system.attributes?.hp?.max) || 0;
    const amount = await promptMaxHealAmount(max);
    if (amount === null) return;
    total += amount;
  } else {
    const formula = resolveFormula(item, row);
    if (!formula) {
      ui.notifications.warn(game.i18n.format("DWAUTO.Healing.NoFormula", { name: item.name }));
      return;
    }
    const roll = new Roll(formula, healer.getRollData());
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: healer }),
      flavor: game.i18n.format("DWAUTO.Healing.RollFlavor", { name: item.name })
    });
    total += roll.total;
  }

  if (target.id !== healer.id) {
    for (const hRow of getHospitallerBonusRows(healer)) {
      const bonusRoll = new Roll(hRow.bonusFormula, healer.getRollData());
      await bonusRoll.evaluate();
      await bonusRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: healer }),
        flavor: game.i18n.format("DWAUTO.Healing.HospitallerFlavor", { name: hRow.name })
      });
      total += bonusRoll.total;
    }
  }

  await applyHealAmount(healer, target, item.name, total);

  if (row.transferToSelfOnPartial && resultTag === "partial" && target.id !== healer.id) {
    const healerHp = Number(healer.system.attributes?.hp?.value) || 0;
    const newHealerHp = Math.max(healerHp - total, 0);
    await healer.update({ "system.attributes.hp.value": newHealerHp });
    announceActionApplied(healer, item.name, game.i18n.format("DWAUTO.Healing.Transferred", { amount: total }));
  }
}

// Cast a Spell 흐름(spellcasting.js)에서 선택된 주문이 치유 계열이면 이걸
// 호출한다 — 무브처럼 채팅 카드 자체의 성공/부분성공을 다시 감지할 필요
// 없이, 이미 "이 주문을 썼다"는 게 확정된 시점에 바로 연결된다.
export async function handleSpellHeal(actor, spellItem) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_HEALING_ASSISTANT)) return;

  const row = getHealingRow(spellItem.name);
  if (!row) return;

  const target = await promptHealTarget(actor);
  if (!target) return;

  await performHeal({ healer: actor, target, item: spellItem, row, resultTag: null });
}

// Lay On Hands처럼 그 자체가 독립된 무브인 치유는 다른 무브들과 같은 방식
// (채팅 카드 감지)으로 처리한다.
function onCreateChatMessage(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_HEALING_ASSISTANT)) return;
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title, result } = info;
  if (result !== "success" && result !== "partial") return;

  const row = getHealingRow(title);
  if (!row) return;

  const moveItem = findMoveItem(actor, title);
  if (!moveItem) return;

  promptHealTarget(actor).then((target) => {
    if (!target) return;
    performHeal({ healer: actor, target, item: moveItem, row, resultTag: result });
  });
}

// v0.23.x 전수조사로 찾은 Healing Song/Healing Chorus(바드)를 이미 설정해둔
// 세계에도 반영한다. underdog.js의 같은 패턴 참고 — 이미 저장된 표에 없는
// 이름만 번역 인지 상태로 한 번 추가한다.
async function migrateAddSurveyedHospitallerDefaults() {
  if (!game.user.isGM) return;

  const rows = game.settings.get(MODULE_ID, SETTINGS.HOSPITALLER_MOVES);
  const existingNames = new Set(rows.map((r) => r.name));

  let nameMap = null;
  try {
    nameMap = await getMoveNameMap();
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 이름으로는 추가한다.
  }

  const toAdd = [];
  for (const row of DEFAULT_HOSPITALLER_MOVES) {
    if (existingNames.has(row.name)) continue;
    const translated = nameMap?.get(row.name);
    if (translated && existingNames.has(translated)) continue;
    toAdd.push(translated ? { ...row, name: translated } : row);
  }

  if (toAdd.length === 0) return;

  await game.settings.set(MODULE_ID, SETTINGS.HOSPITALLER_MOVES, [...rows, ...toAdd]);
  console.log(
    `${MODULE_ID} | healing: added ${toAdd.length} newly-surveyed default(s) to Hospitaller-style Moves`,
    toAdd.map((r) => r.name)
  );
}

export function registerHealingAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_NAME, onSocketEvent);
    migrateAddSurveyedHospitallerDefaults();
  });
}
