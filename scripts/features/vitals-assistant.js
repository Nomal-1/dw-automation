import { MODULE_ID, SETTINGS } from "../constants.js";
import { CLASS_BASE_STATS } from "../data/class-base-stats.js";
import { getClassNameMap } from "../lib/translation-import.js";

// 장갑(armor-assistant.js) 재계산 버튼과 완전히 같은 패턴으로, 캐릭터 시트의
// '체력'/'무게' 라벨을 클릭 가능한 버튼으로 바꿔서 최대 체력/기본 하중을
// 자동으로 계산해준다.
//
// 던전월드 시스템 자체(actor-sheet.js의 레벨업/직업 선택 처리)가 이미 이
// 계산을 하고 있어서, 그 로직을 그대로 따른다 — 확인해보니 체력과 하중이
// 서로 다른 공식을 쓰는 게 시스템/룰북의 의도된 비대칭 규칙이다:
//   - 최대 체력 = 직업 기본값 + 체력(CON) "원점수"(system.abilities.con.value)
//   - 기본 하중 = 직업 기본값 + 근력(STR) "수정치"(system.abilities.str.mod,
//     시스템의 DwUtility.getAbilityMod와 동일한 값)
// 던전월드 시스템 자체 설정(월드 설정, 이 모듈 설정이 아님)인
// "noConstitutionToHP"/"noSTRToMaxLoad"가 켜져 있으면 그 능력치 기여분을
// 아예 0으로 두는 것까지 시스템과 동일하게 반영한다. 직업별 기본값은
// data/class-base-stats.js 참고.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_VITALS_ASSISTANT);
}

// system.details.class는 캐릭터 시트 헤더의 자유 입력 텍스트 필드라("Fighter"/
// "The Fighter"/번역명 등 무엇이 들어있을지 모른다) 먼저 영문 직업 키로
// 바로 맞춰보고(대소문자·"The " 접두어 무시), 안 맞으면 번역 데이터로 한 번
// 더 확인한다(다른 기능들의 matchesConfiguredName과 같은 방식).
async function resolveClassKey(actor) {
  const raw = (actor.system.details?.class ?? "").trim();
  if (!raw) return null;

  const stripped = raw.replace(/^the\s+/i, "").trim();
  const directKey = Object.keys(CLASS_BASE_STATS).find((key) => key.toLowerCase() === stripped.toLowerCase());
  if (directKey) return directKey;

  try {
    const classMap = await getClassNameMap();
    for (const key of Object.keys(CLASS_BASE_STATS)) {
      if (classMap.get(`The ${key}`) === raw) return key;
    }
  } catch (err) {
    // 번역 데이터를 못 읽으면 영문 이름 매칭 결과만으로 판단한다.
  }
  return null;
}

function formatSigned(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function buildTooltip(classKey, base, formulaKey) {
  if (!classKey) return game.i18n.localize("DWAUTO.Vitals.NoClassTooltip");
  return `${game.i18n.format(formulaKey, { base })}\n${game.i18n.localize("DWAUTO.Vitals.ClickHint")}`;
}

// 재계산은 던전월드 공식 무브가 아니라 이 모듈이 제공하는 도구라서,
// armor-assistant.js의 recalcArmor와 같은 방식으로 "{move} 액션 적용!" 문구
// 없이 그 자체로 완결된 문장 하나만 채팅에 남긴다.
async function recalcHp(actor) {
  const classKey = await resolveClassKey(actor);
  if (!classKey) {
    ui.notifications.warn(game.i18n.format("DWAUTO.Vitals.NoClassWarning", { name: actor.name }));
    return;
  }

  const { hp: base } = CLASS_BASE_STATS[classKey];
  const noConstitutionToHp = game.settings.get("dungeonworld", "noConstitutionToHP");
  const con = noConstitutionToHp ? 0 : Number(actor.system.abilities?.con?.value) || 0;
  const total = base + con;
  await actor.update({ "system.attributes.hp.max": total });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p class="dwauto-action-applied"><i class="fas fa-check-circle"></i> ${game.i18n.format("DWAUTO.Vitals.HpApplied", { base, con, total })}</p>`
  });
}

async function recalcLoad(actor) {
  const classKey = await resolveClassKey(actor);
  if (!classKey) {
    ui.notifications.warn(game.i18n.format("DWAUTO.Vitals.NoClassWarning", { name: actor.name }));
    return;
  }

  const { load: base } = CLASS_BASE_STATS[classKey];
  const noStrToMaxLoad = game.settings.get("dungeonworld", "noSTRToMaxLoad");
  const strMod = noStrToMaxLoad ? 0 : Number(actor.system.abilities?.str?.mod) || 0;
  const total = base + strMod;
  await actor.update({ "system.attributes.weight.max": total });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p class="dwauto-action-applied"><i class="fas fa-check-circle"></i> ${game.i18n.format("DWAUTO.Vitals.LoadApplied", { base, str: formatSigned(strMod), total })}</p>`
  });
}

async function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const classKey = await resolveClassKey(actor);
  const base = classKey ? CLASS_BASE_STATS[classKey] : null;

  const $hpLabel = html.find(".cell--hp .cell__title");
  if ($hpLabel.length) {
    $hpLabel.addClass("rollable dwauto-vitals-recalc");
    $hpLabel.attr("title", buildTooltip(classKey, base?.hp, "DWAUTO.Vitals.HpFormula"));
    $hpLabel.off("click.dwautoVitalsHp").on("click.dwautoVitalsHp", async (event) => {
      event.preventDefault();
      await recalcHp(actor);
    });
  }

  const $loadLabel = html.find(".cell--weight .cell__title");
  if ($loadLabel.length) {
    $loadLabel.addClass("rollable dwauto-vitals-recalc");
    $loadLabel.attr("title", buildTooltip(classKey, base?.load, "DWAUTO.Vitals.LoadFormula"));
    $loadLabel.off("click.dwautoVitalsLoad").on("click.dwautoVitalsLoad", async (event) => {
      event.preventDefault();
      await recalcLoad(actor);
    });
  }
}

export function registerVitalsAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
