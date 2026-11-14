import { MODULE_ID, SETTINGS } from "../constants.js";

// 직업별 자동화 창에서 "이 액션 자동화"를 끈 액션 목록과 그 판별.
//
// 저장 형식(월드 설정 SETTINGS.DISABLED_MOVES, 배열):
//   { cls: "fighter", original: "Multiclass Dabbler", name: "다중직업 입문", ambiguous: true }
// - original/name: 원문 영어 이름과 번역된 이름. 둘 중 하나라도 맞으면 그 액션으로 본다.
// - ambiguous: 같은 원문 이름이 여러 직업 팩에 있는 액션(다중직업 액션, 신의 가호 등).
//   이름만으로는 어느 직업 것인지 모르므로, 캐릭터의 본래 직업이 cls일 때만 꺼진 것으로 본다.
//
// 끈 액션은 세 군데에서 걸러진다:
//   1) getMoveCardInfo(lib/move-card.js): 그 액션의 채팅 카드를 "카드 없음"으로 돌려줘서
//      굴린 뒤 처리하는 모든 기능이 무시한다.
//   2) 각 기능 파일의 splitCommaList: 이름 목록에서 그 이름을 뺀다(굴리기 전·패시브 계산).
//   3) 캐릭터가 가진 액션을 찾는 곳: isMoveItemDisabled로 그 아이템을 없는 것으로 친다.

const norm = (name) => String(name ?? "").replace(/[’‘]/g, "'").trim();

export function getDisabledMoves() {
  try {
    const value = game.settings.get(MODULE_ID, SETTINGS.DISABLED_MOVES);
    return Array.isArray(value) ? value : [];
  } catch (err) {
    return [];
  }
}

/** 캐릭터의 본래 직업 키(fighter, wizard …). 직업 아이템의 원문 이름("The Fighter")에서 얻는다. */
export function actorClassKey(actor) {
  const cls = actor?.items?.find((i) => i.type === "class");
  const raw = cls?.flags?.babele?.originalName ?? cls?.name ?? "";
  return norm(raw).toLowerCase().replace(/^the\s+/, "").replace(/\s+/g, "-") || null;
}

function entryMatchesName(entry, name) {
  const n = norm(name);
  return !!n && (norm(entry.original) === n || norm(entry.name) === n);
}

/** 이 이름(번역 또는 원문)의 액션이 이 캐릭터에게 꺼져 있나 */
export function isNameDisabled(name, actor = null) {
  const list = getDisabledMoves();
  if (!list.length || !name) return false;
  let actorKey;
  return list.some((entry) => {
    if (!entryMatchesName(entry, name)) return false;
    if (!entry.ambiguous) return true;
    actorKey ??= actorClassKey(actor);
    return !!actorKey && actorKey === entry.cls;
  });
}

/** 액터가 가진 무브/주문 아이템이 꺼진 액션인가 */
export function isMoveItemDisabled(item) {
  if (!item) return false;
  const actor = item.parent ?? item.actor ?? null;
  return isNameDisabled(item.name, actor) || isNameDisabled(item.flags?.babele?.originalName, actor);
}

/**
 * 이름 목록에서 꺼진 액션 이름을 뺀다. 캐릭터를 모르는 자리라서 직업이 겹치는(ambiguous)
 * 액션은 여기서 빼지 않는다 — 그런 액션은 카드(1)와 아이템 판별(3)에서 걸러진다.
 */
export function filterDisabledNames(names) {
  const list = getDisabledMoves().filter((e) => !e.ambiguous);
  if (!list.length) return names;
  return names.filter((n) => !list.some((entry) => entryMatchesName(entry, n)));
}

/** 창에서 쓰는 저장 함수 */
export async function setMoveDisabled({ cls, original, name, ambiguous }, disabled) {
  const list = getDisabledMoves().filter(
    (e) => !(norm(e.original ?? e.name) === norm(original ?? name) && (!(e.ambiguous || ambiguous) || e.cls === cls))
  );
  if (disabled) list.push({ cls, original: original ?? null, name, ambiguous: !!ambiguous });
  await game.settings.set(MODULE_ID, SETTINGS.DISABLED_MOVES, list);
}

export function isEntryDisabled({ cls, original, name, ambiguous }) {
  return getDisabledMoves().some(
    (e) => norm(e.original ?? e.name) === norm(original ?? name) && (!(e.ambiguous || ambiguous) || e.cls === cls)
  );
}
