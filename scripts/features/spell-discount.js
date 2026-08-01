import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 위저드 천재(Prodigy)/대가(Master) 원문: "주문 하나를 골라라. 그 주문을
// 준비할 때 한 레벨 낮은 것처럼 취급한다." 대가는 "천재에서 고른 것에 더해
// 하나를 더 고른다"(원문 그대로, 두 무브가 각각 독립적으로 주문 하나씩
// 할인해준다 — 이 모듈은 무브별로 슬롯을 하나씩 관리해서 자연히 누적되게
// 한다). 이 선택은 features/move-upgrades.js에도 "필요" 관계(대가가 천재를
// 대체하지 않음, deletesPrevious:false)로 이미 등록되어 있다.
//
// 클레릭 선택받은 자(Chosen One)/성유 받은 자(Anointed)도 원문이 완전히
// 똑같아서("Choose a spell. You are granted that spell as if it was one
// level lower.") 같은 자동화를 그대로 쓴다 — DISCOUNT_SPELL_MOVE_NAMES 기본값에
// 네 이름이 모두 들어있다.
//
// 여기서 저장하는 선택은 실제 숫자 계산에 쓰이지 않는다 — 그 계산은
// features/spell-preparation.js(Phase 6)의 주문 준비 창이 getDiscountedSpellIds로
// 이 선택을 읽어서, 골라둔 주문의 레벨을 실제보다 1 낮춰(0이면 칸트립처럼
// 항상 무료로 준비) 처리한다.
const DISCOUNT_FLAG = "discountedSpellByMove"; // { [moveId]: spellId }

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELL_DISCOUNT_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getDiscountMap(actor) {
  return actor.getFlag(MODULE_ID, DISCOUNT_FLAG) ?? {};
}

// features/spell-preparation.js가 주문 준비 창을 그릴 때 재사용한다. 이
// 액터가 천재/대가로 골라둔 주문들의 id를 전부 돌려준다(무브별로 하나씩).
export function getDiscountedSpellIds(actor) {
  return Object.values(getDiscountMap(actor));
}

async function setDiscountedSpell(actor, moveId, spellId) {
  const current = getDiscountMap(actor);
  await actor.setFlag(MODULE_ID, DISCOUNT_FLAG, { ...current, [moveId]: spellId });
}

// 주문 레벨 1 이상인 스펠북 주문 중에서 하나를 고르는 대화상자. 취소하면 null.
function promptDiscountChoice(moveItem, candidates) {
  const options = candidates.map((s) => `<option value="${s.id}">${s.name} (Lv.${s.system.spellLevel})</option>`).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.SpellDiscount.ChooseLabel")}</label>
            <select name="spell">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => resolve(html.find('[name="spell"]').val())
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

    const names = splitCommaList(SETTINGS.DISCOUNT_SPELL_MOVE_NAMES);
    if (!names.includes(title)) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const discountMap = getDiscountMap(actor);
    if (discountMap[moveItem.id]) return; // 이미 이 무브로 골라둔 주문이 있다 — 다시 묻지 않는다.

    const alreadyDiscountedIds = new Set(Object.values(discountMap));
    const candidates = actor.items.filter(
      (i) => i.type === "spell" && Number(i.system?.spellLevel) >= 1 && !alreadyDiscountedIds.has(i.id)
    );

    if (candidates.length === 0) {
      ui.notifications.warn(game.i18n.format("DWAUTO.SpellDiscount.NoCandidates", { name: actor.name }));
      return;
    }

    const spellId = await promptDiscountChoice(moveItem, candidates);
    if (!spellId) return; // 취소 — 다음에 다시 발동하면 다시 물어본다.

    await setDiscountedSpell(actor, moveItem.id, spellId);
    const spell = actor.items.get(spellId);
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.SpellDiscount.Discounted", { spell: spell?.name ?? "?" })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | spell-discount: onCreateChatMessage failed`, err);
  }
}

// 클레릭 선택받은 자(Chosen One)/성유 받은 자(Anointed) 원문이 위저드 천재/
// 대가와 완전히 같음을 확인해서(v0.35.x) 기본값에 추가했다. 이 설정은 단순
// 텍스트 필드라 GM이 설정 화면을 한 번이라도 열어서 저장한 적 있으면 그
// 시점의 값(옛 기본값)이 그대로 굳어 있을 수 있다 — 이미 저장된 값에 없는
// 이름만 골라 한 번 추가해준다(다른 표들의 migrateAddSurveyedDefaults와
// 같은 이유).
async function migrateAddSurveyedDefaults() {
  if (!game.user.isGM) return;

  const currentNames = splitCommaList(SETTINGS.DISCOUNT_SPELL_MOVE_NAMES);
  const existing = new Set(currentNames);

  let nameMap = null;
  try {
    nameMap = await getMoveNameMap();
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 이름으로는 추가한다.
  }

  const toAdd = [];
  for (const name of ["Chosen One", "Anointed"]) {
    const translated = nameMap?.get(name);
    if (existing.has(name) || (translated && existing.has(translated))) continue;
    toAdd.push(translated ?? name);
  }

  if (toAdd.length === 0) return;

  await game.settings.set(MODULE_ID, SETTINGS.DISCOUNT_SPELL_MOVE_NAMES, [...currentNames, ...toAdd].join(", "));
  console.log(`${MODULE_ID} | spell-discount: added ${toAdd.length} newly-surveyed default move name(s)`, toAdd);
}

export function registerSpellDiscountAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.once("ready", () => {
    migrateAddSurveyedDefaults();
  });
}
