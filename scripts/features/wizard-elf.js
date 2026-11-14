import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { SPELL_PACK_FILES } from "../lib/translation-import.js";
import { filterDisabledNames, isMoveItemDisabled } from "../lib/move-toggles.js";

// 마법사-엘프(종족 핵심 액션, data/race-core-moves.js 참고) 원문: "마법을
// 마치 숨 쉬는 것처럼 자연스럽게 느낍니다. 마법 탐지가 간편주문이 됩니다."
// 공식 컴펜디엄의 마법 탐지는 기본 1레벨 주문이라 준비를 해야 쓸 수 있는데,
// 이 종족 액션은 그 레벨을 0으로 낮춰 던전월드 자체 규칙(레벨 0 주문은
// 준비 없이 항상 쓸 수 있음)에 따라 항상 쓸 수 있게 만든다. GM 요청대로
// "간편주문 취급"을 안 보이는 예외 처리로 끝내지 않고, 사제-드워프(목석의
// 말)처럼 실제로 스펠북에 레벨 0 주문 아이템으로 보이게 만든다 — 그래야
// 주문 목록에서 실제로 확인할 수 있어 오해가 없다.
const SPELL_PACK_IDS = SPELL_PACK_FILES.map((file) => file.replace(/\.json$/, ""));
let cachedWizardSpellDocs = null;

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_WIZARD_ELF_ASSISTANT);
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
  // 직업별 자동화 창에서 끈 액션은 목록에서 뺀다(lib/move-toggles.js)
  return filterDisabledNames([...new Set([...names, ...defaults])]);
}

function matchesWizardElfByTitle(title) {
  return splitCommaList(SETTINGS.WIZARD_ELF_MOVE_NAMES).includes(title);
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
function matchesWizardElf(title, originalTitle = null) {
  const byTitle = matchesWizardElfByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return matchesWizardElfByTitle(originalTitle);
}

function findDetectMagicItem(actor) {
  const names = splitCommaList(SETTINGS.DETECT_MAGIC_MOVE_NAMES);
  return actor.items.find((i) => i.type === "spell" && ((names.includes(i.name) || names.includes(i.flags?.babele?.originalName)) && !isMoveItemDisabled(i))) ?? null;
}

async function getWizardSpellDocuments() {
  if (cachedWizardSpellDocs) return cachedWizardSpellDocs;
  const packId = SPELL_PACK_IDS.find((id) => id.includes("wizard"));
  const pack = packId ? game.packs.get(packId) : null;
  if (!pack) return [];
  try {
    cachedWizardSpellDocs = await pack.getDocuments();
  } catch (err) {
    console.warn(`${MODULE_ID} | wizard-elf: failed to load wizard spell pack`, err);
    cachedWizardSpellDocs = [];
  }
  return cachedWizardSpellDocs;
}

async function findDetectMagicDocument() {
  const names = splitCommaList(SETTINGS.DETECT_MAGIC_MOVE_NAMES);
  const docs = await getWizardSpellDocuments();
  return docs.find((d) => names.includes(d.name) || names.includes(d.flags?.babele?.originalName)) ?? null;
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
    if (!matchesWizardElf(title, originalTitle)) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const existing = findDetectMagicItem(actor);
    if (existing) {
      if (Number(existing.system.spellLevel) === 0) {
        announceInfo(actor, game.i18n.format("DWAUTO.WizardElf.AlreadyCantrip", { spell: existing.name }));
        return;
      }
      await existing.update({ "system.spellLevel": 0 });
      announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.WizardElf.Lowered", { spell: existing.name }));
      return;
    }

    const doc = await findDetectMagicDocument();
    if (!doc) {
      console.warn(`${MODULE_ID} | wizard-elf: couldn't find Detect Magic in the wizard spell compendium`);
      return;
    }

    const data = doc.toObject();
    data.system.spellLevel = 0;
    await actor.createEmbeddedDocuments("Item", [data]);
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.WizardElf.Added", { spell: doc.name }));
  } catch (err) {
    console.error(`${MODULE_ID} | wizard-elf: onCreateChatMessage failed`, err);
  }
}

export function registerWizardElfAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
