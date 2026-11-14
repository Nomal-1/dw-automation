import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { parseAnimalCompanionChoiceLists } from "../lib/animal-companion-stats.js";
import {
  getAnimalCompanionStats,
  addAnimalCompanionStatBonus,
  getAnimalCompanionTrainings,
  addAnimalCompanionTraining,
  registerAnimalCompanionResetListener
} from "./note-moves.js";

// 레인저 Unnatural Ally(고급 무브) 원문: "당신의 동물 친구는 동물이 아니라
// 괴물입니다. 그것을 묘사하세요. 사나움 +2, 본능 +1을 주고, 새 훈련 특성을
// 하나 추가하세요." features/well-trained.js와 완전히 같은 패턴(동반 동물
// 자신의 실제 설명에서 훈련 특성 목록을 그대로 재사용해 아직 없는 것 중
// 하나를 고르게 함)에, note-moves.js가 관리하는 기본 능력치에 고정 보너스를
// 더하는 단계를 앞에 붙인 것이다. 재주꾼과 달리 반복 습득을 가정하지 않는
// 일반 고급 무브라 딱 한 번만 발동하게 막는다.
const APPLIED_FLAG = "unnaturalAllyApplied"; // { [moveId]: string } — 그 발동이 추가한 훈련

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_UNNATURAL_ALLY_ASSISTANT);
}

function splitCommaList(settingKey) {
  const parse = (value) =>
    String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const names = parse(game.settings.get(MODULE_ID, settingKey));
  // 이름 목록이면 설정 기본값(원문 영어 이름)도 항상 포함한다. 번역 자동 채우기가
  // 기본값을 한글로 바꿔 넣어도, 아이템의 원문 이름(flags.babele.originalName)으로
  // 계속 알아볼 수 있게 하기 위해서다. 한글 카드 제목과는 겹치지 않아 해가 없다.
  if (!settingKey.endsWith("Names")) return names;
  const defaults = parse(game.settings.settings.get(`${MODULE_ID}.${settingKey}`)?.default);
  return [...new Set([...names, ...defaults])];
}

// 이름만으로 찾지 않는다 — well-trained.js와 같은 이유로, 실제로 "교활함만큼
// 고르는 훈련 특성" 구조를 가진 설명인지까지 확인한다.
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
            <label>${game.i18n.localize("DWAUTO.UnnaturalAlly.PromptLabel")}</label>
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
async function matchesConfiguredNameByTitle(title) {
  const configured = splitCommaList(SETTINGS.UNNATURAL_ALLY_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Unnatural Ally") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
async function matchesConfiguredName(title, originalTitle = null) {
  const byTitle = await matchesConfiguredNameByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return await matchesConfiguredNameByTitle(originalTitle);
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, originalTitle } = info;
    if (actor.type !== "character") return;

    if (!(await matchesConfiguredName(title, originalTitle))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const applied = getAppliedTraining(actor, moveItem.id);
    if (applied) {
      announceInfo(actor, game.i18n.format("DWAUTO.UnnaturalAlly.AlreadyApplied", { training: applied }));
      return;
    }

    const companion = findAnimalCompanionMove(actor);
    if (!companion) {
      ui.notifications.warn(game.i18n.format("DWAUTO.UnnaturalAlly.NoCompanion", { name: actor.name }));
      return;
    }

    if (!getAnimalCompanionStats(actor)) {
      ui.notifications.warn(game.i18n.format("DWAUTO.UnnaturalAlly.NoStats", { name: actor.name }));
      return;
    }

    const lists = parseAnimalCompanionChoiceLists(companion.system?.description);
    const already = new Set(getAnimalCompanionTrainings(actor));
    const remaining = lists.trainings.filter((t) => !already.has(t));
    if (remaining.length === 0) {
      ui.notifications.warn(game.i18n.format("DWAUTO.UnnaturalAlly.NoTrainingsLeft", { name: actor.name }));
      return;
    }

    const chosen = await promptTrainingChoice(moveItem, remaining);
    if (!chosen) return;

    await addAnimalCompanionStatBonus(actor, { ferocity: 2, instinct: 1 });
    await addAnimalCompanionTraining(actor, chosen);
    await setAppliedTraining(actor, moveItem.id, chosen);
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.UnnaturalAlly.Applied", { training: chosen }));
  } catch (err) {
    console.error(`${MODULE_ID} | unnatural-ally: onCreateChatMessage failed`, err);
  }
}

export function registerUnnaturalAllyAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  // 동물 친구 탭이 초기화되면(새 동물 친구로 다시 시작하면) 옛 동물 친구를
  // 가리키던 "이미 적용됨" 기록도 같이 지워서, 새 동물 친구에 Unnatural Ally를
  // 다시 적용할 수 있게 한다.
  registerAnimalCompanionResetListener(async (actor) => {
    await actor.unsetFlag(MODULE_ID, APPLIED_FLAG);
  });
}
