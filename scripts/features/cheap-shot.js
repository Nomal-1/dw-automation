import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 도적 고급액션 급소 가격(Cheap Shot) 원문: "정밀 또는 반걸음(Hand) 무기를
// 사용하면 암습의 피해가 +1d6 늘어납니다." features/attack-assistant.js가
// 암습(Backstab) 선택지에서 "피해 +1d6"를 고르면 무기 선택 대화상자를
// 띄우는데, 여기서 실제로 고른 무기의 태그를 검사해 조건에 맞으면 자동으로
// 데미지 공식에 1d6을 더 얹는다(요청대로 무기를 다시 고르게 하지 않고,
// 이미 암습 흐름에서 고른 무기를 그대로 재사용).
//
// 치사한 수법(Dirty Fighter, 6레벨, 급소 가격 대체) 원문: "정밀 또는
// 반걸음 무기를 사용하면 암습은 +1d8, 다른 모든 공격은 +1d4 피해를
// 받습니다." — "정밀/반걸음 무기를 사용하면"이라는 조건절이 두 효과 모두를
// 지배하므로(영문 원문 확인) 둘 다 같은 무기 태그 검사를 거친다. "다른 모든
// 공격"을 문자 그대로 구현하면 이 모듈이 자동화하는 모든 공격형 무브(정조준
// 등)까지 번져서 범위가 불명확해지므로, 사용자 요청대로 접근전(Hack &
// Slash)/사격(Volley) 두 기본 무브로만 한정한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_CHEAP_SHOT_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findCheapShotMove(actor) {
  const names = splitCommaList(SETTINGS.CHEAP_SHOT_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function findDirtyFighterMove(actor) {
  const names = splitCommaList(SETTINGS.DIRTY_FIGHTER_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function isMeleeOrRangedTitle(title) {
  const meleeNames = splitCommaList(SETTINGS.MELEE_MOVE_NAMES);
  const rangedNames = splitCommaList(SETTINGS.RANGED_MOVE_NAMES);
  return meleeNames.includes(title) || rangedNames.includes(title);
}

async function isBackstabTitle(title) {
  const configured = splitCommaList(SETTINGS.BACKSTAB_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Backstab") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

// 무기 태그 원문(precise/hand)은 번역 여부와 무관하게 항상 영문으로
// 남는다(data/signature-weapon-tables.js 등에서 이미 확인된 관례).
function isPreciseOrHandWeapon(weapon) {
  const tags = (weapon.system?.tagsString ?? "").toLowerCase();
  return /\bprecise\b/.test(tags) || /\bhand\b/.test(tags);
}

// features/attack-assistant.js가 데미지를 굴리기 직전(무기가 정해진 뒤)에
// 호출한다. 데미지 공식에 이어붙일 추가 다이스 문자열을 반환하고, 조건에
// 안 맞으면 빈 문자열을 반환한다.
export async function getCheapShotBonus(actor, moveTitle, weapon) {
  if (!isEnabled()) return "";
  if (!moveTitle || !weapon) return "";
  if (!isPreciseOrHandWeapon(weapon)) return "";

  const dirtyFighter = findDirtyFighterMove(actor);
  const isBackstab = await isBackstabTitle(moveTitle);

  if (isBackstab) {
    if (dirtyFighter) {
      announceActionApplied(actor, dirtyFighter.name, game.i18n.localize("DWAUTO.CheapShot.DirtyFighterBackstabApplied"));
      return "1d8";
    }
    const moveItem = findCheapShotMove(actor);
    if (!moveItem) return "";
    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.CheapShot.Applied"));
    return "1d6";
  }

  if (!dirtyFighter) return "";
  if (!isMeleeOrRangedTitle(moveTitle)) return "";

  announceActionApplied(actor, dirtyFighter.name, game.i18n.localize("DWAUTO.CheapShot.DirtyFighterOtherApplied"));
  return "1d4";
}

export function registerCheapShotAssistant() {
  // 훅이 따로 필요 없다 — attack-assistant.js가 getCheapShotBonus를 직접 불러서 쓴다.
}
