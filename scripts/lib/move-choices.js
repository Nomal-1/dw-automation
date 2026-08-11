// [A] 선택지 프롬프트 범용 처리.
//
// 던전월드 무브 아이템은 대부분 아래 둘 중 하나의 구조로 "고를 수 있는 목록"을
// 갖고 있다:
//   1) system.choices 필드에 <ul><li>...</li></ul> 형태로 목록이 있고,
//      system.moveResults.<result>.value 안에 "Choose N." 문구가 있음
//      (예: Bend Bars, Backstab, Trap Expert, Arcane Art, I Am The Law, Elemental Mastery)
//   2) system.choices가 비어 있고, moveResults.<result>.value 자체 안에
//      <ul><li>...</li></ul> 목록이 내장되어 있음 (예: Cast a Spell 계열)
// 둘 다 액터가 실제로 갖고 있는 무브 아이템의 데이터를 그대로 읽는 것이므로
// 번역 여부와 무관하게 동작한다.
//
// "Choose N"이 명시되지 않고 그냥 "선택지 중 하나를 고르시오" 식으로 개수가
// 암시만 되는 경우(Arcane Art 등)는 기본값 1로 처리한다.

const CHOOSE_WORD_TO_NUMBER = { one: 1, two: 2, three: 3, four: 4 };

function stripToText(html) {
  return $("<div>").html(html ?? "").text().trim();
}

function parseListItems(html) {
  if (!html) return [];
  const wrapper = $("<div>").html(html);
  return wrapper.find("li").map((_, el) => $(el).html().trim()).get();
}

function parseChooseCount(resultHtml) {
  const text = stripToText(resultHtml);
  const match = text.match(/choose\s+(\d+|one|two|three|four)/i);
  if (!match) return null;
  const word = match[1].toLowerCase();
  return CHOOSE_WORD_TO_NUMBER[word] ?? parseInt(word, 10);
}

/**
 * 무브 아이템 + 결과 등급(success/partial/failure)을 받아
 * { options: string[], count: number } 를 반환한다. 선택지가 없는 무브면
 * options가 빈 배열로 온다.
 */
export function getMoveChoiceData(moveItem, result) {
  const sys = moveItem.system ?? {};
  const resultHtml = sys.moveResults?.[result]?.value ?? "";

  let options = parseListItems(sys.choices);
  let count = parseChooseCount(resultHtml);

  if (options.length === 0) {
    // choices 필드가 비어있으면 결과 텍스트 안에 내장된 목록을 찾는다.
    options = parseListItems(resultHtml);
  }

  if (options.length > 0 && count === null) count = 1;

  return { options, count: count ?? 0 };
}

/**
 * 선택지 다이얼로그를 띄운다. 정확히 count개를 고를 때까지 다시 띄운다.
 * onConfirm(selectedOptionHtmls: string[], selectedIndexes: number[]) — indexes는
 * 1부터 시작한다(설정 화면에서 GM이 "몇 번째 선택지"라고 지정할 때와 맞추기 위함).
 */
export function promptChoiceSelection({ title, instruction, options, count, onConfirm, onCancel }) {
  const inputType = count === 1 ? "radio" : "checkbox";
  const optionsHtml = options
    .map((opt, i) => `
      <div class="form-group dwauto-choice-option">
        <label><input type="${inputType}" name="dwautoChoice" value="${i}"> ${opt}</label>
      </div>
    `)
    .join("");

  new Dialog({
    title,
    content: `
      <p>${instruction ?? game.i18n.format("DWAUTO.Choice.Instruction", { count })}</p>
      <form>${optionsHtml}</form>
    `,
    buttons: {
      ok: {
        label: game.i18n.localize("DWAUTO.Confirm"),
        callback: (html) => {
          const checked = html.find('[name="dwautoChoice"]:checked');
          if (checked.length !== count) {
            ui.notifications.warn(game.i18n.format("DWAUTO.Choice.WrongCount", { count }));
            promptChoiceSelection({ title, instruction, options, count, onConfirm, onCancel });
            return;
          }
          const selectedIndexes = checked.map((_, el) => Number(el.value) + 1).get();
          const selected = selectedIndexes.map((i) => options[i - 1]);
          onConfirm(selected, selectedIndexes);
        }
      },
      cancel: {
        label: game.i18n.localize("DWAUTO.Cancel"),
        callback: () => onCancel?.()
      }
    },
    default: "ok",
    close: () => {}
  }).render(true);
}

/**
 * 선택된 옵션 텍스트 안에 있는 주사위 표기를 뽑아준다.
 * 원문은 [[1d6]] 처럼 Foundry 인라인 굴림 문법을 쓰지만, 번역판은 그 서식을
 * 안 살리고 "+1d6을 줍니다"처럼 평문으로만 남기는 경우가 있어 그것도 지원한다.
 * "1d6" 같은 표기 자체는 언어와 무관하게 그대로 남으므로 번역에도 안전하다.
 */
export function extractInlineRoll(optionHtml) {
  const text = $("<div>").html(optionHtml ?? "").text();

  const bracketed = text.match(/\[\[\s*\/?(?:r|roll)?\s*([^\]|]+?)\s*\]\]/i);
  if (bracketed) return bracketed[1].trim();

  const bare = text.match(/\d+d\d+/i);
  return bare ? bare[0] : null;
}

/**
 * extractInlineRoll과 같지만 부호(+/-)까지 포함해서 뽑는다. Volley(사격)
 * 7-9 선택지의 "-1d6 damage"처럼 페널티 다이스를 구분해야 하는 곳에 쓴다
 * (extractInlineRoll은 항상 보너스로만 쓰여서 부호를 무시했다).
 */
export function extractSignedInlineRoll(optionHtml) {
  const text = $("<div>").html(optionHtml ?? "").text();

  const bracketed = text.match(/\[\[\s*\/?(?:r|roll)?\s*([+-]?\d+d\d+)\s*\]\]/i);
  if (bracketed) return bracketed[1].trim();

  const bare = text.match(/[+-]?\d+d\d+/i);
  return bare ? bare[0] : null;
}
