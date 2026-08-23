import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { getMoveChoiceData, promptChoiceSelection } from "../lib/move-choices.js";
import { announceActionApplied } from "../lib/announce.js";
import {
  addActiveOngoingSpell,
  removeActiveOngoingSpell,
  getActiveOngoingSpells,
  COMMUNE_PENALTY_FLAG
} from "../lib/ongoing-spells-state.js";
import { handleSpellHeal } from "./healing.js";
import { handleSpellDamage } from "./spell-damage.js";

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// features/counterspell.js도 재사용한다(주문 차단 부분성공 시 건 주문을 잊는
// 것과 완전히 같은 동작이라 — "system.prepared: false로 바꾸고 알린다").
export async function promptRevokeSpell(actor, spell) {
  await spell.update({ "system.prepared": false });
  announceActionApplied(actor, spell.name, game.i18n.localize("DWAUTO.Spell.Revoked"));
}

async function addCommunePenalty(actor) {
  const current = Number(actor.getFlag(MODULE_ID, COMMUNE_PENALTY_FLAG)) || 0;
  await actor.setFlag(MODULE_ID, COMMUNE_PENALTY_FLAG, current + 1);
  announceActionApplied(actor, actor.name, game.i18n.localize("DWAUTO.Spell.CommunePenaltyApplied"));
}

// 액터가 실제로 갖고 있는 주문 강화류 무브를 찾는다(있으면 { row, moveItem },
// 없으면 null). 상급형은 move-upgrades.js에 "대체" 관계로 이미 등록돼 있어서
// 기본형+상급형을 동시에 갖는 일은 없다.
function getEmpowerRow(actor) {
  const rows = game.settings.get(MODULE_ID, SETTINGS.EMPOWER_MOVES);
  for (const row of rows) {
    const moveItem = findMoveItem(actor, row.name);
    if (moveItem) return { row, moveItem };
  }
  return null;
}

// 위저드 주문 강화/상급 주문 강화, 클레릭 강화/상급 강화 원문: "주문 시전이
// 10+(상급은 10-11)로 성공하면, 7-9 목록에서 하나를 겪는 대가로 강화 효과
// 둘 중 하나를 추가로 고를 수 있다(상급은 12+면 대가 없이 공짜)." GM 지시에
// 따라: 먼저 적용할지 묻고, 적용하면 강화 효과 → 디메리트 순서로 두 번
// 고르게 한다(상급+12+는 디메리트 단계를 건너뛴다). 강화 효과 자체(효과
// 극대화/대상 2배)는 GM 서술 영역이라 채팅에 남기는 것까지만 자동화하고,
// 디메리트는 Cast a Spell 부분성공 처리와 완전히 같은 방식으로 실제 효과
// (주문 잊음/서약 페널티)까지 적용한다.
async function promptEmpowerFlow(actor, castMoveItem, spell, empower, isExtreme) {
  const { row, moveItem: empowerMoveItem } = empower;

  const confirmed = await Dialog.confirm({
    title: empowerMoveItem.name,
    content: `<p>${game.i18n.format("DWAUTO.Empower.ConfirmContent", { move: empowerMoveItem.name })}</p>`,
    defaultYes: false
  });
  if (!confirmed) {
    announceActionApplied(actor, empowerMoveItem.name, game.i18n.localize("DWAUTO.Empower.NotApplied"));
    return;
  }

  const { options: effectOptions } = getMoveChoiceData(empowerMoveItem, "success");
  if (effectOptions.length === 0) return;

  const chosenEffect = await new Promise((resolve) => {
    promptChoiceSelection({
      title: empowerMoveItem.name,
      instruction: game.i18n.localize("DWAUTO.Empower.EffectInstruction"),
      options: effectOptions,
      count: 1,
      onConfirm: (selected) => resolve(selected[0]),
      onCancel: () => resolve(null)
    });
  });
  if (!chosenEffect) return; // 취소 — 아무것도 적용하지 않는다.

  if (row.isGreater && isExtreme) {
    announceActionApplied(
      actor,
      empowerMoveItem.name,
      game.i18n.format("DWAUTO.Empower.AppliedFree", { effect: chosenEffect })
    );
    return;
  }

  const { options: demeritOptions } = getMoveChoiceData(castMoveItem, "partial");
  if (demeritOptions.length === 0) {
    announceActionApplied(
      actor,
      empowerMoveItem.name,
      game.i18n.format("DWAUTO.Empower.AppliedNoDemerit", { effect: chosenEffect })
    );
    return;
  }

  const revokeIndex = Number(game.settings.get(MODULE_ID, SETTINGS.CAST_PARTIAL_REVOKE_INDEX)) || 0;
  const penaltyIndex = Number(game.settings.get(MODULE_ID, SETTINGS.CAST_PARTIAL_PENALTY_INDEX)) || 0;

  promptChoiceSelection({
    title: empowerMoveItem.name,
    instruction: game.i18n.localize("DWAUTO.Empower.DemeritInstruction"),
    options: demeritOptions,
    count: 1,
    onConfirm: async (selected, indexes) => {
      const picked = indexes[0];
      announceActionApplied(
        actor,
        empowerMoveItem.name,
        game.i18n.format("DWAUTO.Empower.Applied", { effect: chosenEffect, demerit: selected[0] })
      );

      if (picked === revokeIndex) {
        await promptRevokeSpell(actor, spell);
      } else if (picked === penaltyIndex) {
        await addCommunePenalty(actor);
      }
    }
  });
}

// Cast a Spell 부분성공(7-9)의 "선택지 중 하나를 고르시오"를 그대로 반영한다:
// 원치 않는 주목/다음 기원까지 -1/주문 회수, 셋 중 하나. 어느 게 회수/페널티
// 옵션인지는 텍스트로 판별하면 번역에 깨지므로, 설정에 몇 번째 선택지인지를
// 숫자로 지정해두고 그걸로 판별한다.
function promptPartialConsequence(actor, moveItem, spell) {
  if (!moveItem) return;

  const { options } = getMoveChoiceData(moveItem, "partial");
  if (options.length === 0) return;

  const revokeIndex = Number(game.settings.get(MODULE_ID, SETTINGS.CAST_PARTIAL_REVOKE_INDEX)) || 0;
  const penaltyIndex = Number(game.settings.get(MODULE_ID, SETTINGS.CAST_PARTIAL_PENALTY_INDEX)) || 0;

  promptChoiceSelection({
    title: moveItem.name,
    instruction: game.i18n.localize("DWAUTO.Spell.PartialChoiceInstruction"),
    options,
    count: 1,
    onConfirm: async (selected, indexes) => {
      const picked = indexes[0];
      announceActionApplied(actor, moveItem.name, selected[0]);

      if (picked === revokeIndex) {
        await promptRevokeSpell(actor, spell);
      } else if (picked === penaltyIndex) {
        await addCommunePenalty(actor);
      }
    }
  });
}

// 준비된 주문(system.prepared === true) 중에서 실제로 사용할 주문을 고르게 한다.
function promptSpellChoice(actor, result, moveItem, isExtreme) {
  const prepared = actor.items.filter((i) => i.type === "spell" && i.system?.prepared);
  if (prepared.length === 0) {
    ui.notifications.warn(game.i18n.format("DWAUTO.Spell.NoPrepared", { name: actor.name }));
    return;
  }

  const options = prepared.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");

  new Dialog({
    title: game.i18n.localize("DWAUTO.Spell.ChooseTitle"),
    content: `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize("DWAUTO.Spell.ChooseLabel")}</label>
          <select name="spell">${options}</select>
        </div>
      </form>
    `,
    buttons: {
      ok: {
        label: game.i18n.localize("DWAUTO.Confirm"),
        callback: async (html) => {
          const spell = actor.items.get(html.find('[name="spell"]').val());
          if (!spell) return;

          const config = await addActiveOngoingSpell(actor, spell);
          if (config) {
            const penaltyLabel = game.i18n.localize(`DWAUTO.OngoingSpells.Penalty.${config.castPenalty}`);
            announceActionApplied(actor, spell.name, game.i18n.format("DWAUTO.Spell.NowOngoing", { penalty: penaltyLabel }));
          }

          await handleSpellHeal(actor, spell);
          await handleSpellDamage(actor, spell);

          if (result === "partial") {
            promptPartialConsequence(actor, moveItem, spell);
          } else if (result === "success") {
            const empower = getEmpowerRow(actor);
            if (empower) {
              promptEmpowerFlow(actor, moveItem, spell, empower, isExtreme);
            }
          }
        }
      },
      cancel: { label: game.i18n.localize("DWAUTO.Cancel") }
    },
    default: "ok"
  }).render(true);
}

function onCreateChatMessage(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELLCASTING_ASSISTANT)) return;
  // 굴린 사람의 클라이언트에서만 후속 다이얼로그를 띄운다.
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title, result, isExtreme } = info;
  if (result !== "success" && result !== "partial") return;

  const castNames = splitCommaList(SETTINGS.CAST_SPELL_MOVE_NAMES);
  if (!castNames.includes(title)) return;

  const moveItem = findMoveItem(actor, title);
  promptSpellChoice(actor, result, moveItem, isExtreme);
}

// 캐릭터 시트의 주문 목록에 "지속중" 배지를 붙이고, 클릭하면 종료 여부를 묻는다.
// 서약 페널티(다음 기원까지 -1)가 있으면 주문 탭 상단에 배너로 보여주고,
// 클릭하면 수동으로 초기화할 수 있게 한다 (기원/주문 준비 자동화가 아직 없어서
// 지금은 자동으로 사라지지 않는다).
function onRenderActorSheet(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELLCASTING_ASSISTANT)) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const active = getActiveOngoingSpells(actor);
  for (const spell of active) {
    const $item = html.find(`.item[data-item-id="${spell.itemId}"]`);
    if (!$item.length) continue;

    const $tags = $item.find(".item-meta.tags");
    if (!$tags.length || $tags.find(".dwauto-ongoing-badge").length) continue;

    const $badge = $(
      `<a class="tag dwauto-ongoing-badge" title="${game.i18n.localize("DWAUTO.Spell.OngoingBadgeTitle")}">${game.i18n.localize("DWAUTO.Spell.OngoingBadge")}</a>`
    );
    $tags.append($badge);

    $badge.on("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const confirmed = await Dialog.confirm({
        title: game.i18n.localize("DWAUTO.Spell.EndTitle"),
        content: `<p>${game.i18n.format("DWAUTO.Spell.EndContent", { name: spell.name })}</p>`,
        defaultYes: false
      });
      if (confirmed) {
        await removeActiveOngoingSpell(actor, spell.itemId);
      }
    });
  }

  const communePenalty = Number(actor.getFlag(MODULE_ID, COMMUNE_PENALTY_FLAG)) || 0;
  const $spellsCell = html.find(".cell--spells");
  if (communePenalty > 0 && $spellsCell.length && !$spellsCell.find(".dwauto-commune-penalty").length) {
    const $banner = $(
      `<div class="dwauto-commune-penalty">${game.i18n.format("DWAUTO.Spell.CommunePenaltyBanner", { amount: communePenalty })}</div>`
    );
    $spellsCell.prepend($banner);

    $banner.on("click", async () => {
      const confirmed = await Dialog.confirm({
        title: game.i18n.localize("DWAUTO.Spell.ClearCommunePenaltyTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.Spell.ClearCommunePenaltyContent")}</p>`,
        defaultYes: false
      });
      if (confirmed) {
        await actor.unsetFlag(MODULE_ID, COMMUNE_PENALTY_FLAG);
      }
    });
  }
}

export function registerSpellcastingAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
