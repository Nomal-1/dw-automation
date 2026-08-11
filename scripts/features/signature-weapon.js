import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceInfo } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { SignatureWeaponBuilderApp } from "../apps/signature-weapon-builder-app.js";

const ITEM_ID_FLAG = "signatureWeaponItemId";

// 전사 핵심액션 고유병기(Signature Weapon): 처음 발동하면(인벤토리에 이미
// 만들어둔 고유병기가 없으면) 원문 그대로 4개 질문(기본 형태/사정거리/강화
// 2개/외양)에 답하고 이름을 지어서 무기 아이템을 만든다(apps/
// signature-weapon-builder-app.js). 이미 만든 게 있으면(아이템을 직접
// 지우지 않은 한) 다시 만들지 않고 "이미 가지고 있다"고만 안내한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SIGNATURE_WEAPON_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.SIGNATURE_WEAPON_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Signature Weapon") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function getExistingSignatureWeapon(actor) {
  const itemId = actor.getFlag(MODULE_ID, ITEM_ID_FLAG);
  if (!itemId) return null;
  return actor.items.get(itemId) ?? null;
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

    const existing = getExistingSignatureWeapon(actor);
    if (existing) {
      announceInfo(actor, game.i18n.localize("DWAUTO.SignatureWeapon.AlreadyHave"));
      return;
    }

    new SignatureWeaponBuilderApp(actor, moveItem).render(true);
  } catch (err) {
    console.error(`${MODULE_ID} | signature-weapon: onCreateChatMessage failed`, err);
  }
}

export function registerSignatureWeaponAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
