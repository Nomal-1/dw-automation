import { MODULE_ID } from "../constants.js";

// 다른 사용자(대개 GM)에게 "이것 좀 확인/처리해 주세요"라고 묻고 답을 기다리는 공통 도우미.
// Foundry 13+의 질의(queries) 기능을 쓴다: 받는 쪽은 CONFIG.queries에 처리 함수를 등록해 두고,
// 묻는 쪽은 user.query(이름, 데이터)를 부르면 그 사용자의 처리 함수가 돌려준 값을 받는다.
//
// 예전에는 기능마다 소켓 메시지(요청 → 응답)와 요청 번호 표(pending…Map)를 직접 관리했다.
// 그 방식은 ① 모든 GM에게 요청이 가서 GM이 둘이면 창이 두 번 떴고 ② GM 자신이 요청하면
// 소켓이 자기에게는 오지 않아 영영 기다렸고 ③ 창을 그냥 닫으면 응답이 없어 멈췄다.
// 여기서는 한 사람에게만 묻고, 자기 자신이면 바로 처리하고, 실패하면 기본값을 돌려준다.

const QUERY_PREFIX = `${MODULE_ID}.`;

/** 받는 쪽 처리 함수를 등록한다. handler(data) → 돌려줄 값(Promise 가능, JSON으로 보낼 수 있는 값). */
export function registerQuery(name, handler) {
  CONFIG.queries ??= {};
  CONFIG.queries[QUERY_PREFIX + name] = async (data) => handler(data ?? {});
}

/** 지금 접속 중인 대표 GM(없으면 null). Foundry가 정한 activeGM을 먼저 쓴다. */
export function activeGM() {
  return game.users.activeGM ?? game.users.find((u) => u.active && u.isGM) ?? null;
}

/**
 * user에게 묻고 답을 돌려받는다. 자기 자신이면 소켓을 거치지 않고 바로 처리한다.
 * 상대가 접속해 있지 않거나 오류가 나면 fallback을 돌려준다(굴림 흐름이 멈추지 않게).
 */
export async function queryUser(user, name, data = {}, fallback = null) {
  if (!user) return fallback;
  const fullName = QUERY_PREFIX + name;
  try {
    if (user.isSelf) {
      const handler = CONFIG.queries?.[fullName];
      if (!handler) throw new Error(`no handler for ${fullName}`);
      return (await handler(data, {})) ?? fallback;
    }
    if (!user.active) return fallback;
    return (await user.query(fullName, data)) ?? fallback;
  } catch (err) {
    console.warn(`${MODULE_ID} | query ${name} to ${user.name} failed`, err);
    return fallback;
  }
}

/** 대표 GM에게 묻는다. GM이 없으면 fallback. */
export function queryGM(name, data = {}, fallback = null) {
  return queryUser(activeGM(), name, data, fallback);
}

/**
 * actor를 고칠 권한이 없으면(다른 플레이어의 캐릭터 등) 대표 GM에게 대신 고쳐 달라고 한다.
 * 성공하면 true. 권한이 있으면 바로 고친다. GM이 없거나 실패하면 false.
 */
export async function updateActorAsGM(actor, changes, options = {}) {
  if (!actor) return false;
  if (actor.isOwner) {
    await actor.update(changes, options);
    return true;
  }
  return !!(await queryGM("updateActor", { actorId: actor.id, changes, options }, false));
}

/** 여러 기능이 같이 쓰는 질의(액터 대신 고치기)를 등록한다. main.js의 init에서 부른다. */
export function registerCoreQueries() {
  registerQuery("updateActor", async ({ actorId, changes, options }) => {
    const actor = game.actors.get(actorId);
    if (!actor || !game.user.isGM) return false;
    try {
      await actor.update(changes ?? {}, options ?? {});
      return true;
    } catch (err) {
      console.warn(`${MODULE_ID} | updateActor query failed`, err);
      return false;
    }
  });
}
