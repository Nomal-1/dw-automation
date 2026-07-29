import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { handleHoldMove } from "../lib/hold.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { promptHealTarget, applyHealAmount } from "./healing.js";

const BALANCE_FLAG = "druidBalance";
const SHAPESHIFT_FLAG = "druidShapeshift";
const SHAPESHIFT_ACTIVATED_FLAG = "druidShapeshiftActivated";
const FORMSHAPER_FLAG = "druidFormshaperChoice";
const FORMCRAFTER_FLAG = "druidFormcrafterStats";
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

// Formcrafter의 마스터 쪽 능력치 선택을 요청하는 소켓 채널. hit-trigger.js/
// healing.js와 같은 채널을 쓰고 type 값으로만 구분한다.
const SOCKET_NAME = `module.${MODULE_ID}`;

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

function getShedMove(actor) {
  return findMoveByNames(actor, splitCommaList(SETTINGS.DRUID_SHED_MOVE_NAMES));
}

function getFormcrafterMove(actor) {
  return findMoveByNames(actor, splitCommaList(SETTINGS.DRUID_FORMCRAFTER_MOVE_NAMES));
}

function getFormshaperMove(actor) {
  return findMoveByNames(actor, splitCommaList(SETTINGS.DRUID_FORMSHAPER_MOVE_NAMES));
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

// Red of Tooth and Claw/Blood and Thunder/Shed/Formcrafter/Formshaper처럼
// "변신 중"이어야만 뜻이 있는 무브들이 실제로 지금 변신 중인지 확인할 때
// 쓴다. attack-assistant.js/hit-trigger.js/roll-wrapper.js가 이 함수로
// 선행 조건(변신 상태)을 확인한다.
export function isShapeshiftActive(actor) {
  return getShapeshiftState(actor).active === true;
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

// Red of Tooth and Claw(d8)/Blood and Thunder(d10): 변신 중(적절한 동물 형태)
// 일 때만 데미지 주사위가 커진다. 둘 다 갖고 있으면 더 큰 주사위를 쓴다.
// attack-assistant.js의 데미지 굴림에서 기본 주사위를 정할 때 호출한다.
function getOwnedDamageDieRows(actor) {
  const table = game.settings.get(MODULE_ID, SETTINGS.DRUID_DAMAGE_DIE_MOVES);
  return table
    .map((row) => ({ ...row, move: actor.items.find((i) => i.type === "move" && i.name === row.name) }))
    .filter((row) => row.move);
}

export function applyDamageDieOverride(actor, baseDie) {
  if (!isEnabled()) return baseDie;

  const owned = getOwnedDamageDieRows(actor);
  if (owned.length === 0) return baseDie;

  const best = owned.reduce((max, row) => (row.dieSize > (max?.dieSize ?? 0) ? row : max), null);

  if (!isShapeshiftActive(actor)) {
    announceActionApplied(actor, best.move.name, game.i18n.localize("DWAUTO.Druid.ShapeshiftRequiredNotApplied"));
    return baseDie;
  }

  const overriddenDie = `d${best.dieSize}`;
  announceActionApplied(actor, best.move.name, game.i18n.format("DWAUTO.Druid.DamageDieApplied", { die: overriddenDie }));
  return overriddenDie;
}

// Formshaper: 변신할 때마다 장갑+1 또는 피해+1d4 중 하나를 고른다. 장갑
// 선택은 변신 시작/해제 시점에 장갑 값을 직접 올렸다 내리고, 피해 선택은
// attack-assistant.js의 데미지 굴림에서 소비한다.
function promptFormshaperChoice() {
  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("DWAUTO.Druid.FormshaperPromptTitle"),
      content: `<p>${game.i18n.localize("DWAUTO.Druid.FormshaperPromptContent")}</p>`,
      buttons: {
        armor: {
          label: game.i18n.localize("DWAUTO.Druid.FormshaperArmorOption"),
          callback: () => resolve("armor")
        },
        damage: {
          label: game.i18n.localize("DWAUTO.Druid.FormshaperDamageOption"),
          callback: () => resolve("damage")
        }
      },
      default: "armor",
      close: () => resolve(null)
    }).render(true);
  });
}

function getFormshaperChoice(actor) {
  return actor.getFlag(MODULE_ID, FORMSHAPER_FLAG) ?? null;
}

async function applyFormshaperOnShapeshiftStart(actor) {
  const move = getFormshaperMove(actor);
  if (!move) return;

  const choice = await promptFormshaperChoice();
  if (!choice) return;
  await actor.setFlag(MODULE_ID, FORMSHAPER_FLAG, choice);

  if (choice === "armor") {
    const current = Number(actor.system.attributes?.ac?.value) || 0;
    const next = current + 1;
    await actor.update({ "system.attributes.ac.value": next });
    announceActionApplied(actor, move.name, game.i18n.format("DWAUTO.Druid.FormshaperArmorApplied", { armor: next }));
  } else {
    announceActionApplied(actor, move.name, game.i18n.localize("DWAUTO.Druid.FormshaperDamageApplied"));
  }
}

async function revertFormshaperOnShapeshiftEnd(actor) {
  const move = getFormshaperMove(actor);
  if (!move) return;

  if (getFormshaperChoice(actor) === "armor") {
    const current = Number(actor.system.attributes?.ac?.value) || 0;
    const next = Math.max(0, current - 1);
    await actor.update({ "system.attributes.ac.value": next });
  }
  await actor.unsetFlag(MODULE_ID, FORMSHAPER_FLAG);
}

// armor-assistant.js의 장갑 재계산 버튼이 호출한다. Formshaper가 "장갑"
// 선택인 상태로 변신 중일 때만 {source, amount} 보정 항목을 반환하고,
// 그 외는 null을 반환한다(재계산 시 반영할 항목이 없다는 뜻).
export function getFormshaperArmorContribution(actor) {
  if (!isEnabled()) return null;
  const move = getFormshaperMove(actor);
  if (!move) return null;
  if (!isShapeshiftActive(actor)) return null;
  if (getFormshaperChoice(actor) !== "armor") return null;
  return { source: move.name, amount: 1 };
}

// attack-assistant.js의 데미지 굴림에서 호출한다. Formshaper가 "피해" 선택인
// 상태로 변신 중일 때만 1d4를 반환하고, 그 외(무브 없음/장갑 선택/변신 아님)는
// 빈 문자열을 반환한다(변신 아닌 상태는 위 데미지 주사위 오버라이드와 같은
// 문구로 이미 알려주므로 여기서 또 알리지 않는다).
export function getFormshaperDamageBonus(actor) {
  if (!isEnabled()) return "";
  const move = getFormshaperMove(actor);
  if (!move) return "";
  if (!isShapeshiftActive(actor)) return "";
  if (getFormshaperChoice(actor) !== "damage") return "";

  announceActionApplied(actor, move.name, game.i18n.localize("DWAUTO.Druid.FormshaperDamageBonusApplied"));
  return "1d4";
}

function abilityLabel(key) {
  return game.i18n.localize(`DW.${key.toUpperCase()}`);
}

function promptAbilityChoice(title, content) {
  return new Promise((resolve) => {
    const options = ABILITY_KEYS.map((key) => `<option value="${key}">${abilityLabel(key)}</option>`).join("");

    new Dialog({
      title,
      content: `
        <form>
          <p>${content}</p>
          <div class="form-group">
            <select name="ability">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => resolve(html.find('[name="ability"]').val())
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

// Formcrafter: 변신할 때 능력치 하나를 골라 +1 온고잉, 마스터가 고른
// 능력치 하나에 -1 온고잉을 받는다(둘 다 변신 중에만). 실제 적용은
// lib/roll-wrapper.js가 무브 굴림 직전에 rollMod를 조정하는 방식으로
// 한다 — "무엇으로 판정할지 그 자리에서 물어보는"(ask, 예: Defy Danger)
// 무브는 어떤 능력치를 쓸지가 굴리기 직전엔 아직 정해지지 않아 자동화
// 대상에서 제외된다(getFormcrafterRollModifier 주석 참고).
export function getFormcrafterStats(actor) {
  return actor.getFlag(MODULE_ID, FORMCRAFTER_FLAG) ?? null;
}

async function promptFormcrafterGmChoice(actor, moveName) {
  const penalty = await promptAbilityChoice(
    game.i18n.format("DWAUTO.Druid.FormcrafterPenaltyTitle", { name: actor.name }),
    game.i18n.localize("DWAUTO.Druid.FormcrafterPenaltyContent")
  );
  if (!penalty) return;

  const current = actor.getFlag(MODULE_ID, FORMCRAFTER_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, FORMCRAFTER_FLAG, { ...current, penalty });
  announceActionApplied(actor, moveName, game.i18n.format("DWAUTO.Druid.FormcrafterPenaltyApplied", { stat: abilityLabel(penalty) }));
}

async function applyFormcrafterOnShapeshiftStart(actor) {
  const move = getFormcrafterMove(actor);
  if (!move) return;

  const bonus = await promptAbilityChoice(
    game.i18n.localize("DWAUTO.Druid.FormcrafterBonusTitle"),
    game.i18n.localize("DWAUTO.Druid.FormcrafterBonusContent")
  );
  if (!bonus) return;

  await actor.setFlag(MODULE_ID, FORMCRAFTER_FLAG, { bonus, penalty: null });
  announceActionApplied(actor, move.name, game.i18n.format("DWAUTO.Druid.FormcrafterBonusApplied", { stat: abilityLabel(bonus) }));

  if (game.user.isGM) {
    await promptFormcrafterGmChoice(actor, move.name);
  } else {
    game.socket.emit(SOCKET_NAME, { type: "formcrafterGmChoiceRequest", actorId: actor.id, moveName: move.name });
  }
}

async function clearFormcrafterOnShapeshiftEnd(actor) {
  if (!getFormcrafterMove(actor)) return;
  await actor.unsetFlag(MODULE_ID, FORMCRAFTER_FLAG);
}

// lib/roll-wrapper.js가 무브를 굴리기 직전마다 호출한다. 이 무브
// 자체의 rollType(고정 능력치, 또는 아래 shouldInterceptAskRoll로 확정된
// 능력치)이 지금 변신 중 보너스/페널티 능력치와 일치하면 그만큼(+1/-1,
// 둘 다 겹치면 0으로 상쇄) rollMod에 얹을 값을 반환한다.
export function getFormcrafterRollModifier(actor, rollType) {
  if (!isEnabled()) return 0;
  if (!getFormcrafterMove(actor)) return 0;
  if (!isShapeshiftActive(actor)) return 0;

  const stats = getFormcrafterStats(actor);
  if (!stats) return 0;

  let mod = 0;
  if (stats.bonus === rollType) mod += 1;
  if (stats.penalty === rollType) mod -= 1;
  return mod;
}

// Defy Danger처럼 "그 자리에서 능력치를 고르는"(ask) 무브는 시스템이
// rollMod를 대화상자를 띄우기 *전에* 이미 고정해버려서, 버튼을 누른
// 뒤에 rollMod를 바꿔봐야 소용없다. 대신 lib/roll-wrapper.js가
// 시스템 기본 Ask 대화상자가 뜨기 전에 이 함수로 먼저 능력치를 확정해서
// 물어보고, rollType 자체를 그 능력치로 바꿔치기한 채로 원본 굴림을
// 호출한다(시스템은 rollType이 "ask"가 아니면 자기 대화상자를 띄우지
// 않는다). Formcrafter가 없거나 변신 중이 아니거나 아직 능력치를 안
// 골랐으면 가로채지 않고 시스템 기본 대화상자를 그대로 둔다.
export function shouldInterceptAskRoll(actor) {
  return (
    isEnabled() &&
    Boolean(getFormcrafterMove(actor)) &&
    isShapeshiftActive(actor) &&
    Boolean(getFormcrafterStats(actor))
  );
}

// 시스템 기본 Ask 대화상자와 같은 방식(능력치 6개 버튼)으로 물어본다.
export function promptAskRollAbility(moveName) {
  return new Promise((resolve) => {
    const buttons = {};
    for (const key of ABILITY_KEYS) {
      buttons[key] = { label: abilityLabel(key), callback: () => resolve(key) };
    }

    new Dialog({
      title: moveName,
      content: `<p>${game.i18n.format("DWAUTO.Druid.FormcrafterAskContent", { name: moveName })}</p>`,
      buttons,
      close: () => resolve(null)
    }).render(true);
  });
}

// Shed: 변신 중 피해를 입으면 변신을 풀어 그 피해를 무효화할 수 있다.
// hit-trigger.js의 피격 시 무효화 후보 목록에 끼워 넣는 방식으로 동작한다
// (자세한 설계는 features/hit-trigger.js 참고). 변신 중이 아니면 애초에
// 후보로 잡히지 않는다 — 피격은 무브를 소유한 캐릭터가 전투 내내 계속
// 겪는 흔한 이벤트라 다른 무브들과 달리 "조건 미충족" 채팅 알림을 매번
// 띄우면 지나치게 시끄러워지므로 조용히 생략한다.
export function getShedCandidate(actor) {
  if (!isEnabled()) return null;
  if (!isShapeshiftActive(actor)) return null;

  const move = getShedMove(actor);
  if (!move) return null;
  return { name: move.name, effect: "shed" };
}

export async function applyShed(actor, damage) {
  const move = getShedMove(actor);
  const moveName = move?.name ?? "Shed";
  await revertShapeshift(actor, { silent: true });
  announceActionApplied(actor, moveName, game.i18n.format("DWAUTO.Druid.ShedApplied", { damage }));
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

  await applyFormshaperOnShapeshiftStart(actor);
  await applyFormcrafterOnShapeshiftStart(actor);
}

// Shed가 피해를 무효화하며 변신을 해제할 때는 { silent: true }로 호출해서
// "변신 해제" 자체의 알림 대신 Shed 전용 알림만 남긴다(applyShed 참고).
export async function revertShapeshift(actor, { silent = false } = {}) {
  const moveName = getShapeshifterMove(actor)?.name ?? "Shapeshifter";
  const state = getShapeshiftState(actor);
  await actor.setFlag(MODULE_ID, SHAPESHIFT_FLAG, { ...state, active: false });
  await revertFormshaperOnShapeshiftEnd(actor);
  await clearFormcrafterOnShapeshiftEnd(actor);
  if (!silent) announceActionApplied(actor, moveName, game.i18n.localize("DWAUTO.Druid.ShapeshiftReverted"));
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

// 변신 탭의 GM 초기화 버튼에서 호출한다 — 변신 상태와 활성화 여부, 그리고
// 여기 딸려 있는 Formshaper/Formcrafter 선택까지 전부 지워서, 다시 변신
// 무브를 굴려야 탭이 나타나는 상태로 되돌린다.
export async function resetShapeshift(actor) {
  // Formshaper가 "장갑" 선택으로 올려둔 장갑 값이 있으면 먼저 원래대로
  // 되돌린 뒤에 플래그를 지운다(그냥 플래그만 지우면 장갑 +1이 영구히
  // 남는다).
  await revertFormshaperOnShapeshiftEnd(actor);
  await clearFormcrafterOnShapeshiftEnd(actor);
  await actor.unsetFlag(MODULE_ID, SHAPESHIFT_ACTIVATED_FLAG);
  await actor.unsetFlag(MODULE_ID, SHAPESHIFT_FLAG);
}

// 캐릭터 시트 공용 탭에 변신 상태 섹션을 그려 넣는다: 지정/비지정 배지 +
// 동물 이름 표시 + GM이 자유롭게 적고 지울 수 있는 메모란.
// Formcrafter가 지금 고른 보너스/페널티 능력치, Formshaper가 지금 고른
// 장갑/피해 선택을 사람이 읽을 수 있는 한 줄로 만든다. 무브가 없거나
// 아직 아무것도 고르지 않았으면(변신 중이 아니라 Formshaper 선택 자체가
// 없는 경우 등) 그 줄 자체를 만들지 않는다.
function buildFormcrafterSummaryLine(actor) {
  const move = getFormcrafterMove(actor);
  if (!move) return null;

  const stats = getFormcrafterStats(actor);
  if (!stats?.bonus) return game.i18n.format("DWAUTO.Druid.FormcrafterSummaryPending", { move: move.name });

  const penaltyLabel = stats.penalty ? abilityLabel(stats.penalty) : game.i18n.localize("DWAUTO.Druid.FormcrafterPenaltyPending");
  return game.i18n.format("DWAUTO.Druid.FormcrafterSummary", {
    move: move.name,
    bonus: abilityLabel(stats.bonus),
    penalty: penaltyLabel
  });
}

function buildFormshaperSummaryLine(actor) {
  const move = getFormshaperMove(actor);
  if (!move) return null;

  const choice = getFormshaperChoice(actor);
  if (!choice) return null;

  const choiceLabel = game.i18n.localize(
    choice === "armor" ? "DWAUTO.Druid.FormshaperArmorOption" : "DWAUTO.Druid.FormshaperDamageOption"
  );
  return game.i18n.format("DWAUTO.Druid.FormshaperSummary", { move: move.name, choice: choiceLabel });
}

export function renderShapeshiftSection($body, actor) {
  const state = getShapeshiftState(actor);
  const label = state.active
    ? game.i18n.format("DWAUTO.Druid.ShapeshiftActiveLabel", { animal: state.animalName || "?" })
    : game.i18n.localize("DWAUTO.Druid.ShapeshiftInactiveLabel");

  const summaryLines = [buildFormcrafterSummaryLine(actor), buildFormshaperSummaryLine(actor)].filter(Boolean);
  const summaryHtml = summaryLines.length
    ? `<ul class="dwauto-shapeshift-summary">${summaryLines.map((line) => `<li>${line}</li>`).join("")}</ul>`
    : "";

  const $section = $(`
    <div class="cell dwauto-druid-shapeshift">
      <h2 class="cell__title">${game.i18n.localize("DWAUTO.Druid.ShapeshiftTitle")}</h2>
      <a class="tag dwauto-shapeshift-badge${state.active ? " dwauto-shapeshift-on" : ""}" title="${game.i18n.localize("DWAUTO.Druid.ShapeshiftToggleTitle")}">${label}</a>
      ${summaryHtml}
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

// 이 클라이언트가 GM이면 Formcrafter의 마스터 쪽 능력치 선택 요청을 받아
// 대화상자를 띄운다(healing.js의 GM 승인 요청과 같은 방식 — 여러 GM이
// 접속해 있으면 전부에게 뜬다).
function onSocketEvent(data) {
  if (data?.type !== "formcrafterGmChoiceRequest") return;
  if (!game.user.isGM) return;

  const actor = game.actors.get(data.actorId);
  if (!actor) return;

  promptFormcrafterGmChoice(actor, data.moveName);
}

export function registerDruidAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_NAME, onSocketEvent);
  });
}
