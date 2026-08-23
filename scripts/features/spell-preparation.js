import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { DEFAULT_PREPARE_SPELLS_MOVES } from "../data/prepare-spells-moves.js";
import { getDiscountedSpellIds } from "./spell-discount.js";
import { getFirstAidDiscountedSpellIds } from "./first-aid.js";
import { COMMUNE_PENALTY_FLAG } from "../lib/ongoing-spells-state.js";
import { getHold, setHold } from "../lib/divine-hold-state.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { promptActorMultiTarget } from "../lib/actor-target-picker.js";
import { setProtectedAllies } from "../lib/divine-protection-state.js";

// 위저드 Prepare Spells / 클레릭 Commune 자동화. 원문: "시간을 들여 명상/기원하면
// 지금까지 준비/부여받은 주문을 전부 잃고, 스펠북에서 새로 고른다 — 고른 주문의
// 레벨 합은 (자기 레벨+1)을 넘을 수 없고, 0레벨 주문(칸트립/로트)은 이 한도에
// 안 들어가며 자동으로 전부 준비된다." 자세한 근거는 data/prepare-spells-moves.js
// 참고. 이 무브는 굴림이 없는 서술형 무브라(대지의 아들/딸, Quest와 같은 부류)
// features/class-grant.js와 같은 방식으로 결과(성공/부분성공)를 따지지 않고
// 채팅 카드 제목만으로 반응한다.
//
// 이 자동화가 다루는 system.prepared 필드는 features/spellcasting.js의
// "주문 시전(Cast a Spell/Cast A Spell)" 선택 목록이 이미 그대로 참조하고
// 있어서, 여기서 준비 상태를 갱신하면 그 목록도 즉시 갱신된 결과를 보여준다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELL_PREPARATION_ASSISTANT);
}

function getRows() {
  return game.settings.get(MODULE_ID, SETTINGS.PREPARE_SPELLS_MOVES);
}

function getActorLevel(actor) {
  return Number(actor.system?.attributes?.level?.value) || 1;
}

// 클레릭 신의 개입(Divine Intervention)/신의 불멸(Divine Invincibility)
// 전용: 기원(Commune)이 실제로 발동될 때마다 hold를 이 값으로 덮어쓴다
// (누적이 아니라 "이전 hold는 소멸" — data/hold-grant-moves.js 참고). 위저드
// Prepare Spells를 발동한 경우는 이 무브 자체를 가질 수 없으므로 자연히
// 아무 일도 일어나지 않는다.
// features/hit-trigger.js도 아군 보호 후보를 만들 때 이 함수로 "이 캐릭터가
// 신의 보우/가호 중 무엇을 가졌는지"(표시용 이름)를 그대로 재사용한다.
export function getHoldGrantRow(actor) {
  const rows = game.settings.get(MODULE_ID, SETTINGS.HOLD_GRANT_MOVES);
  return rows.find((row) => actor.items.some((i) => i.type === "move" && i.name === row.name)) ?? null;
}

// 위저드 천재(Prodigy)/대가(Master)로 골라둔 주문은 준비 시 레벨을 1 낮춰서
// 계산한다(features/spell-discount.js 참고) — 레벨 1 주문이 할인되면 0이
// 되어 칸트립처럼 항상 무료로 준비된다. 반면 클레릭 응급처치/상급 응급처치가
// 고정으로 지정하는 주문(features/first-aid.js)은 원문이 "한 레벨 낮게
// 취급"이 아니라 "그 주문 자체가 암송주문(칸트립)"이라, 레벨이 몇이든
// 무조건 0으로 만든다(상급 응급처치의 치유는 2레벨이라 -1만 해서는 1레벨로
// 남아 한도 계산에 계속 들어가는 버그가 있었다) — reduction을 Infinity로
// 두면 raw가 몇이든 Math.max(0, raw - Infinity)가 항상 0이 되어 간단히
// 해결된다.
function effectiveSpellLevel(spell, discountMap) {
  const raw = Number(spell.system?.spellLevel) || 0;
  const reduction = discountMap.get(spell.id);
  return reduction !== undefined ? Math.max(0, raw - reduction) : raw;
}

function getAllDiscountedSpellIds(actor) {
  const discountMap = new Map();
  for (const id of getDiscountedSpellIds(actor)) discountMap.set(id, 1);
  for (const id of getFirstAidDiscountedSpellIds(actor)) discountMap.set(id, Infinity);
  return discountMap;
}

// 설정("주문 준비 무브")에 등록된 이름과 채팅 카드 제목을 비교한다. 설정값이
// 아직 번역 전(영문 기본값)이어도, 지금 이 시점의 번역 데이터로 다시 한번
// 확인한다(features/class-grant.js와 같은 방식).
async function matchesConfiguredRow(title) {
  const rows = getRows();
  const direct = rows.find((r) => r.name === title);
  if (direct) return direct;

  try {
    const nameMap = await getMoveNameMap();
    for (const defaultRow of DEFAULT_PREPARE_SPELLS_MOVES) {
      if (nameMap.get(defaultRow.name) === title) {
        return rows.find((r) => r.name === defaultRow.name) ?? defaultRow;
      }
    }
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return null;
}

// 레벨 1 이상인 주문 중에서 고를 수 있는 목록을 보여주고, 고른 주문들의 레벨
// 합이 한도(자기 레벨+1)를 넘지 않게 실시간으로 제한한다. 취소하면 null.
function promptSpellPreparation(actor, moveItem, row) {
  const discountedIds = getAllDiscountedSpellIds(actor);
  const allSpells = actor.items.filter((i) => i.type === "spell");
  const cantrips = allSpells.filter((s) => effectiveSpellLevel(s, discountedIds) === 0);
  const level = getActorLevel(actor);
  const budget = level + 1;
  const cap = row.enforceIndividualLevelCap ? level : Infinity;

  const eligible = allSpells
    .filter((s) => effectiveSpellLevel(s, discountedIds) > 0 && effectiveSpellLevel(s, discountedIds) <= cap)
    .sort((a, b) => effectiveSpellLevel(a, discountedIds) - effectiveSpellLevel(b, discountedIds) || a.name.localeCompare(b.name));
  const tooHigh = allSpells.filter((s) => effectiveSpellLevel(s, discountedIds) > cap && effectiveSpellLevel(s, discountedIds) > 0);

  const rowsHtml = eligible
    .map((s) => {
      const eff = effectiveSpellLevel(s, discountedIds);
      const rawLevel = Number(s.system?.spellLevel) || 0;
      const levelLabel =
        eff !== rawLevel
          ? `${game.i18n.format("DWAUTO.PrepareSpells.DiscountedLevelLabel", { raw: rawLevel, effective: eff })}`
          : `Lv.${rawLevel}`;
      return `
      <label style="display:block;margin:2px 0;">
        <input type="checkbox" data-level="${eff}" value="${s.id}" ${s.system.prepared ? "checked" : ""}>
        ${s.name} (${levelLabel})
      </label>`;
    })
    .join("");

  const cantripNote = cantrips.length
    ? `<p class="notes">${game.i18n.format("DWAUTO.PrepareSpells.CantripNote", { names: cantrips.map((c) => c.name).join(", ") })}</p>`
    : "";
  const tooHighNote =
    row.enforceIndividualLevelCap && tooHigh.length
      ? `<p class="notes">${game.i18n.format("DWAUTO.PrepareSpells.TooHighNote", { names: tooHigh.map((c) => c.name).join(", ") })}</p>`
      : "";

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <p>${game.i18n.format("DWAUTO.PrepareSpells.Instruction", { budget })}</p>
          <p><strong>${game.i18n.localize("DWAUTO.PrepareSpells.TotalLabel")} <span data-total>0</span> / ${budget}</strong></p>
          <div style="max-height:280px;overflow-y:auto;">
            ${rowsHtml || `<p class="notes">${game.i18n.localize("DWAUTO.PrepareSpells.NoEligible")}</p>`}
          </div>
          ${cantripNote}
          ${tooHighNote}
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const chosen = html
              .find('input[type="checkbox"]:checked')
              .map((_, el) => el.value)
              .get();
            resolve(new Set(chosen));
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      width: 420,
      render: (html) => {
        const $checks = html.find('input[type="checkbox"]');
        const $total = html.find("[data-total]");
        const update = () => {
          let sum = 0;
          $checks.each((_, el) => {
            if (el.checked) sum += Number(el.dataset.level);
          });
          $total.text(sum);
          $checks.each((_, el) => {
            if (!el.checked) el.disabled = sum + Number(el.dataset.level) > budget;
          });
          return sum;
        };

        // 이미 준비되어 있던 주문(초기 체크 상태)의 레벨 합이 새 한도를 넘을 수
        // 있다(캐릭터 레벨이 내려갔거나, 개별 레벨 제한이 새로 켜진 경우 등).
        // 창을 열자마자 뒤에서부터 자동으로 체크를 해제해 항상 유효한 상태로
        // 시작한다.
        let sum = update();
        if (sum > budget) {
          const checkedEls = $checks.toArray().filter((el) => el.checked).reverse();
          for (const el of checkedEls) {
            if (sum <= budget) break;
            el.checked = false;
            sum -= Number(el.dataset.level);
          }
          update();
        }

        $checks.on("change", update);
      },
      close: () => resolve(null)
    }).render(true);
  });
}

// "지금까지 준비된 주문을 전부 잃는다" + "칸트립/로트는 무조건 준비"를 한 번에
// 반영한다 — 액터의 모든 주문을 훑어서, 골랐거나(chosenIds) 0레벨이면
// prepared를 true로, 나머지는 전부 false로 맞춘다(한도 초과로 목록에서 아예
// 빠졌던 주문도 여기서 자동으로 준비 해제된다).
//
// Cast a Spell 부분성공(7-9)에서 "서약 페널티"(다음 기원/주문 준비까지 -1)를
// 고른 적이 있으면(features/spellcasting.js의 addCommunePenalty), 원문
// 그대로 "다음 Prepare Spells/Commune까지"이므로 여기서 실제로 다시
// 준비/기원한 시점에 그 페널티를 0으로 초기화한다 — 이전에는 이 자동화가
// system.prepared만 바꾸고 이 페널티는 그대로 둬서, 캐릭터 시트의 배너를
// 수동으로 눌러 지우기 전까지 영원히 남아있는 버그가 있었다.
async function applySelection(actor, chosenIds) {
  const discountedIds = getAllDiscountedSpellIds(actor);
  const allSpells = actor.items.filter((i) => i.type === "spell");
  const updates = [];
  const preparedNames = [];

  for (const spell of allSpells) {
    const isCantrip = effectiveSpellLevel(spell, discountedIds) === 0;
    const shouldBePrepared = isCantrip || chosenIds.has(spell.id);
    if (shouldBePrepared) preparedNames.push(spell.name);
    if (Boolean(spell.system?.prepared) !== shouldBePrepared) {
      updates.push({ _id: spell.id, "system.prepared": shouldBePrepared });
    }
  }

  if (updates.length > 0) {
    await actor.updateEmbeddedDocuments("Item", updates);
  }

  if (actor.getFlag(MODULE_ID, COMMUNE_PENALTY_FLAG)) {
    await actor.unsetFlag(MODULE_ID, COMMUNE_PENALTY_FLAG);
  }

  return preparedNames;
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title } = info;
    if (actor.type !== "character") return;

    const row = await matchesConfiguredRow(title);
    if (!row) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const chosenIds = await promptSpellPreparation(actor, moveItem, row);
    if (!chosenIds) return; // 취소 — 아무것도 바꾸지 않는다.

    const preparedNames = await applySelection(actor, chosenIds);
    announceActionApplied(
      actor,
      moveItem.name,
      preparedNames.length > 0
        ? game.i18n.format("DWAUTO.PrepareSpells.Prepared", { spells: preparedNames.join(", ") })
        : game.i18n.localize("DWAUTO.PrepareSpells.PreparedNone")
    );

    const holdGrantRow = getHoldGrantRow(actor);
    if (holdGrantRow) {
      await setHold(actor, holdGrantRow.holdAmount);
      announceActionApplied(
        actor,
        holdGrantRow.name,
        game.i18n.format("DWAUTO.PrepareSpells.HoldGranted", { amount: holdGrantRow.holdAmount })
      );

      // 원문 "you or an ally" 중 "아군" 쪽: 자기 자신은 features/hit-trigger.js의
      // 기존 "hold" 효과가 이미 처리하므로, 여기서는 그 예비로 추가로 지켜줄
      // 아군만 고른다(0명이어도 된다 — 자기 자신 보호는 그대로 유지된다).
      // 예배를 다시 올릴 때마다 이 선택도 새로 덮어쓴다(예비 자체가 리셋되는
      // 시점과 같다).
      const allies = await promptActorMultiTarget(actor, {
        title: holdGrantRow.name,
        label: game.i18n.localize("DWAUTO.PrepareSpells.ProtectAlliesLabel"),
        excludeSelf: true,
        filter: (a) => a.type === "character"
      });
      await setProtectedAllies(actor, allies.map((a) => a.id));
      if (allies.length > 0) {
        announceActionApplied(
          actor,
          holdGrantRow.name,
          game.i18n.format("DWAUTO.PrepareSpells.ProtectedAllies", { names: allies.map((a) => a.name).join(", ") })
        );
      }
    }
  } catch (err) {
    console.error(`${MODULE_ID} | spell-preparation: onCreateChatMessage failed`, err);
  }
}

// 클레릭 신의 개입/신의 불멸을 실제로 가진 캐릭터의 시트에 지금 hold가
// 몇 개인지 배지로 보여준다. GM 요청에 따라, 이 값은 플레이어가 스스로
// 조정할 수 없는 GM 전용 판정 자원이라(hold를 "언제 쓸지"는 피격 시
// 무효화 대화상자에서 이미 자동으로 소비되지만, GM이 서사적 판단으로
// 직접 늘리거나 줄여야 하는 경우가 있다) 배지 자체는 누구나 보이지만
// +1/-1 조정 버튼은 GM에게만 보인다.
function onRenderActorSheet(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const row = getHoldGrantRow(actor);
  if (!row) return;

  const moveItem = actor.items.find((i) => i.type === "move" && i.name === row.name);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  if ($tags.find(".dwauto-hold-badge").length) return;

  const hold = getHold(actor);
  const $badge = $(
    `<a class="tag dwauto-hold-badge" title="${game.i18n.localize("DWAUTO.PrepareSpells.HoldBadgeTitle")}">${game.i18n.format("DWAUTO.PrepareSpells.HoldBadge", { hold })}</a>`
  );
  $tags.append($badge);

  if (!game.user.isGM) return; // 플레이어는 표시만 — 조정 버튼은 GM에게만 붙인다.

  const $minus = $(
    `<a class="tag dwauto-hold-adjust" title="${game.i18n.localize("DWAUTO.PrepareSpells.HoldMinusTitle")}">-1</a>`
  );
  const $plus = $(
    `<a class="tag dwauto-hold-adjust" title="${game.i18n.localize("DWAUTO.PrepareSpells.HoldPlusTitle")}">+1</a>`
  );
  $tags.append($minus).append($plus);

  $minus.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setHold(actor, Math.max(0, getHold(actor) - 1));
  });
  $plus.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setHold(actor, getHold(actor) + 1);
  });
}

export function registerSpellPreparationAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
