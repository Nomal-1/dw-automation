import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { DEFAULT_PREPARE_SPELLS_MOVES } from "../data/prepare-spells-moves.js";

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
  const allSpells = actor.items.filter((i) => i.type === "spell");
  const cantrips = allSpells.filter((s) => Number(s.system?.spellLevel) === 0);
  const level = getActorLevel(actor);
  const budget = level + 1;
  const cap = row.enforceIndividualLevelCap ? level : Infinity;

  const eligible = allSpells
    .filter((s) => Number(s.system?.spellLevel) > 0 && Number(s.system.spellLevel) <= cap)
    .sort((a, b) => Number(a.system.spellLevel) - Number(b.system.spellLevel) || a.name.localeCompare(b.name));
  const tooHigh = allSpells.filter((s) => Number(s.system?.spellLevel) > 0 && Number(s.system.spellLevel) > cap);

  const rowsHtml = eligible
    .map(
      (s) => `
      <label style="display:block;margin:2px 0;">
        <input type="checkbox" data-level="${s.system.spellLevel}" value="${s.id}" ${s.system.prepared ? "checked" : ""}>
        ${s.name} (Lv.${s.system.spellLevel})
      </label>`
    )
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
async function applySelection(actor, chosenIds) {
  const allSpells = actor.items.filter((i) => i.type === "spell");
  const updates = [];
  const preparedNames = [];

  for (const spell of allSpells) {
    const isCantrip = Number(spell.system?.spellLevel) === 0;
    const shouldBePrepared = isCantrip || chosenIds.has(spell.id);
    if (shouldBePrepared) preparedNames.push(spell.name);
    if (Boolean(spell.system?.prepared) !== shouldBePrepared) {
      updates.push({ _id: spell.id, "system.prepared": shouldBePrepared });
    }
  }

  if (updates.length > 0) {
    await actor.updateEmbeddedDocuments("Item", updates);
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
  } catch (err) {
    console.error(`${MODULE_ID} | spell-preparation: onCreateChatMessage failed`, err);
  }
}

export function registerSpellPreparationAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
