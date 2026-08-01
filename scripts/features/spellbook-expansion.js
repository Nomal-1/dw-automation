import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { SPELL_PACK_FILES } from "../lib/translation-import.js";

// 위저드 증보(Expanded Spellbook) 원문: "Add a new spell from the spell list
// of any class to your spellbook." — "When you..." 조건절 없이 그냥 지시문
// 형태라(천재/Herculean Appetites처럼), 무브를 딸 때 한 번 실행하는 선택으로
// 취급한다(features/class-grant.js의 "고정/자유 선택" 무브들과 같은
// "한 번 발동하면 끝" 패턴). 실제로 발동하면 클레릭/위저드 주문 목록 전체에서
// 직업을 먼저 고르고, 그 직업의 주문 목록에서 하나를 골라 스펠북에 그대로
// 추가한다(system.prepared는 false로 시작 — 준비하려면 별도로 주문 준비를
// 다시 해야 한다).
// { [moveId]: { spellName, classLabel } } — 다시 발동했을 때 "이 캐릭터가
// 증보로 얻은 주문이 뭐였는지" 다시 보여줄 수 있게 실제로 고른 결과를
// 남겨둔다.
const GRANTED_FLAG = "spellbookExpansionGranted";
const SPELL_PACK_IDS = SPELL_PACK_FILES.map((file) => file.replace(/\.json$/, ""));
let cachedSpellGroups = null;

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELLBOOK_EXPANSION_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// v0.35.0에서는 이 플래그가 그냥 boolean true였다(어떤 주문인지 기록 안 함).
// 이미 그 버전에서 증보를 써버린 세계도 있으므로, 값이 객체가 아니면
// (레거시 true) 주문 이름을 모른다는 표시로 spellName을 null로 돌려준다.
function getGrantedInfo(actor, moveId) {
  const value = actor.getFlag(MODULE_ID, GRANTED_FLAG)?.[moveId];
  if (!value) return null;
  return typeof value === "object" ? value : { spellName: null, classLabel: null };
}

async function setGranted(actor, moveId, info) {
  const current = actor.getFlag(MODULE_ID, GRANTED_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, GRANTED_FLAG, { ...current, [moveId]: info });
}

// 클레릭/위저드 주문 팩별로(전체 목록을 한 번 캐시) 묶어서 돌려준다. 팩의
// label(예: "The Wizard Spells")을 그대로 쓴다.
async function getSpellsGroupedByClassPack() {
  if (cachedSpellGroups) return cachedSpellGroups;

  const groups = new Map(); // packId -> { label, docs }
  await Promise.all(
    SPELL_PACK_IDS.map(async (packId) => {
      const pack = game.packs.get(packId);
      if (!pack) return;
      try {
        const docs = await pack.getDocuments();
        groups.set(packId, { label: pack.metadata.label, docs });
      } catch (err) {
        console.warn(`${MODULE_ID} | spellbook-expansion: failed to load pack ${packId}`, err);
      }
    })
  );
  cachedSpellGroups = groups;
  return groups;
}

// 직업을 먼저 고르고, 그 직업의 주문 목록에서 하나를 고르는 대화상자. 직업
// 선택이 바뀌면 주문 목록도 그에 맞게 다시 채운다. 이미 갖고 있는 주문은
// 목록에서 뺀다(중복 추가 방지). 취소하면 null.
function promptSpellChoice(moveItem, spellGroups, actor) {
  const packIds = Array.from(spellGroups.keys()).filter((packId) => {
    const { docs } = spellGroups.get(packId);
    return docs.some((d) => !actor.items.some((i) => i.type === "spell" && i.name === d.name));
  });
  if (packIds.length === 0) return Promise.resolve(null);

  const buildSpellOptions = (packId) =>
    spellGroups
      .get(packId)
      .docs.filter((d) => !actor.items.some((i) => i.type === "spell" && i.name === d.name))
      .sort((a, b) => Number(a.system?.spellLevel) - Number(b.system?.spellLevel) || a.name.localeCompare(b.name))
      .map((d) => `<option value="${d.id}">${d.name} (Lv.${d.system?.spellLevel ?? "?"})</option>`)
      .join("");

  const classOptionsHtml = packIds.map((packId) => `<option value="${packId}">${spellGroups.get(packId).label}</option>`).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.SpellbookExpansion.ChooseClassLabel")}</label>
            <select name="classPack">${classOptionsHtml}</select>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.SpellbookExpansion.ChooseSpellLabel")}</label>
            <select name="spellId">${buildSpellOptions(packIds[0])}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const packId = html.find('[name="classPack"]').val();
            const spellId = html.find('[name="spellId"]').val();
            const doc = spellGroups.get(packId)?.docs.find((d) => d.id === spellId);
            resolve(doc ? { doc, packId } : null);
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      width: 420,
      render: (html) => {
        html.find('[name="classPack"]').on("change", (event) => {
          html.find('[name="spellId"]').html(buildSpellOptions(event.currentTarget.value));
        });
      },
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

    const names = splitCommaList(SETTINGS.EXPANDED_SPELLBOOK_MOVE_NAMES);
    if (!names.includes(title)) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const existing = getGrantedInfo(actor, moveItem.id);
    if (existing) {
      // 이미 얻은 주문이 있다 — 다시 고르게 하지 않고, 그때 무엇을 얻었는지만
      // 다시 알려준다. 레거시 데이터(v0.35.0, 어떤 주문인지 기록 안 함)라면
      // 이름을 모른다는 안내로 대체한다.
      announceInfo(
        actor,
        existing.spellName
          ? game.i18n.format("DWAUTO.SpellbookExpansion.AlreadyGranted", {
              move: moveItem.name,
              class: existing.classLabel,
              spell: existing.spellName
            })
          : game.i18n.format("DWAUTO.SpellbookExpansion.AlreadyGrantedUnknown", { move: moveItem.name })
      );
      return;
    }

    const spellGroups = await getSpellsGroupedByClassPack();
    const chosen = await promptSpellChoice(moveItem, spellGroups, actor);
    if (!chosen) return; // 취소 — 다음에 다시 발동하면 다시 물어본다.

    const classLabel = spellGroups.get(chosen.packId)?.label ?? chosen.packId;
    await setGranted(actor, moveItem.id, { spellName: chosen.doc.name, classLabel });
    await actor.createEmbeddedDocuments("Item", [chosen.doc.toObject()]);
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.SpellbookExpansion.Added", { spell: chosen.doc.name })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | spellbook-expansion: onCreateChatMessage failed`, err);
  }
}

export function registerSpellbookExpansionAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
