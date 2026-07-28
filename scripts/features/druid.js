import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { handleHoldMove } from "../lib/hold.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { promptHealTarget, applyHealAmount } from "./healing.js";

const BALANCE_FLAG = "druidBalance";
const SHAPESHIFT_FLAG = "druidShapeshift";
const SHAPESHIFT_ACTIVATED_FLAG = "druidShapeshiftActivated";

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findMoveByNames(actor, names) {
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function getBalanceMove(actor) {
  return findMoveByNames(actor, splitCommaList(SETTINGS.DRUID_BALANCE_MOVE_NAMES));
}

function getShapeshifterMove(actor) {
  return findMoveByNames(actor, splitCommaList(SETTINGS.DRUID_SHAPESHIFTER_MOVE_NAMES));
}

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_DRUID_ASSISTANT);
}

// 변신 탭은 "드루이드로 만들어졌다"가 아니라 "변신 액션을 실제로 한 번이라도
// 굴렸다"를 기준으로 나타난다 — 드루이드는 변신을 시작 무브로 갖고 있어서
// 캐릭터를 만들자마자 소유 여부만으로 판단하면 클래스만 보고 뜨는 것처럼
// 보이지만, 다른 직업이 멀티클래스 등으로 이 무브를 나중에 얻어도 그
// 액션을 실제로 사용하는 순간 똑같이 탭이 생기게 하기 위함이다.
function isShapeshiftActivated(actor) {
  return Boolean(actor.getFlag(MODULE_ID, SHAPESHIFT_ACTIVATED_FLAG));
}

export function hasShapeshifter(actor) {
  return isEnabled() && isShapeshiftActivated(actor) && Boolean(getShapeshifterMove(actor));
}

function getBalance(actor) {
  return Number(actor.getFlag(MODULE_ID, BALANCE_FLAG)) || 0;
}

function getShapeshiftState(actor) {
  return actor.getFlag(MODULE_ID, SHAPESHIFT_FLAG) ?? { active: false, animalName: "", notes: "" };
}

// Fighter/Ranger 등 데미지를 굴리는 다른 무브와 달리 Balance는 "데미지를 줄
// 때마다"라서, 특정 무브 하나가 아니라 attack-assistant.js의 데미지 굴림
// 자체에 걸어둔다(무기 공격 자동화를 거치지 않는 피해는 범위 밖이다).
export async function incrementBalanceOnDamage(actor) {
  if (!isEnabled()) return;

  const move = getBalanceMove(actor);
  if (!move) return;

  const next = getBalance(actor) + 1;
  await actor.setFlag(MODULE_ID, BALANCE_FLAG, next);
  announceActionApplied(actor, move.name, game.i18n.format("DWAUTO.Druid.BalanceGained", { balance: next }));
}

function promptSpendAmount(max) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title: game.i18n.localize("DWAUTO.Druid.SpendTitle"),
      content: `
        <form>
          <p>${game.i18n.format("DWAUTO.Druid.SpendInstruction", { max })}</p>
          <div class="form-group">
            <input type="number" name="amount" value="${max}" min="1" max="${max}">
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

async function spendBalance(actor) {
  const balance = getBalance(actor);
  if (balance <= 0) return;

  const move = getBalanceMove(actor);
  const moveName = move?.name ?? "Balance";

  const amount = await promptSpendAmount(balance);
  if (!amount) return;

  const target = await promptHealTarget(actor);
  if (!target) return;

  const roll = new Roll(`${amount}d4`, actor.getRollData());
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game.i18n.format("DWAUTO.Druid.BalanceRollFlavor", { amount })
  });

  await actor.setFlag(MODULE_ID, BALANCE_FLAG, balance - amount);
  await applyHealAmount(actor, target, moveName, roll.total);
}

function promptAnimalName() {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title: game.i18n.localize("DWAUTO.Druid.ShapeshiftPromptTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Druid.ShapeshiftPromptLabel")}</label>
            <input type="text" name="animal" value="">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => finish((html.find('[name="animal"]').val() ?? "").trim())
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

async function startShapeshift(actor) {
  const animalName = await promptAnimalName();
  if (animalName === null) return;

  const moveName = getShapeshifterMove(actor)?.name ?? "Shapeshifter";
  const state = getShapeshiftState(actor);
  await actor.setFlag(MODULE_ID, SHAPESHIFT_FLAG, { ...state, active: true, animalName });
  announceActionApplied(actor, moveName, game.i18n.format("DWAUTO.Druid.ShapeshiftStarted", { animal: animalName || "?" }));
}

async function revertShapeshift(actor) {
  const moveName = getShapeshifterMove(actor)?.name ?? "Shapeshifter";
  const state = getShapeshiftState(actor);
  await actor.setFlag(MODULE_ID, SHAPESHIFT_FLAG, { ...state, active: false });
  announceActionApplied(actor, moveName, game.i18n.localize("DWAUTO.Druid.ShapeshiftReverted"));
}

// 조화는 변신과 무관한 별개의 자원이라(다른 직업이 이 무브를 가져가도 그
// 대로 작동해야 함) 변신 전용 탭에 넣지 않고, 무브 목록의 그 무브 이름
// 옆에 예비량 배지로 바로 보여준다. 클릭하면 소모 절차로 이어진다.
function renderBalanceBadge(actor, html) {
  const move = getBalanceMove(actor);
  if (!move) return;

  const $item = html.find(`.item[data-item-id="${move.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  if ($tags.find(".dwauto-balance-badge").length) return;

  const balance = getBalance(actor);
  const $badge = $(
    `<a class="tag dwauto-balance-badge" title="${game.i18n.localize("DWAUTO.Druid.BalanceBadgeTitle")}">${game.i18n.format("DWAUTO.Druid.BalanceBadge", { balance })}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await spendBalance(actor);
  });
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  renderBalanceBadge(actor, html);
}

// 변신 탭의 GM 초기화 버튼에서 호출한다 — 변신 상태와 활성화 여부를 전부
// 지워서, 다시 변신 무브를 굴려야 탭이 나타나는 상태로 되돌린다.
export async function resetShapeshift(actor) {
  await actor.unsetFlag(MODULE_ID, SHAPESHIFT_ACTIVATED_FLAG);
  await actor.unsetFlag(MODULE_ID, SHAPESHIFT_FLAG);
}

// 캐릭터 시트 공용 탭에 변신 상태 섹션을 그려 넣는다: 지정/비지정 배지 +
// 동물 이름 표시 + GM이 자유롭게 적고 지울 수 있는 메모란.
export function renderShapeshiftSection($body, actor) {
  const state = getShapeshiftState(actor);
  const label = state.active
    ? game.i18n.format("DWAUTO.Druid.ShapeshiftActiveLabel", { animal: state.animalName || "?" })
    : game.i18n.localize("DWAUTO.Druid.ShapeshiftInactiveLabel");

  const $section = $(`
    <div class="cell dwauto-druid-shapeshift">
      <h2 class="cell__title">${game.i18n.localize("DWAUTO.Druid.ShapeshiftTitle")}</h2>
      <a class="tag dwauto-shapeshift-badge${state.active ? " dwauto-shapeshift-on" : ""}" title="${game.i18n.localize("DWAUTO.Druid.ShapeshiftToggleTitle")}">${label}</a>
      <label class="cell__title dwauto-shapeshift-notes-label">${game.i18n.localize("DWAUTO.Druid.ShapeshiftNotesLabel")}</label>
      <textarea class="dwauto-shapeshift-notes" rows="3">${state.notes ?? ""}</textarea>
    </div>
  `);

  $section.find(".dwauto-shapeshift-badge").on("click", async (event) => {
    event.preventDefault();
    if (state.active) {
      await revertShapeshift(actor);
    } else {
      await startShapeshift(actor);
    }
  });

  $section.find(".dwauto-shapeshift-notes").on("change", async (event) => {
    const notes = event.currentTarget.value;
    const current = getShapeshiftState(actor);
    await actor.setFlag(MODULE_ID, SHAPESHIFT_FLAG, { ...current, notes });
  });

  $body.append($section);
}

// Shapeshifter 굴림 성공/부분성공 시 동물 이름을 물어보고, 동시에 기존
// [D] Hold 엔진으로 Hold 값도 자동 설정한다(굴림 결과 텍스트의 "Hold N").
// Hold를 "쓰는" 동작은 이 무브 자체에 선택지 목록이 없어 자동화 대상이
// 아니다(연관된 무브가 무엇인지는 GM이 그때그때 정하는 서술형이라, 아래
// 메모란에 적어두고 참고하는 방식으로 남겨뒀다).
function onCreateChatMessage(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_DRUID_ASSISTANT)) return;
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title, result } = info;
  if (result !== "success" && result !== "partial" && result !== "failure") return;

  const shapeshifterNames = splitCommaList(SETTINGS.DRUID_SHAPESHIFTER_MOVE_NAMES);
  if (!shapeshifterNames.includes(title)) return;

  if (!isShapeshiftActivated(actor)) {
    actor.setFlag(MODULE_ID, SHAPESHIFT_ACTIVATED_FLAG, true);
  }

  const moveItem = findMoveItem(actor, title);
  if (moveItem) handleHoldMove(actor, moveItem, result);

  if (result === "success" || result === "partial") {
    startShapeshift(actor);
  }
}

export function registerDruidAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
