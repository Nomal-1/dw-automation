// [D] Hold 자동 설정 범용 처리 (Trap Expert, Evil Eye, Shapeshifter 등).
//
// 규칙: 이 무브를 굴렸을 때
//   - 현재 Hold가 0이면: 결과 텍스트의 "Hold N" 문구를 읽어 Hold를 N으로 설정한다.
//   - 현재 Hold가 1 이상이면: 그 Hold를 "쓰는" 시점이므로, 무브의 choices 목록에서
//     하나를 고르게 하고, 확정되면 Hold를 1 소모한다.
import { getMoveChoiceData, promptChoiceSelection } from "./move-choices.js";
import { announceActionApplied } from "./announce.js";

function parseHoldAmount(resultHtml) {
  const text = $("<div>").html(resultHtml ?? "").text();
  const match = text.match(/hold\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

export async function handleHoldMove(actor, moveItem, result) {
  const currentHold = Number(actor.system.attributes?.hold?.value) || 0;

  if (currentHold <= 0) {
    const resultHtml = moveItem.system?.moveResults?.[result]?.value ?? "";
    const newHold = parseHoldAmount(resultHtml);
    if (newHold <= 0) return;

    await actor.update({ "system.attributes.hold.value": newHold });
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.Hold.Gained", { hold: newHold }));
    return;
  }

  const { options } = getMoveChoiceData(moveItem, result);
  if (options.length === 0) return;

  promptChoiceSelection({
    title: moveItem.name,
    instruction: game.i18n.format("DWAUTO.Hold.SpendInstruction", { hold: currentHold }),
    options,
    count: 1,
    onConfirm: async (selected) => {
      const next = Math.max(0, currentHold - 1);
      await actor.update({ "system.attributes.hold.value": next });
      announceActionApplied(
        actor,
        moveItem.name,
        game.i18n.format("DWAUTO.Hold.Spent", { choice: selected[0], remaining: next })
      );
    }
  });
}
