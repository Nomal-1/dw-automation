import { MODULE_ID, SETTINGS } from "../constants.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { announceActionApplied } from "../lib/announce.js";
import { getAnimalCompanionStats } from "./note-moves.js";

// 레인저 명령(Command) 원문: "동물 친구가 받은 훈련을 활용하고 있으면 —
// 같은 대상을 공격할 때 동물의 사나움을 피해에, 추적할 때 동물의 교활함을
// 판정에, 피해를 입을 때 동물의 장갑을 자신의 장갑에, 상황 파악/협상 시
// 동물의 교활함을 판정에 더한다." ("다른 PC가 방해할 때 동물의 본능이 그
// 판정에 더해진다"는 다른 캐릭터의 굴림에 개입해야 해서 자동화 대상에서
// 뺐다 — GM이 수동으로 처리한다.)
//
// "지금 동물 친구가 정말 협력하고 있는지"는 채팅 트리거로 자동 감지할 수
// 없어서(GM 요청), 캐릭터 시트에 수동 토글 배지를 하나 둔다 — 켜져 있는
// 동안만 아래 세 자동화(피해/판정/장갑)가 실제로 적용된다. 동물의 능력치
// 자체는 features/note-moves.js가 동반 동물(Animal Companion)의 "기본
// 능력치 선택" 답을 파싱해서 제공한다(getAnimalCompanionStats).
const COOPERATING_FLAG = "commandCooperating";

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_COMMAND_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isCooperating(actor) {
  return Boolean(actor.getFlag(MODULE_ID, COOPERATING_FLAG));
}

async function setCooperating(actor, value) {
  if (value) {
    await actor.setFlag(MODULE_ID, COOPERATING_FLAG, true);
  } else {
    await actor.unsetFlag(MODULE_ID, COOPERATING_FLAG);
  }
}

function findCommandMove(actor) {
  const names = splitCommaList(SETTINGS.COMMAND_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

// 토글이 켜져 있고, 명령을 실제로 갖고 있고, 동물의 능력치가 파싱되어
// 있을 때만 능력치 객체를 돌려준다. 이 함수를 호출하는 세 automation 지점
// (공격 데미지, 특정 굴림 rollMod, 장갑 재계산) 전부 이 조건을 공유한다.
function getActiveStats(actor) {
  if (!isEnabled()) return null;
  if (!isCooperating(actor)) return null;
  if (!findCommandMove(actor)) return null;
  return getAnimalCompanionStats(actor);
}

// features/attack-assistant.js가 데미지 굴림 공식에 이어붙인다(같은 대상을
// 공격 중일 때 사나움 추가). 보너스가 없으면 빈 문자열.
export function getCommandDamageBonus(actor) {
  const stats = getActiveStats(actor);
  if (!stats || !stats.ferocity) return "";

  const moveItem = findCommandMove(actor);
  announceActionApplied(
    actor,
    moveItem?.name ?? "Command",
    game.i18n.format("DWAUTO.Command.DamageBonusApplied", { amount: stats.ferocity })
  );
  return String(stats.ferocity);
}

// lib/roll-wrapper.js가 사냥과 추적/상황 파악/협상 굴림에 rollMod로 더한다.
// item은 지금 굴리는 무브 아이템(this) 그대로 받는다.
export function getCommandCunningBonus(item) {
  const actor = item.actor;
  if (!actor) return 0;

  const cunningMoveNames = splitCommaList(SETTINGS.COMMAND_CUNNING_MOVE_NAMES);
  if (!cunningMoveNames.includes(item.name)) return 0;

  const stats = getActiveStats(actor);
  if (!stats || !stats.cunning) return 0;

  const moveItem = findCommandMove(actor);
  announceActionApplied(
    actor,
    moveItem?.name ?? "Command",
    game.i18n.format("DWAUTO.Command.RollBonusApplied", { move: item.name, amount: stats.cunning })
  );
  return stats.cunning;
}

// features/armor-assistant.js의 장갑 재계산 기여 목록에 더한다.
export function getCommandArmorContribution(actor) {
  const stats = getActiveStats(actor);
  if (!stats || !stats.armor) return null;

  const moveItem = findCommandMove(actor);
  return { source: moveItem?.name ?? "Command", amount: stats.armor };
}

// 명령 무브 옆에 "협력 중"/"평소" 토글 배지를 붙인다. 클릭하면 상태가
// 뒤집힌다 — hold와 달리 GM 전용으로 제한하지 않는다(요청받지 않음).
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findCommandMove(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  if ($tags.find(".dwauto-command-badge").length) return;

  const active = isCooperating(actor);
  const $badge = $(
    `<a class="tag dwauto-command-badge${active ? " dwauto-command-on" : ""}" title="${game.i18n.localize("DWAUTO.Command.ToggleTitle")}">${game.i18n.localize(active ? "DWAUTO.Command.CooperatingOn" : "DWAUTO.Command.CooperatingOff")}</a>`
  );
  $tags.append($badge);

  $badge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setCooperating(actor, !active);
  });
}

export function registerCommandAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
