// 던전월드 시스템의 무브 굴림은 game.dungeonworld.ItemDw.prototype.roll()을
// 거쳐 DwRolls.rollMove()를 호출하는데, DwRolls 자체는 전역에 노출되어 있지
// 않지만 ItemDw는 game.dungeonworld.ItemDw로 노출되어 있어 libWrapper로
// 감쌀 수 있다. 이 모듈이 굴림 "전"에 개입해야 하는 두 가지 기능(지속 주문
// 시전 페널티 — spellcasting.js, Formcrafter 능력치 보정 — druid.js)이 전에는
// 각자 스스로 libWrapper.register(MODULE_ID, "...ItemDw.prototype.roll", ...)를
// 따로 호출했는데, libWrapper는 같은 모듈이 같은 대상을 두 번 wrap하는 걸
// 프로그래밍 실수로 보고 에러를 던진다("Error detected in module" 배너의
// 정체 — v0.29.1까지 원인 불명이던 버그). 그래서 두 번째로 등록되는 쪽
// (Formcrafter)이 항상 등록에 실패했고, 그 결과 Formcrafter의 능력치 보정도
// 실제로는 한 번도 적용된 적이 없었다. 이제 두 기능을 하나의 wrapper
// 함수로 합쳐서 등록을 딱 한 번만 한다.
import { MODULE_ID, SETTINGS } from "../constants.js";
import { computeCastPenalty } from "./ongoing-spells-state.js";
import { getFormcrafterRollModifier, shouldInterceptAskRoll, promptAskRollAbility } from "../features/druid.js";
import { getCommandCunningBonus } from "../features/command.js";
import { getGoodDayToDieBonus } from "../features/barbarian.js";
import { getOngoingPenaltyMalus } from "../features/hit-trigger.js";
import { getPendingRollBonus, clearPendingRollBonus, rollBonusAppliesTo } from "./roll-bonus-state.js";
import { announceActionApplied } from "./announce.js";
import { promptAidOrInterferePreRoll } from "../features/aid-or-interfere.js";
import { promptIAmTheLawPreRoll } from "../features/i-am-the-law.js";
import { promptKnowItAllPreRoll } from "../features/know-it-all.js";
import { getEncumbranceMalus, promptEncumbrancePreRoll } from "../features/encumbrance.js";
import { promptRecruitPreRoll } from "../features/recruit.js";
import { promptBolsterPreRoll } from "../features/bolster.js";
import { promptHeistPreRoll } from "../features/heist.js";
import { promptDefendVengeancePreRoll } from "../features/defend.js";
import { promptBurningBridgesPreRoll } from "../features/burning-bridges.js";
import { promptUpperHandPreRoll } from "../features/upper-hand.js";
import { promptInterrogatorPreRoll } from "../features/interrogator.js";
import { promptPrecisePreRoll } from "../features/precise-weapon.js";
import { getSeeingRedBonus } from "../features/seeing-red.js";
import { getThroughDeathsEyesMalus } from "../features/through-deaths-eyes.js";
import { maybeRollHerculeanAppetites } from "../features/herculean-appetites.js";
import { promptOnTheMovePreRoll } from "../features/on-the-move.js";
import { getLoveTruckBonus } from "../features/love-truck.js";
import { promptBamboozlePreRoll } from "../features/bamboozle.js";
import { promptFountOfKnowledgePreRoll } from "../features/fount-of-knowledge.js";
import { promptLogicalPreRoll } from "../features/logical.js";

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isCastSpellMove(item) {
  if (item.type !== "move") return false;
  return splitCommaList(SETTINGS.CAST_SPELL_MOVE_NAMES).includes(item.name);
}

// Formcrafter: "무엇으로 판정할지 그 자리에서 고르는"(ask, 예: 위험 돌파) 무브는
// 시스템이 자기 대화상자를 띄우기 *전에* rollMod를 이미 고정해버려서, 능력치
// 버튼을 누른 뒤에 rollMod를 조정해봐야 이미 늦다. 그래서 시스템 대화상자가
// 뜨기 전에 우리가 먼저 능력치를 확정해서 물어보고(features/druid.js의
// promptAskRollAbility), rollType 자체를 그 능력치로 바꿔치기한 채로 원본
// 굴림을 호출한다 — 시스템은 rollType이 "ask"가 아니면 자기 대화상자를 아예
// 띄우지 않으므로 두 번 묻는 일도 없다.
async function handleAskRoll(item, wrapped, args, extraBonus = 0) {
  const chosenStat = await promptAskRollAbility(item.name);
  if (!chosenStat) return wrapped(...args);

  const mod = getFormcrafterRollModifier(item.actor, chosenStat);
  const goodDayToDieMod = getGoodDayToDieBonus(item.actor);
  const ongoingPenaltyMod = getOngoingPenaltyMalus(item.actor);
  const pendingBonus = getPendingRollBonus(item.actor);
  const pendingBonusApplies = rollBonusAppliesTo(pendingBonus, item.name);
  const originalType = item.system.rollType;
  const originalMod = item.system.rollMod;
  item.system.rollType = chosenStat;
  item.system.rollMod =
    (Number(originalMod) || 0) +
    mod +
    goodDayToDieMod +
    ongoingPenaltyMod +
    (pendingBonusApplies ? pendingBonus.amount : 0) +
    extraBonus;
  try {
    return await wrapped(...args);
  } finally {
    item.system.rollType = originalType;
    item.system.rollMod = originalMod;
    if (pendingBonusApplies) await consumePendingRollBonus(item, pendingBonus);
  }
}

// 원조/방해(Aid or Interfere)의 +1/-2처럼 "다음 판정 한 번" 보정치를 실제로
// 굴린 뒤 지운다. 소모 시점에 채팅으로도 남겨서(누가 어떤 보정을 왜 받았는지)
// 그 판정 결과 카드만 보고는 왜 수치가 다른지 헷갈리지 않게 한다.
async function consumePendingRollBonus(item, pendingBonus) {
  await clearPendingRollBonus(item.actor);
  const signed = pendingBonus.amount >= 0 ? `+${pendingBonus.amount}` : `${pendingBonus.amount}`;
  announceActionApplied(
    item.actor,
    item.name,
    game.i18n.format("DWAUTO.RollBonus.Consumed", { amount: signed, source: pendingBonus.source })
  );
}

async function wrappedRoll(wrapped, ...args) {
  if (!this.actor || this.type !== "move") return wrapped(...args);

  // 사그라지는 인연(황천길 대체)은 유대(BOND) 판정이라 rollMod로 개입할 수
  // 없다 — 판정 자체가 열리기 전에 가장 먼저 물어봐야 한다(그래야 죽어가는
  // 캐릭터에게 짐/수련 같은 다른 사전 확인 팝업이 먼저 뜨는 혼란도 없다).
  const burningBridges = await promptBurningBridgesPreRoll(this);
  if (burningBridges.cancel) return undefined;

  // 야만전사 주도권(The Upper Hand)의 "황천길 +1 상시"도 사그라지는 인연과
  // 같은 황천길(BOND) 판정이라 여기서 먼저 처리한다(features/upper-hand.js
  // 참고) — 사그라지는 인연으로 판정 자체가 취소됐다면 이미 위에서 빠져나갔다.
  await promptUpperHandPreRoll(this);

  // 하중 초과(+3 이상)로 짐을 버리지 않으면(bonus로 거대한 음수를 돌려줘)
  // 판정 자체는 취소하지 않고 그대로 진행시킨다 — 그래야 시스템 자신의
  // 성공/부분성공/실패 카드(경험치 획득 버튼 포함)가 그대로 뜬다.
  const encumbrance = await promptEncumbrancePreRoll(this);

  // I Am The Law/Know-It-All이 대기 중이면 이 액터가 어떤 판정을 하든(ask
  // 타입 포함) 먼저 확인을 받아야 하므로, 다른 분기보다 먼저 처리한다.
  // cancel이면 이 판정 자체가 열리지 않는다(대기 중에 I Am The Law를 또
  // 굴리려는 경우 — Know-It-All은 대상 쪽에 걸리는 보정치라 재굴림을 막을
  // 이유가 없어 항상 cancel이 없다).
  const iAmTheLaw = await promptIAmTheLawPreRoll(this);
  if (iAmTheLaw.cancel) return undefined;
  const knowItAll = await promptKnowItAllPreRoll(this);

  // 방어(Defend)의 "공격자에게 빈틈을 만들어 아군에게 +1" 대기도 만물박사와
  // 같은 이유로 매 판정마다 확인이 필요하다(features/defend.js 참고).
  const defendVengeance = await promptDefendVengeancePreRoll(this);

  // 수련(Bolster) 예비도 "이 판정에 쓸지" 매번 물어봐야 하는 사전 확인이라
  // 같은 자리에서 처리한다(features/bolster.js 참고).
  const bolster = await promptBolsterPreRoll(this);

  // 대도적(Heist) 대기 중인 +1 기회도 "그 대답에 의거한 것인가요?"를 매번
  // 물어봐야 하는 사전 확인이다(features/heist.js 참고). 예/아니오 관계없이
  // 기회 자체는 이 시점에 소모된다.
  const heist = await promptHeistPreRoll(this);

  // 야만전사 재빠른 몸놀림(On The Move)의 "이동으로 인한 위험돌파 +1"도
  // 협박/정밀처럼 판정 직전 매번 확인이 필요한 사전 보정치라 같은 자리에서
  // 처리한다(features/on-the-move.js 참고).
  const onTheMove = await promptOnTheMovePreRoll(this);

  // 바드 현란한 말솜씨(Bamboozle)의 "적용중이면 판정마다 대상인지 묻기"도
  // 같은 자리에서 처리한다(features/bamboozle.js 참고) — 특정 무브로
  // 제한되지 않고 이 액터의 모든 판정 앞에서 물어본다.
  const bamboozle = await promptBamboozlePreRoll(this);

  // 전사의 눈(Seeing Red)/너에 대한 내 사랑은 트럭 같아(Love Truck)의
  // "적용중" 지속 +1은 다이얼로그 없이 조용히 붙는다(features/seeing-red.js,
  // features/love-truck.js 참고) — 물어보는 건 판정이 끝난 뒤(또는 발동
  // 시점)의 몫이다.
  // 위저드 지식의 샘(Fount of Knowledge)의 "지식 더듬기 전용 +1"도 판정마다
  // 확인이 필요한 사전 보정치라 같은 자리에서 처리한다(features/
  // fount-of-knowledge.js 참고).
  const fountOfKnowledge = await promptFountOfKnowledgePreRoll(this);

  const preRollBonus =
    iAmTheLaw.bonus +
    knowItAll.bonus +
    defendVengeance.bonus +
    getEncumbranceMalus(this.actor) +
    encumbrance.bonus +
    bolster.bonus +
    heist.bonus +
    onTheMove.bonus +
    bamboozle.bonus +
    fountOfKnowledge.bonus +
    getSeeingRedBonus(this) +
    getLoveTruckBonus(this);

  const rollType = (this.system.rollType || "").toLowerCase();

  if (rollType === "ask" && shouldInterceptAskRoll(this.actor)) {
    return handleAskRoll(this, wrapped, args, preRollBonus);
  }

  // 협박(Interrogator)/정밀(Precise) 태그처럼 "이번 판정에 한해 판정
  // 능력치 자체를 바꿔치기하는" 자동화들. 서로 다른 무브(협상 vs 접근전)를
  // 대상으로 하므로 같은 판정에서 동시에 걸릴 일은 없다.
  const interrogator = await promptInterrogatorPreRoll(this);
  const precise = await promptPrecisePreRoll(this);
  const logical = await promptLogicalPreRoll(this);
  const statOverride = interrogator.statOverride ?? precise.statOverride ?? logical.statOverride;

  let spellPenalty = 0;
  if (game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELLCASTING_ASSISTANT) && isCastSpellMove(this)) {
    const { blocked, amount } = computeCastPenalty(this.actor);
    if (blocked) {
      ui.notifications.warn(game.i18n.format("DWAUTO.Spell.CastBlocked", { name: this.actor.name }));
      return undefined;
    }
    spellPenalty = amount;
  }

  // 원조/방해(Aid or Interfere)는 대상/원조·방해 여부를 굴리기 "전"에
  // 확정해야(레인저 Command의 본능 보너스를 GM이 미리 안내할 수 있어야
  // 하므로) 다른 보정치들과 나란히 여기서 미리 처리한다 — 이 무브가
  // 아니거나 자동화가 꺼져있으면 즉시 반환하므로 다른 판정에는 영향이
  // 없다. 본능 보너스 자체는 rollMod로 반영되지 않는다(features/
  // aid-or-interfere.js 상단 주석 — 던전월드 시스템이 유대 판정에는
  // rollMod를 읽지 않는 결함이 있다). GM 안내가 끝날 때까지 이 굴림 자체가
  // 대기한다.
  await promptAidOrInterferePreRoll(this);

  // 구인(Recruit)도 원조/방해와 같은 유대(Bond) rollType이라 rollMod로
  // -1을 반영할 수 없다 — 대기 중인 페널티가 있으면 유대 입력창이 뜨기
  // 전에 "직접 -1을 입력하라"는 안내를 먼저 띄우고 확인을 받는다
  // (features/recruit.js 참고).
  await promptRecruitPreRoll(this);

  const formcrafterMod = getFormcrafterRollModifier(this.actor, rollType);
  const commandMod = getCommandCunningBonus(this);
  const goodDayToDieMod = getGoodDayToDieBonus(this.actor);
  const ongoingPenaltyMod = getOngoingPenaltyMalus(this.actor);
  const throughDeathsEyesMod = getThroughDeathsEyesMalus(this.actor);
  const pendingBonus = getPendingRollBonus(this.actor);
  const pendingBonusApplies = rollBonusAppliesTo(pendingBonus, this.name);
  const totalMod =
    formcrafterMod -
    spellPenalty +
    commandMod +
    goodDayToDieMod +
    ongoingPenaltyMod +
    throughDeathsEyesMod +
    (pendingBonusApplies ? pendingBonus.amount : 0) +
    preRollBonus;

  // 야만전사 헤라클레스의 욕망(Herculean Appetites): 2d6 대신 1d6+1d8을
  // 굴려야 해서 시스템의 원래 굴림 경로 자체를 못 탄다(features/
  // herculean-appetites.js 참고) — 다른 보정치를 전부 반영한 뒤, 여기서
  // 적용 여부를 최종 결정하고 적용되면 이 모듈이 직접 굴려서 끝낸다.
  const heracles = await maybeRollHerculeanAppetites(this, {
    effectiveAbility: (statOverride || rollType || "").toLowerCase(),
    totalMod,
    pendingBonus,
    pendingBonusApplies
  });
  if (heracles.handled) return undefined;

  if (!totalMod && !pendingBonusApplies && !statOverride) return wrapped(...args);

  const original = this.system.rollMod;
  const originalRollType = this.system.rollType;
  this.system.rollMod = (Number(original) || 0) + totalMod;
  if (statOverride) this.system.rollType = statOverride;
  try {
    return await wrapped(...args);
  } finally {
    this.system.rollMod = original;
    this.system.rollType = originalRollType;
    if (pendingBonusApplies) await consumePendingRollBonus(this, pendingBonus);
  }
}

export function registerRollWrapper() {
  libWrapper.register(MODULE_ID, "game.dungeonworld.ItemDw.prototype.roll", wrappedRoll, "MIXED");
}
