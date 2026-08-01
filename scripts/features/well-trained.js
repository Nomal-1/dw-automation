import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { parseAnimalCompanionChoiceLists } from "../lib/animal-companion-stats.js";
import { getAnimalCompanionTrainings, addAnimalCompanionTraining } from "./note-moves.js";

// 레인저 재주꾼(Well-trained, 고급 무브) 원문: "동물 친구에게 훈련 특성을
// 하나 추가하십시오." 새로 목록을 관리하지 않고, 동물 친구(Animal Companion)
// 자신의 실제 설명(번역 포함)에서 "교활함만큼 고르는 훈련 특성" 목록을 그대로
// 재사용해서 아직 갖고 있지 않은 훈련 중 하나를 고르게 한다. 고른 훈련은
// features/note-moves.js가 관리하는 animalCompanionTrainings 플래그에
// 이어붙인다 — 재주꾼을 여러 번 배우면(고급 무브는 반복 습득이 가능) 그때마다
// 하나씩 더 늘어난다.
const APPLIED_FLAG = "wellTrainedApplied"; // { [moveId]: string } — 그 재주꾼 무브 하나가 추가한 훈련

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_WELL_TRAINED_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 이름만으로 찾지 않는다 — 서드파티 확장이 우연히 같은 이름을 쓸 수도 있으니,
// 실제로 "교활함만큼 고르는 훈련 특성" 구조를 가진 설명인지까지 확인한다.
function findAnimalCompanionMove(actor) {
  return actor.items.find((i) => i.type === "move" && parseAnimalCompanionChoiceLists(i.system?.description) !== null) ?? null;
}

function getAppliedTraining(actor, moveId) {
  return actor.getFlag(MODULE_ID, APPLIED_FLAG)?.[moveId] ?? null;
}

async function setAppliedTraining(actor, moveId, training) {
  const current = actor.getFlag(MODULE_ID, APPLIED_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, APPLIED_FLAG, { ...current, [moveId]: training });
}

function promptTrainingChoice(moveItem, options) {
  const selectOptions = options.map((opt) => `<option value="${opt}">${opt}</option>`).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.WellTrained.PromptLabel")}</label>
            <select name="training">${selectOptions}</select>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.NoteMoves.CustomOption")}</label>
            <input type="text" name="customTraining" value="">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const custom = (html.find('[name="customTraining"]').val() ?? "").trim();
            resolve(custom || html.find('[name="training"]').val());
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve(null)
        }
      },
      default: "ok",
      width: 380,
      close: () => resolve(null)
    }).render(true);
  });
}

// features/note-moves.js와 같은 방식: 설정값이 아직 번역 전(영문 기본값)이어도
// 지금 이 시점의 번역 데이터로 다시 한번 확인해서 매칭을 놓치지 않는다.
async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.WELL_TRAINED_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Well-trained") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
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

    const applied = getAppliedTraining(actor, moveItem.id);
    if (applied) {
      announceInfo(actor, game.i18n.format("DWAUTO.WellTrained.AlreadyApplied", { training: applied }));
      return;
    }

    const companion = findAnimalCompanionMove(actor);
    if (!companion) {
      ui.notifications.warn(game.i18n.format("DWAUTO.WellTrained.NoCompanion", { name: actor.name }));
      return;
    }

    const lists = parseAnimalCompanionChoiceLists(companion.system?.description);
    const already = new Set(getAnimalCompanionTrainings(actor));
    const remaining = lists.trainings.filter((t) => !already.has(t));
    if (remaining.length === 0) {
      ui.notifications.warn(game.i18n.format("DWAUTO.WellTrained.NoTrainingsLeft", { name: actor.name }));
      return;
    }

    const chosen = await promptTrainingChoice(moveItem, remaining);
    if (!chosen) return;

    await addAnimalCompanionTraining(actor, chosen);
    await setAppliedTraining(actor, moveItem.id, chosen);
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.WellTrained.Applied", { training: chosen }));
  } catch (err) {
    console.error(`${MODULE_ID} | well-trained: onCreateChatMessage failed`, err);
  }
}

export function registerWellTrainedAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
