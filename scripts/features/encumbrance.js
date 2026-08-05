import { MODULE_ID, SETTINGS } from "../constants.js";

// 던전월드 기본 무브 짐(Encumbrance) 원문: "자기 하중 이하의 무게를 짊어진
// 상태에서는 아무 지장도 없다. 하중 +1~+2의 무게를 진 상태에서는 짐을 덜
// 때까지 판정에 계속 -1을 받는다. 그보다 무거우면(하중 +3 이상) 액션을
// 하려면 적어도 무게 1에 해당하는 짐을 버리고(그래도 계속 -1을 받는다)
// 판정해야 하고, 버리지 않으면 판정은 자동으로 6(실패)인 것으로 간주한다."
//
// system.attributes.weight.value(현재 짐)는 던전월드 시스템 자체가
// prepareDerivedData에서 장비 아이템의 quantity*weight 합으로 이미 실시간
// 계산해주는 값이라(actor.js 참고), 이 파일은 그 값을 그대로 읽기만 하면
// 된다. -1 페널티는 barbarian.js의 getGoodDayToDieBonus, hit-trigger.js의
// getOngoingPenaltyMalus와 같은 "항상 최신 상태를 다시 읽는" 방식으로 lib/
// roll-wrapper.js가 매 판정마다 조용히(채팅 알림 없이) 반영한다. +3 이상일
// 때의 "버리거나 자동 6" 게이트만 판정 "전"에 따로 물어봐야 해서
// promptEncumbrancePreRoll로 분리했다. 이 파일은 자체적으로 등록할 훅이
// 없다 — 두 함수 모두 lib/roll-wrapper.js가 직접 불러 쓴다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_ENCUMBRANCE_ASSISTANT);
}

function getOverweight(actor) {
  const current = Number(actor.system.attributes?.weight?.value) || 0;
  const max = Number(actor.system.attributes?.weight?.max) || 0;
  return current - max;
}

// lib/roll-wrapper.js가 다른 "항상 최신 상태" 보정들과 나란히 totalMod에
// 더한다. 하중 초과 자체가 지속 상태라 매번 조용히 반영하고 채팅에 남기지
// 않는다(barbarian.js의 getGoodDayToDieBonus와 같은 이유 — 이미 시트의
// 짐 칸이 시각적으로 강조 표시된다).
export function getEncumbranceMalus(actor) {
  if (!isEnabled()) return 0;
  if (actor.type !== "character") return 0;
  return getOverweight(actor) > 0 ? -1 : 0;
}

function getDroppableItems(actor) {
  return actor.items.filter(
    (i) => i.type === "equipment" && Number(i.system?.weight) > 0 && Number(i.system?.quantity) > 0
  );
}

function promptDropItem(items) {
  const options = items
    .map(
      (i) =>
        `<option value="${i.id}">${i.name} (${game.i18n.localize("DWAUTO.Encumbrance.Weight")}: ${i.system.weight}, ${game.i18n.localize("DWAUTO.Encumbrance.Quantity")}: ${i.system.quantity})</option>`
    )
    .join("");

  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("DWAUTO.Encumbrance.DropTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Encumbrance.DropItemLabel")}</label>
            <select name="item">${options}</select>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Encumbrance.DropCountLabel")}</label>
            <input type="number" name="count" value="1" min="1">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            resolve({
              itemId: html.find('[name="item"]').val(),
              count: Math.max(1, Number(html.find('[name="count"]').val()) || 1)
            });
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve(null)
        }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

async function dropItem(actor, itemId, count) {
  const item = actor.items.get(itemId);
  if (!item) return;

  const quantity = Number(item.system.quantity) || 0;
  const remaining = quantity - Math.min(count, quantity);

  if (remaining <= 0) {
    await item.delete();
  } else {
    await item.update({ "system.quantity": remaining });
  }
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 하중 초과가 +3 미만이면
// (또는 캐릭터가 아니거나 기능이 꺼져있으면) 즉시 통과한다. +3 이상인데
// 짐을 버리지 않으면(버릴 게 없는 경우 포함) 판정 자체를 취소하고
// (cancel: true) 대신 "자동 6(실패)" 안내를 채팅에 남긴다.
export async function promptEncumbrancePreRoll(item) {
  if (!isEnabled()) return { cancel: false };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { cancel: false };

  const over = getOverweight(actor);
  if (over < 3) return { cancel: false };

  const droppable = getDroppableItems(actor);
  const willDrop =
    droppable.length > 0 &&
    (await Dialog.confirm({
      title: game.i18n.localize("DWAUTO.Encumbrance.GateTitle"),
      content: `<p>${game.i18n.format("DWAUTO.Encumbrance.GatePrompt", { over })}</p>`,
      defaultYes: true
    }));

  if (willDrop) {
    const choice = await promptDropItem(droppable);
    if (choice) {
      await dropItem(actor, choice.itemId, choice.count);
      return { cancel: false };
    }
  }

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p class="dwauto-action-applied"><i class="fas fa-triangle-exclamation"></i> ${game.i18n.format("DWAUTO.Encumbrance.ForcedFailure", { name: actor.name })}</p>`
  });
  return { cancel: true };
}

export function registerEncumbranceAssistant() {
  // 자체 훅이 없다 — getEncumbranceMalus/promptEncumbrancePreRoll을 lib/
  // roll-wrapper.js가 직접 불러 쓴다. main.js의 다른 기능들과 등록 방식을
  // 맞추기 위해 빈 함수만 내보낸다.
}
