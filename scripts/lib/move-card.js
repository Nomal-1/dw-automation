import { MODULE_ID } from "../constants.js";
import { isNameDisabled } from "./move-toggles.js";
// 던전월드 무브 굴림 채팅 카드(dungeonworld/templates/chat/chat-move.html) 공용 파서.
//   <section><div class="... chat-card move-card" data-actor-id="..." data-roll-total="...">
//     <h2 class="cell__title">{{move name}}</h2>
//     <div class="row result success|partial|failure">...</div>
// 여러 기능(공격 보조, 클래스 무브 자동화)이 전부 이 구조를 읽어야 해서 공용으로 뺐다.
//
// 12+ 여부는 시스템이 채팅 카드에 별도로 표시해주지 않는다(10+든 12+든 그냥
// "success" 클래스 하나). data-roll-total에 담긴 실제 합계를 직접 읽어서
// 판단한다. isExtreme은 isSuccess와 배타적이지 않다 — 12+는 성공이면서 동시에
// 극단적 성공이다.
// 채팅 메시지 하나가 만들어지면 50개 넘는 기능이 각자 이 함수를 불러 같은 카드를 읽는다.
// HTML을 매번 다시 해석하지 않도록 메시지별로 한 번만 해석해 둔다(내용이 바뀌면 다시 해석).
// 이 모듈은 카드를 읽기만 하고 고치지 않으므로 같은 jQuery 객체를 함께 써도 된다.
const parsedCards = new WeakMap(); // message -> { content, card }

function parseCard(message, content) {
  const cached = parsedCards.get(message);
  if (cached && cached.content === content) return cached.card;
  // $(문자열)은 "<"로 시작하지 않는 글(예: 그냥 채팅, 앞에 글자가 붙은 안내 메시지)을 CSS 선택자로
  // 해석해서 오류를 던진다. 무브 카드가 아닌 메시지는 많으므로 빈 div 안에 넣어서 읽는다.
  const card = $("<div>").html(content).find(".chat-card.move-card").first();
  if (message && typeof message === "object") parsedCards.set(message, { content, card });
  return card;
}

export function getMoveCardInfo(message) {
  const content = message?.content;
  if (!content || !content.includes("move-card")) return null;
  const card = parseCard(message, content);
  if (!card.length) return null;

  // 시스템 자체 버그: rolls.js가 주사위를 굴리는 분기에서만 templateData.actor를
  // 채워서 data-actor-id에 넣어준다. 대지의 아들/딸처럼 rollType이 없는
  // 서술형 무브는 이 분기를 안 타서 data-actor-id가 항상 빈 채로 렌더된다.
  // message.speaker.actor(ChatMessage.getSpeaker)는 두 경우 모두 항상 채워지므로
  // data-actor-id가 비었을 때 이걸로 대신 찾는다.
  const actorId = card.attr("data-actor-id") || message.speaker?.actor;
  const actor = game.actors.get(actorId);
  if (!actor) return null;

  const title = card.find(".cell__title").first().text().trim();
  // 굴릴 때 기록해 둔 아이템이 있으면 이름으로 찾지 않고 그 아이템을 쓴다(같은 이름의 액션이 둘이어도 정확)
  const rolledItemId = message.flags?.[MODULE_ID]?.rolledItem;
  const rolledItem = rolledItemId ? actor.items.get(rolledItemId) : null;

  const resultRow = card.find(".row.result");
  let result = null;
  if (resultRow.hasClass("success")) result = "success";
  else if (resultRow.hasClass("partial")) result = "partial";
  else if (resultRow.hasClass("failure")) result = "failure";

  const rollTotal = Number(card.attr("data-roll-total"));
  const isExtreme = result === "success" && Number.isFinite(rollTotal) && rollTotal >= 12;

  // 카드 제목은 아이템 이름(번역문)이다. 그 아이템에 Babele가 남긴 원문 영어 이름이
  // 있으면 함께 넘긴다. 이름 목록 설정의 기본값이 원문이라, 한글화 문구가 바뀌어도
  // 각 기능이 원문으로 다시 알아볼 수 있다. 플래그가 없으면(손으로 만든 아이템 등) null.
  const originalTitle = (rolledItem ?? findMoveItem(actor, title))?.flags?.babele?.originalName ?? null;

  // 직업별 자동화 창에서 이 액션의 자동화를 껐으면 카드가 없는 것처럼 돌려준다
  // (굴린 뒤 처리하는 모든 기능이 이 함수로 카드를 읽는다 — lib/move-toggles.js)
  if (isNameDisabled(title, actor) || isNameDisabled(originalTitle, actor)) return null;

  return { card, actor, title, originalTitle, result, rollTotal, isExtreme, item: rolledItem };
}

// ---- 굴린 아이템 기록 ----
// 무브를 굴리기 직전에 그 아이템을 기억해 두었다가, 곧바로 만들어지는 무브 카드 메시지에
// flags.dw-automation.rolledItem으로 아이템 id를 붙인다(Foundry 14 preCreateChatMessage에서 updateSource).
let pendingRolledItem = null; // { itemId, actorId, time }

/** lib/roll-wrapper.js가 무브를 굴리기 직전에 부른다 */
export function noteRolledItem(item) {
  if (!item?.id || !item.actor) return;
  pendingRolledItem = { itemId: item.id, actorId: item.actor.id, time: Date.now() };
}

export function registerRolledItemTracking() {
  Hooks.on("preCreateChatMessage", (message) => {
    const pending = pendingRolledItem;
    if (!pending) return;
    if (Date.now() - pending.time > 60_000) {
      pendingRolledItem = null;
      return;
    }
    const content = message.content ?? "";
    if (!content.includes("move-card")) return;
    const speakerActor = message.speaker?.actor;
    if (speakerActor && speakerActor !== pending.actorId) return;
    pendingRolledItem = null;
    message.updateSource({ [`flags.${MODULE_ID}.rolledItem`]: pending.itemId });
  });
}

/** 채팅 카드의 (번역된) 무브 이름으로 그 액터가 실제로 가진 move 아이템을 찾는다.
 *  번역 모듈이 이름을 바꿔도, 카드에 찍힌 이름과 액터가 들고 있는 그 아이템의
 *  이름은 항상 똑같은 번역문이라 이 매칭은 언어와 무관하게 항상 성립한다. */
export function findMoveItem(actor, title) {
  return actor.items.find((i) => i.type === "move" && i.name === title) ?? null;
}
