import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { SPELL_PACK_FILES } from "../lib/translation-import.js";

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
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchesWizardElf(title) {
  return splitCommaList(SETTINGS.WIZARD_ELF_MOVE_NAMES).includes(title);
}

function findDetectMagicItem(actor) {
  const names = splitCommaList(SETTINGS.DETECT_MAGIC_MOVE_NAMES);
  return actor.items.find((i) => i.type === "spell" && names.includes(i.name)) ?? null;
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
  return docs.find((d) => names.includes(d.name)) ?? null;
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
    if (!matchesWizardElf(title)) return;

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
