import { MODULE_ID, SETTINGS } from "../constants.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { announceActionApplied } from "../lib/announce.js";
import { getEffectiveAnimalCompanionStats } from "./note-moves.js";

// 레인저 명령(Command) 원문: "동물 친구가 받은 훈련을 활용하고 있으면 —
// 같은 대상을 공격할 때 동물의 사나움을 피해에, 추적할 때 동물의 교활함을
// 판정에, 피해를 입을 때 동물의 장갑을 자신의 장갑에, 상황 파악/협상 시
// 동물의 교활함을 판정에 더한다. 다른 PC가 방해할 때는 동물의 본능이 그
// 판정에 더해진다." 마지막 항목(다른 캐릭터의 굴림에 개입)은 처음엔 자동화
// 대상에서 뺐었지만, features/aid-or-interfere.js가 원조/방해를 굴리기
// 전에 대상을 먼저 확정하는 구조로 바뀌면서 getCommandInstinctAmount로
// 함께 연결했다(아래 참고 — 다만 던전월드 시스템 자체의 결함으로 자동
// 적용은 안 되고 GM 안내 팝업으로 대체한다).
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
  return getEffectiveAnimalCompanionStats(actor);
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

// Command 원문의 마지막 항목: "다른 PC가 자신을 방해하려 들 때, 동물의
// 본능이 그 판정에 더해진다." — 방해"당하는" 쪽(target)의 조건(Command +
// 협력 중 + 본능 수치)으로 조회하되, 실제 보너스는 방해"하는" 쪽의 판정에
// 붙는다는 점이 다른 세 보너스(자기 자신 기준)와 다르다.
//
// 던전월드 시스템 자체의 결함(v1.8.2 src/module/rolls.js의 rollMoveExecute)
// 때문에 "유대(Bond)" 판정—원조/방해가 유일하게 이 rollType을 쓴다—은
// 우리가 item.system.rollMod에 얼마를 넣어도 반영되지 않는다: 일반 능력치
// 판정은 dataset.mod(=rollMod)를 formula에 더하는데, 유대 판정만은
// dataset.value라는, 무브에 대해 어디서도 채워지지 않는 필드를 확인한다.
// 그래서 이 함수는 값을 rollMod에 자동으로 얹는 대신 순수하게 숫자만
// 돌려주고(부수효과 없음), features/aid-or-interfere.js가 이 값을 GM에게
// "플레이어의 유대 입력창에 직접 더해서 입력하도록 공지해달라"는 팝업으로
// 보여주는 데 쓴다.
export function getCommandInstinctAmount(target) {
  const stats = getActiveStats(target);
  return stats?.instinct ?? 0;
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
