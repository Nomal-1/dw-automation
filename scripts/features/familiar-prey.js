import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveCardInfo } from "../lib/move-card.js";

// 레인저 무브 익숙한 사냥감(Familiar Prey) 원문: "괴물에 대해 지식
// 더듬기(Spout Lore)를 할 때, INT 대신 WIS로 판정할 수 있다." "괴물에
// 대한 것인지"는 매번 서사적 판단이 필요해서 협박/정밀 태그와 같은
// 방식으로 판정 직전마다 물어본다. 사냥의 지식(Hunter's Prey, 익숙한
// 사냥감의 6레벨 상위 무브라 무브 업그레이드 자동화가 하위 무브를 지운다)은
// 추가로 "12+면 그 대상에 대해 GM에게 질문 하나를 더 물어볼 수 있다"는
// 효과가 있어, 판정 결과가 나온 뒤 안내만 남긴다(질문 자체는 자유
// 서술이라 자동화 대상이 아니다) — 이번에 정말 WIS로 굴렸는지까지는 알
// 수 없어서(질문에 아니오라고 답했을 수도 있으므로) 12+ 자체를 근거로
// 안내하는 근사치로 처리한다(논리적/매우 논리적과 같은 방식).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_FAMILIAR_PREY_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findHuntersPreyMove(actor) {
  const names = splitCommaList(SETTINGS.HUNTERS_PREY_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

// 사냥의 지식이 익숙한 사냥감을 대체하므로(둘 다 갖고 있는 경우는 없음),
// 둘 중 실제로 갖고 있는 쪽을 찾는다.
function findFamiliarPreyMove(actor) {
  const names = splitCommaList(SETTINGS.FAMILIAR_PREY_MOVE_NAMES);
  const move = actor.items.find((i) => i.type === "move" && names.includes(i.name));
  return move ?? findHuntersPreyMove(actor);
}

function matchesSpoutLore(title) {
  return splitCommaList(SETTINGS.SPOUT_LORE_MOVE_NAMES).includes(title);
}

// lib/roll-wrapper.js가 협박/정밀/논리적과 같은 자리에서 호출한다.
export async function promptFamiliarPreyPreRoll(item) {
  if (!isEnabled()) return { statOverride: null };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { statOverride: null };
  if (!matchesSpoutLore(item.name)) return { statOverride: null };

  const moveItem = findFamiliarPreyMove(actor);
  if (!moveItem) return { statOverride: null };

  const apply = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.FamiliarPrey.Prompt")}</p>`,
    defaultYes: false
  });
  if (!apply) return { statOverride: null };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.FamiliarPrey.Applied"));
  return { statOverride: "WIS" };
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, isExtreme } = info;
    if (actor.type !== "character") return;
    if (!isExtreme) return;
    if (!matchesSpoutLore(title)) return;

    const huntersPreyMove = findHuntersPreyMove(actor);
    if (!huntersPreyMove) return;

    announceInfo(actor, game.i18n.localize("DWAUTO.FamiliarPrey.HuntersPreyBonus"));
  } catch (err) {
    console.error(`${MODULE_ID} | familiar-prey: onCreateChatMessage failed`, err);
  }
}

export function registerFamiliarPreyAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
