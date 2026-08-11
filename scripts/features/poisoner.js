import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { DEFAULT_POISONS } from "../data/poison-tables.js";
import { getPoisonerChoice, setPoisonerChoice } from "../lib/poisoner-state.js";
import { addUsedPoison } from "../lib/poison-state.js";
import { createOrIncrementPoisonItem } from "../lib/poison-item.js";

// 도적 핵심액션 독의 기술(Poisoner) 원문: "다음 중에서 독을 하나 고르십시오.
// 처음에 그 독을 3회분 가지고 시작하며... 시간을 들여 재료를 모으고 안전한
// 곳에서 조제를 하면, 자기가 선택한 독은 공짜로 3회분씩 만들 수 있습니다."
// rollType이 없는 서술형 무브라(바바리안 삼손과 같은 방식) 무브를 클릭하면
// 곧바로 처리한다: 아직 고른 독이 없으면 4종 중 하나를 고르게 하고 3회분을
// 인벤토리에 추가하며, 이미 골랐다면 "독을 만들겠습니까?"만 물어서 조제
// 여부에 따라 3회분을 추가한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_POISONER_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.POISONER_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Poisoner") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function promptPoisonChoice(moveItem) {
  const options = DEFAULT_POISONS.map(
    (p, i) => `
      <div class="form-group dwauto-choice-option">
        <label><input type="radio" name="poison" value="${i}" ${i === 0 ? "checked" : ""}> <strong>${p.name}</strong> (${p.tag}) — ${p.description}</label>
      </div>
    `
  ).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `<form><p>${game.i18n.localize("DWAUTO.Poisoner.ChoosePrompt")}</p>${options}</form>`,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const idx = Number(html.find('[name="poison"]:checked').val());
            resolve(DEFAULT_POISONS[idx] ?? null);
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => {}
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

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const existingChoice = getPoisonerChoice(actor);

    if (!existingChoice) {
      const poison = await promptPoisonChoice(moveItem);
      if (!poison) return;

      await setPoisonerChoice(actor, poison.name);
      await addUsedPoison(actor, { name: poison.name, tag: poison.tag });
      const total = await createOrIncrementPoisonItem(actor, poison.name, poison.tag, 3, poison.description);
      announceActionApplied(
        actor,
        moveItem.name,
        game.i18n.format("DWAUTO.Poisoner.Chosen", { name: poison.name, total })
      );
      return;
    }

    const confirmed = await Dialog.confirm({
      title: moveItem.name,
      content: `<p>${game.i18n.format("DWAUTO.Poisoner.BrewPrompt", { name: existingChoice })}</p>`,
      defaultYes: false
    });
    if (!confirmed) return;

    const preset = DEFAULT_POISONS.find((p) => p.name === existingChoice);
    const total = await createOrIncrementPoisonItem(
      actor,
      existingChoice,
      preset?.tag ?? "",
      3,
      preset?.description ?? ""
    );
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.Poisoner.Brewed", { name: existingChoice, total })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | poisoner: onCreateChatMessage failed`, err);
  }
}

export function registerPoisonerAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
