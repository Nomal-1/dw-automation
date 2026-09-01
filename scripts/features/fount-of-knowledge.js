import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { isFountOfKnowledgeAskMode, setFountOfKnowledgeAskMode } from "../lib/fount-of-knowledge-state.js";

// 위저드 무브 지식의 샘(Fount of Knowledge) 원문: "아무도 모를 법한 것에
// 대해 지식 더듬기(Spout Lore)를 할 때 +1." "아무도 모를 법한 것"인지는
// 매번 서사적 판단이 필요해서 자동으로 감지할 수 없다 — 다른 조건부
// 무브들과 달리 "항상 적용" 옵션은 의미가 없으므로(그 자리에서 실제로
// 해당하는 상황인지 판단해야 하는 보너스라 무조건 켜두면 원문과 어긋난다)
// 토글은 "항상 묻기"(판정 직전마다 확인)와 "항상 미적용"(아예 묻지
// 않고 넘어감) 두 상태만 둔다.
function isEnabled() {
  return (
    game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_FOUNT_OF_KNOWLEDGE_ASSISTANT)
  );
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findFountOfKnowledgeMove(actor) {
  const names = splitCommaList(SETTINGS.FOUNT_OF_KNOWLEDGE_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function matchesSpoutLore(title) {
  return splitCommaList(SETTINGS.SPOUT_LORE_MOVE_NAMES).includes(title);
}

// lib/roll-wrapper.js가 판정 "직전"에 다른 사전 보정치들과 같은 자리에서
// 호출한다. 지식의 샘이 없거나, 지금 굴리려는 게 지식 더듬기가 아니거나,
// "항상 미적용" 모드면 조용히 통과한다.
export async function promptFountOfKnowledgePreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { bonus: 0 };
  if (!matchesSpoutLore(item.name)) return { bonus: 0 };

  const moveItem = findFountOfKnowledgeMove(actor);
  if (!moveItem) return { bonus: 0 };
  if (!isFountOfKnowledgeAskMode(actor)) return { bonus: 0 };

  const apply = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.FountOfKnowledge.Prompt")}</p>`,
    defaultYes: false
  });
  if (!apply) return { bonus: 0 };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.FountOfKnowledge.Applied"));
  return { bonus: 1 };
}

// 무브 옆에 항상묻기/항상미적용 배지. 플레이어/마스터 누구나 클릭할 수
// 있다(협박/정밀 태그와 같은 이유 — 판정 직전 확인 다이얼로그 자체가 이미
// 서사적 판단을 대신해준다).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findFountOfKnowledgeMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-fount-of-knowledge-badge").remove();

  const askMode = isFountOfKnowledgeAskMode(actor);
  const $badge = $(
    `<a class="tag dwauto-fount-of-knowledge-badge${askMode ? " dwauto-fount-of-knowledge-on" : ""}" title="${game.i18n.localize("DWAUTO.FountOfKnowledge.ToggleTitle")}">${game.i18n.localize(askMode ? "DWAUTO.FountOfKnowledge.AskOn" : "DWAUTO.FountOfKnowledge.AskOff")}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setFountOfKnowledgeAskMode(actor, !askMode);
  });
}

export function registerFountOfKnowledgeAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
