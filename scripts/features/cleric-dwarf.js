import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { SPELL_PACK_FILES } from "../lib/translation-import.js";

// 사제-드워프(종족 핵심 액션, data/race-core-moves.js 참고) 원문: "당신은
// 돌과 하나입니다. 예배를 할 때, 돌에 대해서만 쓸 수 있는 특별한 버전의
// 목석의 말(Words of the Unspeaking)을 암송주문(rote — 판정 없이 항상
// 성공하는 주문)으로 하나 더 받습니다." 공식 목석의 말은 원래 5레벨
// 주문이라 준비를 해야 쓸 수 있는데, 암송주문 개념은 이 모듈의 주문 준비
// 시스템에 없으므로 마법사-엘프(features/wizard-elf.js)와 같은 방식으로
// 단순화한다 — 레벨 0으로 만들어서 던전월드 자체 규칙(레벨 0 주문은 준비
// 없이 항상 쓸 수 있음)에 따라 사실상 암송주문처럼 동작하게 하고, 설명에
// "돌에만 사용 가능"이라는 원문 제약을 텍스트로 남긴다(기계적으로 강제할
// 수는 없어 서사적 판단에 맡긴다).
const SPELL_PACK_IDS = SPELL_PACK_FILES.map((file) => file.replace(/\.json$/, ""));
let cachedClericSpellDocs = null;

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_CLERIC_DWARF_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchesClericDwarf(title) {
  return splitCommaList(SETTINGS.CLERIC_DWARF_MOVE_NAMES).includes(title);
}

function findWordsOfUnspeakingItem(actor) {
  const names = splitCommaList(SETTINGS.WORDS_OF_UNSPEAKING_MOVE_NAMES);
  return actor.items.find((i) => i.type === "spell" && names.includes(i.name)) ?? null;
}

async function getClericSpellDocuments() {
  if (cachedClericSpellDocs) return cachedClericSpellDocs;
  const packId = SPELL_PACK_IDS.find((id) => id.includes("cleric"));
  const pack = packId ? game.packs.get(packId) : null;
  if (!pack) return [];
  try {
    cachedClericSpellDocs = await pack.getDocuments();
  } catch (err) {
    console.warn(`${MODULE_ID} | cleric-dwarf: failed to load cleric spell pack`, err);
    cachedClericSpellDocs = [];
  }
  return cachedClericSpellDocs;
}

async function findWordsOfUnspeakingDocument() {
  const names = splitCommaList(SETTINGS.WORDS_OF_UNSPEAKING_MOVE_NAMES);
  const docs = await getClericSpellDocuments();
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
    if (!matchesClericDwarf(title)) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const existing = findWordsOfUnspeakingItem(actor);
    if (existing) {
      if (Number(existing.system.spellLevel) === 0) {
        announceInfo(actor, game.i18n.format("DWAUTO.ClericDwarf.AlreadyGranted", { spell: existing.name }));
        return;
      }
      await existing.update({ "system.spellLevel": 0 });
      announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.ClericDwarf.Lowered", { spell: existing.name }));
      return;
    }

    const doc = await findWordsOfUnspeakingDocument();
    if (!doc) {
      console.warn(`${MODULE_ID} | cleric-dwarf: couldn't find Words of the Unspeaking in the cleric spell compendium`);
      return;
    }

    const data = doc.toObject();
    data.system.spellLevel = 0;
    data.system.description = `${data.system.description}<p><strong>${game.i18n.localize("DWAUTO.ClericDwarf.StoneOnlyNote")}</strong></p>`;
    await actor.createEmbeddedDocuments("Item", [data]);
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.ClericDwarf.Added", { spell: doc.name }));
  } catch (err) {
    console.error(`${MODULE_ID} | cleric-dwarf: onCreateChatMessage failed`, err);
  }
}

export function registerClericDwarfAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
