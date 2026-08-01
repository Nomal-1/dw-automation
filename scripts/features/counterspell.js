import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { promptRevokeSpell } from "./spellcasting.js";

// 위저드 주문 차단(Counterspell)/마법 차폐(Protective Counter) 원문: "막으려는
// 순간, 준비된 주문 하나를 걸고 +INT 굴림. 부분성공(7-9)이면 건 주문을
// 잊는다(대신 자신만 보호됨), 성공(10+)이면 아무 손실 없이 완전히 막는다."
//
// 실제로 확인해보니 이 무브는 공식 컴펜디엄 데이터의 rollType이 비어있어서
// (직접 확인됨: 무브 목록에서 클릭해도 채팅 카드에 성공/부분성공 표시가
// 전혀 없이 서술형 카드만 뜬다) getMoveCardInfo로 결과를 자동 판정할 수
// 없다. 그래서 무브를 발동하면 (1) 어떤 준비된 주문을 걸지 고르게 하고,
// (2) 결과(성공/부분성공)를 직접 물어봐서 부분성공이면 건 주문을 잊게 한다
// (features/spellcasting.js의 promptRevokeSpell 재사용 — Cast a Spell 부분성공
// 소비와 완전히 같은 동작).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_COUNTERSPELL_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 준비된 주문 중 하나를 고르는 대화상자. 취소하면 null.
function promptStakeChoice(moveItem, preparedSpells) {
  const options = preparedSpells.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Counterspell.StakeLabel")}</label>
            <select name="spell">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => resolve(html.find('[name="spell"]').val())
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

// 이 시스템이 자동으로 굴림 판정을 해주지 않으므로, 결과를 GM/플레이어에게
// 직접 물어본다. 창을 닫으면(취소) null — 이 경우 건 주문은 그대로 둔다.
function promptOutcome(moveItem) {
  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `<p>${game.i18n.localize("DWAUTO.Counterspell.OutcomeInstruction")}</p>`,
      buttons: {
        success: {
          label: game.i18n.localize("DWAUTO.Counterspell.OutcomeSuccess"),
          callback: () => resolve("success")
        },
        partial: {
          label: game.i18n.localize("DWAUTO.Counterspell.OutcomePartial"),
          callback: () => resolve("partial")
        }
      },
      default: "success",
      close: () => resolve(null)
    }).render(true);
  });
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

    const names = splitCommaList(SETTINGS.COUNTERSPELL_MOVE_NAMES);
    if (!names.includes(title)) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const preparedSpells = actor.items.filter((i) => i.type === "spell" && i.system?.prepared);
    if (preparedSpells.length === 0) {
      ui.notifications.warn(game.i18n.format("DWAUTO.Counterspell.NoPrepared", { name: actor.name }));
      return;
    }

    const spellId = await promptStakeChoice(moveItem, preparedSpells);
    if (!spellId) return; // 취소 — 아무것도 바꾸지 않는다.
    const spell = actor.items.get(spellId);
    if (!spell) return;

    const outcome = await promptOutcome(moveItem);
    if (!outcome) return; // 취소 — 아무것도 바꾸지 않는다.

    if (outcome === "partial") {
      await promptRevokeSpell(actor, spell);
    } else {
      announceActionApplied(
        actor,
        moveItem.name,
        game.i18n.format("DWAUTO.Counterspell.Blocked", { spell: spell.name })
      );
    }
  } catch (err) {
    console.error(`${MODULE_ID} | counterspell: onCreateChatMessage failed`, err);
  }
}

export function registerCounterspellAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
