// [D] Hold 자동 설정 범용 처리 (Trap Expert, Evil Eye, Shapeshifter 등).
//
// 규칙: 이 무브를 굴렸을 때
//   - 현재 Hold가 0이면: 결과 텍스트의 "Hold N" 문구를 읽어 Hold를 N으로 설정한다.
//   - 현재 Hold가 1 이상이면: 그 Hold를 "쓰는" 시점이므로, 무브의 choices 목록에서
//     하나를 고르게 하고, 확정되면 Hold를 1 소모한다.
import { getMoveChoiceData, promptChoiceSelection } from "./move-choices.js";
import { announceActionApplied } from "./announce.js";

// 던전월드 한글화 모듈은 "Hold"를 전부 "예비"로 옮겨서(예: "예비 2점을
// 받습니다"), 영문 "hold"만 찾던 정규식이 번역된 세계에서는 단 한 번도
// 맞아떨어진 적이 없었다 — 판정 결과 텍스트에서 새 Hold 값을 못 읽어서
// 항상 조용히 0을 반환했고(실제로 변신 굴림 뒤 Hold가 전혀 안 올라가는
// 것으로 확인됨), 그 위에 다른 보너스(형태의 자유의 1d4 등)가 얹히면
// "원래 Hold는 사라지고 보너스만 남은 것"처럼 보였다. "hold"/"예비" 둘 다
// 인식하도록 고쳤다.
function parseHoldAmount(resultHtml) {
  const text = $("<div>").html(resultHtml ?? "").text();
  const match = text.match(/(?:hold|예비)\s*(\d+)/i);
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
