import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { SPELL_PACK_FILES } from "../lib/translation-import.js";

// 사제-인간/마법사-인간(종족 핵심 액션, data/race-core-moves.js 참고) 원문:
// "다른 직업(마법사/사제) 주문을 하나 선택하십시오. 그 주문은 마치 자기
// 직업 주문인 것처럼 사용할 수 있습니다." 위저드 증보(Expanded Spellbook,
// features/spellbook-expansion.js)와 완전히 같은 "발동하면 한 번 골라
// 스펠북에 그대로 추가"인데, 그쪽은 클레릭/위저드 주문 전체 중에서 고르는
// 반면 이건 "다른 직업" 목록으로만 한정된다는 점만 다르다 — 두 종족 액션이
// 같은 로직을 공유하므로(사제-인간은 위저드 목록에서, 마법사-인간은 클레릭
// 목록에서) 이 파일 하나로 같이 처리한다.
const SPELL_PACK_IDS = SPELL_PACK_FILES.map((file) => file.replace(/\.json$/, ""));
const cachedSpellDocsByPackId = new Map();

// { [moveId]: spellName } — 다시 발동했을 때 무엇을 얻었는지 다시 보여준다.
const GRANTED_FLAG = "crossClassSpellGranted";

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_CROSS_CLASS_SPELL_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// title이 사제-인간/마법사-인간 중 어느 쪽이든, "다른 직업의 주문 팩 id"를
// 돌려준다. 어느 쪽도 아니면 null.
function getTargetPackId(title) {
  if (splitCommaList(SETTINGS.CLERIC_HUMAN_MOVE_NAMES).includes(title)) {
    return SPELL_PACK_IDS.find((id) => id.includes("wizard")) ?? null;
  }
  if (splitCommaList(SETTINGS.WIZARD_HUMAN_MOVE_NAMES).includes(title)) {
    return SPELL_PACK_IDS.find((id) => id.includes("cleric")) ?? null;
  }
  return null;
}

async function getSpellDocuments(packId) {
  if (cachedSpellDocsByPackId.has(packId)) return cachedSpellDocsByPackId.get(packId);

  const pack = game.packs.get(packId);
  if (!pack) return [];
  let docs = [];
  try {
    docs = await pack.getDocuments();
  } catch (err) {
    console.warn(`${MODULE_ID} | cross-class-spell: failed to load pack ${packId}`, err);
  }
  cachedSpellDocsByPackId.set(packId, docs);
  return docs;
}

function getGrantedName(actor, moveId) {
  return actor.getFlag(MODULE_ID, GRANTED_FLAG)?.[moveId] ?? null;
}

async function setGranted(actor, moveId, spellName) {
  const current = actor.getFlag(MODULE_ID, GRANTED_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, GRANTED_FLAG, { ...current, [moveId]: spellName });
}

// 이미 갖고 있는 주문은 목록에서 뺀다(중복 추가 방지). 후보가 하나도 없으면
// 다이얼로그 없이 바로 null.
function promptSpellChoice(moveItem, docs, actor) {
  const options = docs.filter((d) => !actor.items.some((i) => i.type === "spell" && i.name === d.name));
  if (options.length === 0) return Promise.resolve(null);

  const optionsHtml = options
    .slice()
    .sort((a, b) => Number(a.system?.spellLevel) - Number(b.system?.spellLevel) || a.name.localeCompare(b.name))
    .map((d) => `<option value="${d.id}">${d.name} (Lv.${d.system?.spellLevel ?? "?"})</option>`)
    .join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.CrossClassSpell.ChooseLabel")}</label>
            <select name="spellId">${optionsHtml}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const spellId = html.find('[name="spellId"]').val();
            resolve(options.find((d) => d.id === spellId) ?? null);
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
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

    const packId = getTargetPackId(title);
    if (!packId) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const existing = getGrantedName(actor, moveItem.id);
    if (existing) {
      announceInfo(actor, game.i18n.format("DWAUTO.CrossClassSpell.AlreadyGranted", { move: moveItem.name, spell: existing }));
      return;
    }

    const docs = await getSpellDocuments(packId);
    const chosen = await promptSpellChoice(moveItem, docs, actor);
    if (!chosen) return; // 취소 — 다음에 다시 발동하면 다시 물어본다.

    await setGranted(actor, moveItem.id, chosen.name);
    await actor.createEmbeddedDocuments("Item", [chosen.toObject()]);
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.CrossClassSpell.Added", { spell: chosen.name }));
  } catch (err) {
    console.error(`${MODULE_ID} | cross-class-spell: onCreateChatMessage failed`, err);
  }
}

export function registerCrossClassSpellAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
