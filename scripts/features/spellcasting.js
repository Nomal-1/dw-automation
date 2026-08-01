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
function promptSpellChoice(actor, result, moveItem) {
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

          if (result === "partial") {
            promptPartialConsequence(actor, moveItem, spell);
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
  const { actor, title, result } = info;
  if (result !== "success" && result !== "partial") return;

  const castNames = splitCommaList(SETTINGS.CAST_SPELL_MOVE_NAMES);
  if (!castNames.includes(title)) return;

  const moveItem = findMoveItem(actor, title);
  promptSpellChoice(actor, result, moveItem);
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
