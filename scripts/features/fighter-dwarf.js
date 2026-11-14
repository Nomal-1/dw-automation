import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { filterDisabledNames, isMoveItemDisabled } from "../lib/move-toggles.js";

// 전사-드워프(종족 핵심 액션, data/race-core-moves.js 참고) 원문: "누군가와
// 술을 같이 마시는 동안, 그 사람과 협상을 할 때 CHA 대신 CON으로 판정할 수
// 있습니다." "함께 술을 마시는 중인지"는 매번 서사적 판단이 필요해서
// 협박/정밀/익숙한 사냥감과 같은 방식으로 판정 직전마다 물어본다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_FIGHTER_DWARF_ASSISTANT);
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

function findFighterDwarfMove(actor) {
  const names = splitCommaList(SETTINGS.FIGHTER_DWARF_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && ((names.includes(i.name) || names.includes(i.flags?.babele?.originalName)) && !isMoveItemDisabled(i))) ?? null;
}

function matchesParleyByTitle(title) {
  return splitCommaList(SETTINGS.PARLEY_MOVE_NAMES).includes(title);
}

// 카드 제목(번역문)으로 못 찾으면 그 무브 아이템의 원문 영어 이름(Babele가 남기는
// flags.babele.originalName, getMoveCardInfo의 originalTitle)으로 한 번 더 본다.
// 설정 기본값이 원문이라 한글화 문구가 바뀌어도 자동화가 끊기지 않는다.
function matchesParley(title, originalTitle = null) {
  const byTitle = matchesParleyByTitle(title);
  if (byTitle || !originalTitle || originalTitle === title) return byTitle;
  return matchesParleyByTitle(originalTitle);
}

// lib/roll-wrapper.js가 협박/정밀/논리적/익숙한 사냥감과 같은 자리에서
// 호출한다.
export async function promptFighterDwarfPreRoll(item) {
  if (!isEnabled()) return { statOverride: null };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { statOverride: null };
  if (!matchesParley(item.name, item.flags?.babele?.originalName)) return { statOverride: null };

  const moveItem = findFighterDwarfMove(actor);
  if (!moveItem) return { statOverride: null };

  const apply = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.FighterDwarf.Prompt")}</p>`,
    defaultYes: false
  });
  if (!apply) return { statOverride: null };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.FighterDwarf.Applied"));
  return { statOverride: "CON" };
}
