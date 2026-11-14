import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceInfo } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { SignatureWeaponBuilderApp } from "../apps/signature-weapon-builder-app.js";
import { filterDisabledNames } from "../lib/move-toggles.js";

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

async function matchesConfiguredNameByTitle(title) {
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

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
async function matchesConfiguredName(title, originalTitle = null) {
  const byTitle = await matchesConfiguredNameByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return await matchesConfiguredNameByTitle(originalTitle);
}

// features/improved-weapon.js가 재사용한다 — 무기 강화 발동 시 "이미 고유
// 병기가 있는지"를 판단하는 근거가 이것과 완전히 같아야 하므로(플래그
// 이름을 두 곳에서 따로 관리하면 어긋날 위험이 있다).
export function getExistingSignatureWeapon(actor) {
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
    const { actor, title, originalTitle } = info;
    if (actor.type !== "character") return;

    if (!(await matchesConfiguredName(title, originalTitle))) return;

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
