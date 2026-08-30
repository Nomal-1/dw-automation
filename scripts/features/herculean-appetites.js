import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { clearPendingRollBonus } from "../lib/roll-bonus-state.js";
import {
  isHeraclesAskMode,
  setHeraclesAskMode,
  isHeraclesActive,
  setHeraclesActive
} from "../lib/heracles-state.js";

const ELIGIBLE_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

// 야만전사 고급액션 헤라클레스의 욕망(Herculean Appetites) 원문: "욕망을 두
// 가지 고르십시오. 욕망을 쫓아 액션을 할 때, 2d6 대신 1d6+1d8로 판정합니다.
// 1d6이 1d8보다 높으면 마스터가 곤란한 상황/위험을 얘기해 줍니다."
//
// 던전월드 시스템은 항상 2d6을 굴리도록 굳어 있어서(이 모듈이 rollMod/
// rollType은 바꿔치기할 수 있어도 주사위 개수 자체는 못 바꾼다), 이 무브가
// 적용되는 판정은 시스템의 원래 굴림 경로를 아예 타지 않고
// features/counterspell.js와 같은 방식으로 이 모듈이 직접 굴려서, 다른
// 자동화(공격 도우미, 피격 무효화 등)가 계속 정상적으로 인식하도록
// lib/move-card.js가 기대하는 채팅 카드 구조(.chat-card.move-card,
// data-roll-total, .cell__title, .row.result.<success|partial|failure>)를
// 그대로 맞춰서 만든다.
//
// "욕망을 쫓는 액션인지"는 매 판정마다 서사적 판단이 필요해서 기본은 매번
// 물어보고(묻기 모드), 귀찮으면 "묻지 않기" 모드로 바꿔서 적용중/적용안됨
// 토글 상태를 그대로 쓰게 할 수 있다. 두 토글 다 플레이어/마스터 누구나
// 조정할 수 있다(정밀 태그 토글과 같은 이유 — 개인 판단 영역이라 GM 전용으로
// 막을 이유가 없다).
function isEnabled() {
  return (
    game.system.id === "dungeonworld" &&
    game.settings.get(MODULE_ID, SETTINGS.ENABLE_HERCULEAN_APPETITES_ASSISTANT)
  );
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findMove(actor) {
  const names = splitCommaList(SETTINGS.HERCULEAN_APPETITES_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function formatModifier(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

// 시스템 rolls.js의 유리/불리 처리(module/rolls.js 약 260~304줄)를 그대로
// 재현한다: flags.dungeonworld.rollMode(adv/dis/def)를 읽고, disDebility
// 설정이 켜져 있고 해당 능력치에 약화가 있으면 유리는 상쇄되고(→def) 그 외엔
// 불리로 강제 전환된다. 시스템은 이 로직을 "2d6" 또는 아무 d6 항목에나
// 적용하는데, 이 무브의 판정식 1d6+1d8은 두 주사위 종류가 달라 그대로 못
// 쓴다 — GM 요청에 따라 불리는 원래처럼 d6 쪽에(2d6kl1), 유리는 d8 쪽에
// (2d8kh1) 적용하기로 정했다(약한 주사위는 더 깎이고, 강한 주사위는 더
// 살아나는 방향).
function getEffectiveRollMode(actor, effectiveAbility) {
  const original = actor.flags?.dungeonworld?.rollMode ?? "def";
  let mode = original;
  const debilityActive = actor.system.abilities?.[effectiveAbility]?.debility ?? false;
  if (game.settings.get("dungeonworld", "disDebility") && debilityActive) {
    mode = mode === "adv" ? "def" : "dis";
  }
  const rollModeUsed = original !== "def" || mode !== "def";
  return { mode, rollModeUsed };
}

function buildDiceFormula(mode) {
  if (mode === "adv") return "1d6+2d8kh1";
  if (mode === "dis") return "2d6kl1+1d8";
  return "1d6+1d8";
}

async function performHerculeanRoll(item, actor, effectiveAbility, totalMod, pendingBonus, pendingBonusApplies) {
  const abilityMod = Number(actor.system.abilities?.[effectiveAbility]?.mod) || 0;
  const ownRollMod = Number(item.system?.rollMod) || 0;
  const forward = Number(actor.system.attributes?.forward?.value) || 0;
  const ongoing = Number(actor.system.attributes?.ongoing?.value) || 0;
  const flatMod = abilityMod + ownRollMod + totalMod + forward + ongoing;

  const { mode: rollMode, rollModeUsed } = getEffectiveRollMode(actor, effectiveAbility);
  const formula = `${buildDiceFormula(rollMode)}${flatMod ? formatModifier(flatMod) : ""}`;
  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();

  const d6 = roll.dice.find((d) => d.faces === 6)?.total ?? 0;
  const d8 = roll.dice.find((d) => d.faces === 8)?.total ?? 0;
  const total = roll.total;
  const result = total >= 10 ? "success" : total >= 7 ? "partial" : "failure";

  // 시스템과 동일하게, 유리/불리 토글을 소모했고(rollModeUsed) 세계 설정
  // advForward(유리/불리도 forward처럼 한 판정만 유지)가 켜져 있으면 사용 후
  // 플래그를 def로 되돌린다(module/rolls.js 407~415줄과 동일한 조건).
  const updates = {};
  if (forward) updates["system.attributes.forward.value"] = 0;
  if (rollModeUsed && game.settings.get("dungeonworld", "advForward")) {
    updates["flags.dungeonworld.rollMode"] = "def";
  }
  if (Object.keys(updates).length) {
    await actor.update(updates);
  }

  const rollHtml = await roll.render();
  const resultText = item.system?.moveResults?.[result]?.value ?? "";
  const choicesText = item.system?.choices ?? "";

  // move-card.js의 getMoveCardInfo는 $(message.content).find(".chat-card.move-card")로
  // 카드를 찾는데, jQuery의 .find()는 최상위 요소 자체는 뒤지지 않고 그
  // 자식만 검색한다(던전월드 시스템의 실제 템플릿도 <section> 안에
  // .chat-card.move-card를 넣는 구조라 이게 항상 통했다). 여기서 감싸는
  // <section> 없이 .chat-card.move-card를 최상위로 바로 만들면 다른 모든
  // 자동화(공격 도우미, 피격 무효화 등)가 이 카드를 영원히 못 찾는다 —
  // 반드시 한 겹 감싸야 한다.
  const content = `
    <section>
      <div class="chat-card move-card" data-roll-total="${total}">
        <h2 class="cell__title">${item.name}</h2>
        ${rollHtml}
        <div class="row result ${result}">
          <div class="cell result-text">${resultText}${choicesText}</div>
        </div>
      </div>
    </section>
  `;

  const chatData = { user: game.user.id, speaker: ChatMessage.getSpeaker({ actor }), content };
  if (game.dice3d) {
    await game.dice3d.showForRoll(roll, game.user, true, null, false);
  } else {
    chatData.sound = CONFIG.sounds.dice;
  }
  await ChatMessage.create(chatData);

  if (d6 > d8) {
    announceActionApplied(actor, item.name, game.i18n.localize("DWAUTO.HerculeanAppetites.DangerNote"));
  }

  if (pendingBonusApplies) {
    await clearPendingRollBonus(actor);
    const signed = pendingBonus.amount >= 0 ? `+${pendingBonus.amount}` : `${pendingBonus.amount}`;
    announceActionApplied(
      actor,
      item.name,
      game.i18n.format("DWAUTO.RollBonus.Consumed", { amount: signed, source: pendingBonus.source })
    );
  }
}

// lib/roll-wrapper.js가 다른 보정치를 전부 계산한 뒤(totalMod 확정 직후)
// 호출한다. 이 무브가 없거나, 대상 판정이 능력치 판정(str/dex/con/int/wis/cha,
// bond·ask·서술형 등은 제외)이 아니거나, 적용하지 않기로 했으면
// { handled: false }를 돌려줘서 원래 굴림이 그대로 진행되게 한다.
export async function maybeRollHerculeanAppetites(
  item,
  { effectiveAbility, totalMod, pendingBonus, pendingBonusApplies }
) {
  if (!isEnabled()) return { handled: false };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { handled: false };
  if (!ELIGIBLE_ABILITIES.includes(effectiveAbility)) return { handled: false };

  const moveItem = findMove(actor);
  if (!moveItem) return { handled: false };

  let apply;
  if (isHeraclesAskMode(actor)) {
    apply = await Dialog.confirm({
      title: moveItem.name,
      content: `<p>${game.i18n.localize("DWAUTO.HerculeanAppetites.Prompt")}</p>`,
      defaultYes: false
    });
    // 물어봤을 때의 답을 적용중/적용안됨 배지에도 그대로 반영해둔다 — 나중에
    // "묻지 않기" 모드로 바꾸면 그 시점의 마지막 답이 그대로 이어진다.
    await setHeraclesActive(actor, apply);
  } else {
    apply = isHeraclesActive(actor);
  }
  if (!apply) return { handled: false };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.HerculeanAppetites.Applied"));
  await performHerculeanRoll(item, actor, effectiveAbility, totalMod, pendingBonus, pendingBonusApplies);
  return { handled: true };
}

// 무브 옆에 배지 두 개를 붙인다: 묻기/묻지않기 모드, 적용중/적용안됨 상태.
// 둘 다 플레이어/마스터 누구나 클릭할 수 있다.
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-heracles-ask-badge, .dwauto-heracles-active-badge").remove();

  const askMode = isHeraclesAskMode(actor);
  const $askBadge = $(
    `<a class="tag dwauto-heracles-ask-badge${!askMode ? " dwauto-heracles-on" : ""}" title="${game.i18n.localize("DWAUTO.HerculeanAppetites.AskToggleTitle")}">${game.i18n.localize(askMode ? "DWAUTO.HerculeanAppetites.AskOn" : "DWAUTO.HerculeanAppetites.AskOff")}</a>`
  );
  $tags.append($askBadge);
  $askBadge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setHeraclesAskMode(actor, !askMode);
  });

  const active = isHeraclesActive(actor);
  const $activeBadge = $(
    `<a class="tag dwauto-heracles-active-badge${active ? " dwauto-heracles-on" : ""}" title="${game.i18n.localize("DWAUTO.HerculeanAppetites.ActiveToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.HerculeanAppetites.Active" : "DWAUTO.HerculeanAppetites.Inactive")}</a>`
  );
  $tags.append($activeBadge);
  $activeBadge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setHeraclesActive(actor, !active);
  });
}

export function registerHerculeanAppetitesAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
