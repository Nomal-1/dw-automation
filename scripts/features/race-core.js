import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { RANGER_RACE_CORE_MOVES } from "../data/race-core-moves.js";

// 레인저 무브 하프엘프(Half-elven) 원문: "인간으로 시작했다면 엘프의 종족
// 액션을, 엘프로 시작했다면 인간의 종족 액션을 추가하십시오." 종족 선택
// 자체는 이 모듈이 새 UI로 관리하지 않는다 — GM이 캐릭터 생성 시 사냥꾼-
// 엘프/사냥꾼-인간(이 모듈이 만들어 넣은 종족 핵심 액션, data/
// race-core-moves.js 참고) 둘 중 하나를 액터에게 직접 넣어주는 것 자체가
// "종족 선택 완료"다. 하프엘프를 발동하면 그 둘 중 실제로 갖고 있는 쪽을
// 찾아 없는 쪽을 만들어 넣는다 — 다른 직업의 종족 핵심 액션은 아직 준비돼
// 있지 않아, 지금은 레인저(사냥꾼)만 지원한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_RACE_CORE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchesHalfElven(title) {
  return splitCommaList(SETTINGS.HALF_ELVEN_MOVE_NAMES).includes(title);
}

function getRaceCoreMoveName(row) {
  const settingKey = row.key === "elf" ? SETTINGS.RANGER_ELF_MOVE_NAME : SETTINGS.RANGER_HUMAN_MOVE_NAME;
  return game.settings.get(MODULE_ID, settingKey);
}

function hasRaceCoreMove(actor, row) {
  const name = getRaceCoreMoveName(row);
  return actor.items.some((i) => i.type === "move" && i.name === name);
}

// 던전월드 무브 아이템 스키마(공식 컴펜디엄 Half_elven.yml 구조를 그대로
// 참고)를 직접 만들어 넣는다 — 이 텍스트는 컴펜디엄에 원본이 없어
// findMoveDocumentByName(class-grant.js 방식)으로 찾아올 수 없기 때문이다.
function buildRaceCoreMoveData(row) {
  return {
    name: getRaceCoreMoveName(row),
    type: "move",
    img: "icons/sundries/books/book-symbol-tree-silver-green.webp",
    system: {
      name: "",
      description: row.description,
      choices: "",
      moveType: "starting",
      rollFormula: "",
      moveResults: { failure: { value: "" }, partial: { value: "" }, success: { value: "" } },
      class: "The Ranger",
      rollType: "",
      rollMod: 0,
      requiresLevel: 0,
      requiresMove: "",
      moveGroup: ""
    }
  };
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
    if (!matchesHalfElven(title)) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const elfRow = RANGER_RACE_CORE_MOVES.find((r) => r.key === "elf");
    const humanRow = RANGER_RACE_CORE_MOVES.find((r) => r.key === "human");
    const hasElf = hasRaceCoreMove(actor, elfRow);
    const hasHuman = hasRaceCoreMove(actor, humanRow);

    if (hasElf && hasHuman) {
      announceInfo(actor, game.i18n.localize("DWAUTO.RaceCore.AlreadyHasBoth"));
      return;
    }
    if (!hasElf && !hasHuman) {
      announceInfo(actor, game.i18n.localize("DWAUTO.RaceCore.NoneFound"));
      return;
    }

    const missingRow = hasElf ? humanRow : elfRow;
    const data = buildRaceCoreMoveData(missingRow);
    await actor.createEmbeddedDocuments("Item", [data]);

    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.RaceCore.Added", { name: data.name }));
  } catch (err) {
    console.error(`${MODULE_ID} | race-core: onCreateChatMessage failed`, err);
  }
}

export function registerRaceCoreAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
