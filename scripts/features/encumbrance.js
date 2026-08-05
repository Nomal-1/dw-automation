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
// roll-wrapper.js가 매 판정마다 조용히(채팅 알림 없이) 반영한다. +3 이상인데
// 짐을 버리지 않는 "자동 6" 판정은 판정 자체를 취소하지 않는다 — 대신
// FORCED_FAILURE_MOD(거대한 음수 rollMod)를 얹어서 실제로 굴리게 해서,
// 던전월드 시스템 자신의 무브 카드(성공/부분성공/실패 문구, 경험치 획득
// 버튼 등)가 그대로 뜨게 한다. 이 파일은 자체적으로 등록할 훅이 없다 —
// 두 함수 모두 lib/roll-wrapper.js가 직접 불러 쓴다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_ENCUMBRANCE_ASSISTANT);
}

// "판정은 자동으로 6인 것으로 간주합니다"를 판정 자체를 취소하는 대신
// 이 값을 rollMod에 얹어서 실제로 굴리게 하는 방식으로 구현한다 — 그래야
// 던전월드 시스템 자신의 무브 카드(성공/부분성공/실패 결과 문구, 굴림
// 수식·합계, 무엇보다 "경험치 획득" 버튼까지)가 그대로 뜬다. 직접
// ChatMessage를 만들어 흉내 내는 것보다 훨씬 정확하고, 실패 시 예비를
// 주는 것 같은 다른 무브의 결과 처리도 원래 시스템 흐름 그대로 이어진다.
const FORCED_FAILURE_MOD = -9999;

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
// (또는 캐릭터가 아니거나 기능이 꺼져있으면) bonus 0으로 즉시 통과한다.
// +3 이상인데 짐을 버리면(버릴 게 있고 실제로 골랐으면) 역시 bonus 0으로
// 판정을 그대로 진행시킨다(-1 자체는 getEncumbranceMalus가 별도로 계속
// 반영한다). 버리지 않으면(거절했거나 버릴 게 없으면) FORCED_FAILURE_MOD를
// 반환해서 판정은 실제로 열리되 결과가 반드시 실패로 나오게 한다.
export async function promptEncumbrancePreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { bonus: 0 };

  const over = getOverweight(actor);
  if (over < 3) return { bonus: 0 };

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
      return { bonus: 0 };
    }
  }

  ui.notifications.warn(game.i18n.format("DWAUTO.Encumbrance.ForcedFailure", { name: actor.name }));
  return { bonus: FORCED_FAILURE_MOD };
}

export function registerEncumbranceAssistant() {
  // 자체 훅이 없다 — getEncumbranceMalus/promptEncumbrancePreRoll을 lib/
  // roll-wrapper.js가 직접 불러 쓴다. main.js의 다른 기능들과 등록 방식을
  // 맞추기 위해 빈 함수만 내보낸다.
}
