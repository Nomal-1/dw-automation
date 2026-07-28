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
export function getMoveCardInfo(message) {
  const card = $(message.content).find(".chat-card.move-card").first();
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

  const resultRow = card.find(".row.result");
  let result = null;
  if (resultRow.hasClass("success")) result = "success";
  else if (resultRow.hasClass("partial")) result = "partial";
  else if (resultRow.hasClass("failure")) result = "failure";

  const rollTotal = Number(card.attr("data-roll-total"));
  const isExtreme = result === "success" && Number.isFinite(rollTotal) && rollTotal >= 12;

  return { card, actor, title, result, rollTotal, isExtreme };
}

/** 채팅 카드의 (번역된) 무브 이름으로 그 액터가 실제로 가진 move 아이템을 찾는다.
 *  번역 모듈이 이름을 바꿔도, 카드에 찍힌 이름과 액터가 들고 있는 그 아이템의
 *  이름은 항상 똑같은 번역문이라 이 매칭은 언어와 무관하게 항상 성립한다. */
export function findMoveItem(actor, title) {
  return actor.items.find((i) => i.type === "move" && i.name === title) ?? null;
}
