import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap, MOVE_PACK_FILES } from "../lib/translation-import.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { isTwiceAsBrightUsed, setTwiceAsBrightUsed } from "../lib/twice-as-bright-state.js";

// 소각술사 고급액션 두 개를 한 쌍으로 묶어서 처리한다.
//
// 곱절로 밝게 타올라(Burns Twice As Bright) 원문: "운명의 불길을 불러오면,
// 실패한 판정을 7-9로, 7-9를 10+로 바꿀 수 있습니다... 반절로 길게 타올라를
// 사용하기 전까지 이 액션을 다시 사용할 수 없습니다." — 판정 등급 자체를
// 고쳐쓰는 부분은(다른 자동화와 경합하는 문제 때문에) 자동화하지 않기로
// 했고, 대신 "재사용 잠금" 상태 추적과, 반절로 길게 타올라를 아직 안 갖고
// 있으면 자동으로 부여하는 부분만 자동화한다(이 두 액션은 사실상 항상 쌍으로
// 다녀야 하므로).
//
// 반절로 길게 타올라(Burns Half As Long) 원문: "운명의 불길에 승리를
// 제물로 바치면, 10+ 판정을 실패로 칩니다." — 발동하면 곱절로 밝게 타올라의
// 잠금을 풀어준다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_TWICE_AS_BRIGHT_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findMoveByConfiguredNames(actor, settingKey) {
  const names = splitCommaList(settingKey);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

async function matchesMove(title, settingKey, englishName) {
  const configured = splitCommaList(settingKey);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get(englishName) === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

// class-grant.js의 getAllMoveDocuments/findMoveDocumentByName과 같은
// 패턴이다 — 8개 기본 직업 + 소각술사 컴펜디엄 전체에서 이름으로 무브를
// 찾아 그대로 부여한다.
const MOVE_PACK_IDS = MOVE_PACK_FILES.map((file) => file.replace(/\.json$/, ""));
let cachedMoveDocs = null;

async function getAllMoveDocuments() {
  if (cachedMoveDocs) return cachedMoveDocs;
  const lists = await Promise.all(
    MOVE_PACK_IDS.map(async (packId) => {
      const pack = game.packs.get(packId);
      if (!pack) return [];
      try {
        return await pack.getDocuments();
      } catch (err) {
        console.warn(`${MODULE_ID} | twice-as-bright: failed to load pack ${packId}`, err);
        return [];
      }
    })
  );
  cachedMoveDocs = lists.flat();
  return cachedMoveDocs;
}

async function findMoveDocumentByName(name) {
  const docs = await getAllMoveDocuments();
  return docs.find((d) => d.name === name) ?? null;
}

async function grantHalfAsLongIfMissing(actor) {
  if (findMoveByConfiguredNames(actor, SETTINGS.HALF_AS_LONG_MOVE_NAMES)) return null;

  const doc = await findMoveDocumentByName("Burns Half As Long");
  if (!doc) {
    console.warn(`${MODULE_ID} | twice-as-bright: couldn't find "Burns Half As Long" in the move compendium`);
    return null;
  }

  const [created] = await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
  return created;
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

    const moveItem = findMoveItem(actor, title);

    if (await matchesMove(title, SETTINGS.TWICE_AS_BRIGHT_MOVE_NAMES, "Burns Twice As Bright")) {
      await setTwiceAsBrightUsed(actor, true);
      const granted = await grantHalfAsLongIfMissing(actor);
      announceActionApplied(
        actor,
        moveItem?.name ?? title,
        granted
          ? game.i18n.format("DWAUTO.TwiceAsBright.GrantedHalfAsLong", { move: granted.name })
          : game.i18n.localize("DWAUTO.TwiceAsBright.Locked")
      );
      return;
    }

    if (await matchesMove(title, SETTINGS.HALF_AS_LONG_MOVE_NAMES, "Burns Half As Long")) {
      await setTwiceAsBrightUsed(actor, false);
      announceActionApplied(actor, moveItem?.name ?? title, game.i18n.localize("DWAUTO.TwiceAsBright.Ready"));
    }
  } catch (err) {
    console.error(`${MODULE_ID} | twice-as-bright: onCreateChatMessage failed`, err);
  }
}

// 곱절로 밝게 타올라 옆에 사용함/사용안함 배지를 붙인다. hunger-penalty
// 배지와 같은 이유로 누구나 클릭해서 직접 뒤집을 수 있다(GM 전용으로 막지
// 않는다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findMoveByConfiguredNames(actor, SETTINGS.TWICE_AS_BRIGHT_MOVE_NAMES);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-twice-as-bright-badge").remove();

  const used = isTwiceAsBrightUsed(actor);
  const $badge = $(
    `<a class="tag dwauto-twice-as-bright-badge${used ? " dwauto-twice-as-bright-on" : ""}" title="${game.i18n.localize("DWAUTO.TwiceAsBright.ToggleTitle")}">${game.i18n.localize(used ? "DWAUTO.TwiceAsBright.Used" : "DWAUTO.TwiceAsBright.Unused")}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setTwiceAsBrightUsed(actor, !used);
  });
}

export function registerTwiceAsBrightAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
