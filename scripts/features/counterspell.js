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
// 전혀 없이 서술형 카드만 뜬다) 시스템 자체의 굴림 경로를 탈 수 없다. 그래서
// 무브를 발동하면 (1) 어떤 준비된 주문을 걸지 고르게 하고, (2) 이 모듈이
// 직접 2d6+INT을 굴려(rollCounterspell — forward/ongoing 보정 포함) 결과를
// 판정한다. 부분성공이면 건 주문을 잊게 한다(features/spellcasting.js의
// promptRevokeSpell 재사용 — Cast a Spell 부분성공 소비와 완전히 같은 동작).
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

function getAbilityMod(actor, ability) {
  return Number(actor.system?.abilities?.[ability]?.mod) || 0;
}

function formatModifier(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

// 이 시스템의 원래 굴림 로직(rolls.js의 rollMoveExecute)과 최대한 같은
// 방식으로 2d6+INT을 직접 굴린다 — forward/ongoing 보정을 formula에 포함하고,
// forward는 시스템과 동일하게 굴린 뒤 0으로 초기화한다(약화는 능력치
// 수정치(.mod) 자체에 이미 반영되어 있어 따로 처리할 필요가 없다). 이 무브가
// 컴펜디엄에 rollType이 없어서 시스템의 원래 굴림 경로(무브 클릭 → 자동 굴림)를
// 아예 탈 수 없기 때문에 직접 굴리는 것이며, 그 경로에서만 처리되는 유리함/
// 불리함(advantage/disadvantage) 토글까지는 재현하지 않는다.
async function rollCounterspell(actor, moveItem) {
  const mod = getAbilityMod(actor, "int");
  const rollMod = Number(moveItem.system?.rollMod) || 0;
  const forward = Number(actor.system?.attributes?.forward?.value) || 0;
  const ongoing = Number(actor.system?.attributes?.ongoing?.value) || 0;

  let formula = `2d6${formatModifier(mod)}`;
  if (rollMod) formula += formatModifier(rollMod);
  if (forward) formula += formatModifier(forward);
  if (ongoing) formula += formatModifier(ongoing);

  const roll = new Roll(formula);
  await roll.evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: moveItem.name });

  if (forward) {
    await actor.update({ "system.attributes.forward.value": 0 });
  }

  return roll.total;
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

    const total = await rollCounterspell(actor, moveItem);
    const outcome = total >= 10 ? "success" : total >= 7 ? "partial" : "failure";

    if (outcome === "success") {
      announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.Counterspell.Blocked", { spell: spell.name }));
    } else if (outcome === "partial") {
      announceActionApplied(
        actor,
        moveItem.name,
        game.i18n.format("DWAUTO.Counterspell.BlockedPartial", { spell: spell.name })
      );
      await promptRevokeSpell(actor, spell);
    } else {
      announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.Counterspell.NotBlocked", { spell: spell.name }));
    }
  } catch (err) {
    console.error(`${MODULE_ID} | counterspell: onCreateChatMessage failed`, err);
  }
}

export function registerCounterspellAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
