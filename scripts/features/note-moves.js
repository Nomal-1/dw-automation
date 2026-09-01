import { MODULE_ID, SETTINGS } from "../constants.js";
import { injectActorTab } from "../lib/actor-tabs.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { DEFAULT_NOTE_MOVE_NAMES } from "../data/note-moves.js";
import { parseAnimalCompanionStats, parseAnimalCompanionChoiceLists } from "../lib/animal-companion-stats.js";
import { isFerocitySpent } from "../lib/animal-companion-state.js";

// Cleric Deity/Apotheosis, Ranger Animal Companion/God Amidst The Wastes,
// Paladin Quest/Divine Favor, Druid Born of the Soil처럼 "이름/영역/사명/
// 동반자 같은 것을 자유롭게 정해서 기록해두는" 무브들. 주사위나 선택지를
// 자동화하는 대신, 실제로 그 무브를 발동(채팅 카드로 클릭)했을 때만 그 무브
// 이름을 딴 탭을 만들어 자유 메모란을 붙여준다 — 소유만으로 탭이 뜨던
// v0.23.x까지의 방식과 달리, "발동해야 탭이 생긴다"는 대지의 아들/딸의
// 방식을 모든 메모형 무브에 동일하게 적용한다(더 이상 이 둘을 구분하지
// 않는다). 무브 설명 안에 <ul>/<ol> 목록이 있으면(대지의 아들/딸의 "결연된
// 땅" 11개, 신(Deity)의 "영역"과 "교리"처럼) 목록마다 각각 별도의 드롭다운
// 선택으로 보여준다(+ 직접입력) — 한 무브에 서로 다른 목록이 여러 개
// 있어도(신은 영역/교리 2개) 절대 하나로 뭉쳐 보여주지 않는다. 목록이 아예
// 없는 무브(사명 등 순수 자유 서술형)는 그런 선택 단계 없이 발동 즉시
// 탭이 생긴다.
const ACTIVATED_FLAG = "noteMoveActivated"; // { [moveId]: true }
const ANSWER_FLAG = "noteMoveAnswer"; // { [moveId]: string[] } — 무브 설명 안의 독립된 목록마다 하나씩
const GM_CHOICE_FLAG = "noteMoveGmChoice"; // { [moveId]: string[] } — "GM이 나중에 정해준다"고 적힌 목록의 GM 선택
const NOTES_FLAG = "noteMoves"; // { [moveId]: string } — v0.16 이전부터 쓰던 이름 그대로 유지(기존 메모 보존)
const CUSTOM_VALUE = "__dwauto_custom__";
// 레인저 동반 동물(Animal Companion)의 "기본 능력치 선택" 답이 파싱되면
// { ferocity, cunning, instinct, armor } 형태로 여기 저장된다. 무브별이
// 아니라 액터 하나당 값 하나다(동반 동물은 보통 하나뿐이라고 가정). features/
// command.js(레인저 명령/Command 자동화)가 이 값을 읽어서 쓴다.
const ANIMAL_STATS_FLAG = "animalCompanionStats";
// 강점/훈련 특성/약점 각각 문자열 배열. 액터당 하나(동반 동물은 보통 하나뿐이라고
// 가정 — ANIMAL_STATS_FLAG와 동일한 전제). features/well-trained.js(재주꾼)가
// ANIMAL_TRAININGS_FLAG를 읽고 추가로 하나를 append한다.
const ANIMAL_STRENGTHS_FLAG = "animalCompanionStrengths";
const ANIMAL_TRAININGS_FLAG = "animalCompanionTrainings";
const ANIMAL_WEAKNESSES_FLAG = "animalCompanionWeaknesses";

// 팔라딘 신의 은혜(Divine Favor) 원문: "이 무브를 고르면 주문 시전 목적으로
// 자신을 1레벨 클레릭처럼 취급한다. 그 뒤로 레벨이 오를 때마다 이 클레릭
// 레벨도 1씩 오른다." 발동 시 1로 시작하고, 이후 실제 캐릭터 레벨이
// 바뀔 때마다(preUpdateActor에서 옛 레벨을 잠깐 기억해뒀다가 updateActor에서
// 그 차이만큼) 같이 조정한다. GM은 탭에서 숫자를 직접 고쳐도 된다 — 그
// 뒤로도 레벨이 오르면 그 고친 값 기준으로 계속 +1씩 된다. features/
// spell-preparation.js의 getActorLevel이 이 값을 실제 캐릭터 레벨 대신
// 읽어서, 예배(Commune)의 주문 준비 한도가 이 클레릭 레벨 기준으로 계산되게
// 한다.
const CLERIC_LEVEL_FLAG = "paladinClericLevel";
// 레인저 황무지의 신(God Amidst The Wastes) 원문이 팔라딘 신의 은혜와
// 완전히 같은 문구("예배와 주문 시전을 얻고, 자신을 1레벨 클레릭처럼
// 취급하며 레벨이 오를 때마다 클레릭 레벨도 오른다")라 같은 클레릭 레벨
// 추적 로직을 그대로 공유한다.
const DIVINE_FAVOR_NAMES = ["Divine Favor", "신의 은혜", "God Amidst The Wastes", "황무지의 신"];
const lastKnownActorLevel = new Map(); // actor.id -> preUpdateActor에서 기억해둔 옛 레벨

function isDivineFavorMove(moveItem) {
  return DIVINE_FAVOR_NAMES.includes(moveItem.name);
}

function getClericLevel(actor) {
  return actor.getFlag(MODULE_ID, CLERIC_LEVEL_FLAG) ?? null;
}

async function setClericLevel(actor, value) {
  const clamped = Math.max(1, Math.floor(Number(value)) || 1);
  await actor.setFlag(MODULE_ID, CLERIC_LEVEL_FLAG, clamped);
}

// features/spell-preparation.js가 예배(Commune)의 주문 준비 한도를,
// features/cleric-spell-grant.js가 "레벨별 사제 주문 모두 얻기" 버튼의
// 기준 레벨을 계산할 때 재사용한다. 신의 은혜/황무지의 신을 발동한 적이
// 없으면(실제 클레릭이거나 아직 안 골랐으면) null — 호출부가 실제 캐릭터
// 레벨을 그대로 쓰면 된다.
export function getClericLevelOverride(actor) {
  return getClericLevel(actor);
}

// features/well-trained.js(재주꾼)·features/unnatural-ally.js처럼 동물 친구
// 상태에 얹혀사는 "무브당 한 번만 적용" 플래그를 가진 기능이 등록해두면,
// 동물 친구 탭이 초기화될 때마다(resetNoteMove) 같이 호출해준다. 이게 없으면
// 그 기능들의 "이미 적용됨" 플래그가 사라진 옛 동물 친구를 계속 가리킨 채로
// 남아서, 새 동물 친구를 만들어도 다시 적용이 안 되고 "이미 적용됨" 메시지만
// 뜨는 문제가 생긴다(실제로 Unnatural Ally에서 발견됨).
const animalCompanionResetListeners = [];

export function registerAnimalCompanionResetListener(fn) {
  animalCompanionResetListeners.push(fn);
}

// features/command.js가 재사용한다. 아직 파싱된 값이 없으면 null.
export function getAnimalCompanionStats(actor) {
  return actor.getFlag(MODULE_ID, ANIMAL_STATS_FLAG) ?? null;
}

// 레인저 헌신적인 친구(Man's Best Friend)로 사나움을 다 써버린 동안은
// (features/hit-trigger.js가 관리하는 isFerocitySpent) 다른 자동화(예:
// features/command.js의 명령 피해 보너스)도 동물의 사나움을 실제로 0으로
// 봐야 한다 — 원문 "사나움이 이미 0이면 이 능력을 못 쓴다"가 성립하려면
// 다른 계산에서도 0으로 취급돼야 하기 때문이다. 몇 시간 휴식하면(배지를
// 다시 눌러 되돌리면) 원래 값으로 돌아온다.
export function getEffectiveAnimalCompanionStats(actor) {
  const stats = getAnimalCompanionStats(actor);
  if (!stats) return stats;
  if (!isFerocitySpent(actor)) return stats;
  return { ...stats, ferocity: 0 };
}

// features/well-trained.js가 재사용한다. 아직 고른 적 없으면 빈 배열.
export function getAnimalCompanionTrainings(actor) {
  return actor.getFlag(MODULE_ID, ANIMAL_TRAININGS_FLAG) ?? [];
}

export async function addAnimalCompanionTraining(actor, training) {
  const current = getAnimalCompanionTrainings(actor);
  if (current.includes(training)) return;
  await actor.setFlag(MODULE_ID, ANIMAL_TRAININGS_FLAG, [...current, training]);
}

// features/unnatural-ally.js가 재사용한다. 레인저 Unnatural Ally의 "사나움
// +2, 본능 +1"처럼 기본 능력치에 고정 보너스를 더한다. 아직 기본 능력치가
// 파싱되어 있지 않으면(동반 동물 능력치 선택을 아직 안 했으면) 아무것도
// 하지 않고 false를 돌려준다.
export async function addAnimalCompanionStatBonus(actor, bonus) {
  const current = getAnimalCompanionStats(actor);
  if (!current) return false;

  const next = { ...current };
  for (const [key, amount] of Object.entries(bonus)) {
    next[key] = (next[key] ?? 0) + amount;
  }
  await actor.setFlag(MODULE_ID, ANIMAL_STATS_FLAG, next);
  return true;
}

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_NOTE_MOVES);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isActivated(actor, moveId) {
  return Boolean(actor.getFlag(MODULE_ID, ACTIVATED_FLAG)?.[moveId]);
}

// 다른 기능(예: features/underdog.js의 퀘스트 연동 장갑 보너스 — 팔라딘
// Holy Protection은 "퀘스트 수행 중"일 때만 장갑을 준다)이 "이 메모형 무브가
// 지금 발동/활성 상태인가"를 조건으로 재사용할 수 있도록 공개한다. moveName은
// 지금 액터가 실제로 들고 있는 이름 그대로(번역됐다면 번역된 이름) 넘겨야
// 한다 — 초기화되면(탭이 사라지면) 다시 false가 된다.
export function isNoteMoveActive(actor, moveName) {
  const moveItem = actor.items.find((i) => i.type === "move" && i.name === moveName);
  if (!moveItem) return false;
  return isActivated(actor, moveItem.id);
}

async function setActivated(actor, moveId, value) {
  const current = actor.getFlag(MODULE_ID, ACTIVATED_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, ACTIVATED_FLAG, { ...current, [moveId]: value });
}

// 예전(v0.25.0 이전, 목록을 하나로 뭉뚱그려 프롬프트 하나만 띄우던 시절)
// 데이터는 문자열 하나였다. 그대로도 읽을 수 있게 배열로 감싸서 돌려준다.
function getAnswer(actor, moveId) {
  const value = actor.getFlag(MODULE_ID, ANSWER_FLAG)?.[moveId];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function setAnswer(actor, moveId, value) {
  const current = actor.getFlag(MODULE_ID, ANSWER_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, ANSWER_FLAG, { ...current, [moveId]: value });
}

function getGmChoice(actor, moveId) {
  return actor.getFlag(MODULE_ID, GM_CHOICE_FLAG)?.[moveId] ?? [];
}

async function setGmChoice(actor, moveId, values) {
  const current = actor.getFlag(MODULE_ID, GM_CHOICE_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, GM_CHOICE_FLAG, { ...current, [moveId]: values });
}

function getNoteText(actor, moveId) {
  return actor.getFlag(MODULE_ID, NOTES_FLAG)?.[moveId] ?? "";
}

async function setNoteText(actor, moveId, text) {
  const current = actor.getFlag(MODULE_ID, NOTES_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, NOTES_FLAG, { ...current, [moveId]: text });
}

// 서사적 빈칸(______, 밑줄 2개 이상)이 포함된 선택지인지 확인한다. "Slay
// ______, a great blight on the land." / "만인의 적 _________를 죽인다."처럼
// 옵션 문구 자체에 빈칸이 있는 경우, 그 문구를 그대로 답으로 쓰는 대신
// 빈칸에 채울 말만 따로 입력받아 문구에 끼워 넣는다.
const BLANK_PATTERN = /_{2,}/;

// 무브 설명 HTML 안의 독립된 <ul>/<ol> 목록들을 각각 따로 뽑아온다. 신(Deity)처럼
// 한 무브 설명에 서로 다른 두 선택("신의 영역을 고르시오" 목록 하나, "교리를
// 고르시오" 목록 하나)이 따로 들어있는 경우, 예전처럼 모든 <li>를 하나로
// 합치면 두 선택지가 뒤섞여버린다 — 목록(<ul>/<ol>) 단위로 끊어서 각각 별도
// 선택으로 다룬다. 대지의 아들/딸처럼 목록이 하나뿐인 무브는 그대로 선택
// 하나만 묻는다.
//
// 팔라딘 퀘스트의 "서약" 목록처럼 플레이어가 고르는 게 아니라 "GM이 나중에
// 정해준다"고 적힌 목록(바로 앞 문단에 "GM" 또는 "마스터"라는 단어가 있으면
// 판단 — 번역본은 영문 "GM" 대신 "마스터"라고 적는 경우가 많다)은 발동 시
// 프롬프트에는 넣지 않고 gmGroups로 따로 돌려준다 — 탭에 GM이 직접 체크할
// 수 있는 목록으로 보여준다(renderGmChoiceSection 참고).
const GM_MARKER_PATTERN = /\bGM\b|마스터/i;

// 팔라딘 신성한 임무(Quest)의 "그리고 다음 중에서 최대 두 가지 축복을
// 고릅니다"처럼, 목록 바로 앞 문단에 "몇 개까지 고를 수 있는지"가 적혀
// 있으면 그 숫자를 뽑아낸다(없으면 평소처럼 1개). "두 가지"/"세 가지"
// 같은 한글 숫자말과 "choose two"/"choose up to three" 같은 영문 표현을
// 모두 지원한다 — 다른 메모형 무브(신의 영역 등)의 평범한 "고르세요" 문구는
// 숫자가 없으니 그대로 1개로 남는다.
const KOREAN_COUNT_WORDS = { 하나: 1, 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5 };
const ENGLISH_COUNT_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };

function parseGroupMaxCount(precedingText) {
  if (!precedingText) return 1;

  const koMatch = precedingText.match(/(하나|한|두|세|네|다섯|\d+)\s*(?:가지|개)/);
  if (koMatch) {
    const raw = koMatch[1];
    return KOREAN_COUNT_WORDS[raw] ?? parseInt(raw, 10) ?? 1;
  }

  if (/choose|pick/i.test(precedingText)) {
    const enMatch = precedingText.match(/\b(one|two|three|four|five|\d+)\b/i);
    if (enMatch) {
      const raw = enMatch[1].toLowerCase();
      return ENGLISH_COUNT_WORDS[raw] ?? parseInt(raw, 10) ?? 1;
    }
  }

  return 1;
}

function classifyGroup(playerGroups, gmGroups, group, precedingText) {
  const withCount = { ...group, maxCount: parseGroupMaxCount(precedingText) };
  if (GM_MARKER_PATTERN.test(precedingText)) {
    gmGroups.push(withCount);
  } else {
    playerGroups.push(withCount);
  }
}

// 번역본 중에는 <ul>/<li>가 아니라 그냥 한 문단 안에 "•" 같은 불릿 문자로
// 목록을 적어둔 경우가 있다(실제로 확인된 사례: 팔라딘 퀘스트의 "서약" 목록).
// <ul>/<ol>로 못 찾은 문단들 중에서, 줄바꿈(<br>) 기준으로 나눴을 때 불릿
// 문자로 시작하는 줄이 연속되는 구간을 찾아 같은 방식으로 다룬다. 그 앞의
// (불릿으로 시작하지 않는) 줄을 이 목록의 label로 쓴다.
const BULLET_LINE_PATTERN = /^[•·∙‣▪●○◦*-]\s*/;

function extractBulletPseudoGroups(html, playerGroups, gmGroups) {
  let pendingLabel = null;
  let pendingOptions = [];

  const flush = () => {
    if (pendingOptions.length > 0) {
      classifyGroup(playerGroups, gmGroups, { label: pendingLabel, options: pendingOptions }, pendingLabel ?? "");
    }
    pendingOptions = [];
  };

  html.children("p").each((_, el) => {
    const rawHtml = $(el).html() ?? "";
    const lines = rawHtml
      .split(/<br\s*\/?>/i)
      .map((line) => $(`<div>${line}</div>`).text().trim())
      .filter(Boolean);

    for (const line of lines) {
      if (BULLET_LINE_PATTERN.test(line)) {
        pendingOptions.push(line.replace(BULLET_LINE_PATTERN, "").trim());
      } else {
        flush();
        pendingLabel = line;
      }
    }
  });
  flush();
}

// v0.29.0에서 콘솔 로그로 직접 확인한 사실: 팔라딘 Quest("신성한 임무")의
// 실제 description 필드 자체에 서약(맹세) 문단/목록이 통째로 빠져 있다 —
// dungeonworld-ko 번역 콘텐츠 자체의 누락이지 파싱 문제가 아니다(원문에는
// 분명히 있는 내용인데 번역 데이터에 옮겨지지 않았다). 설명에서 서약 목록을
// 못 찾았을 때, 이름이 알려진 이름과 일치하면 공식 룰북 원문 그대로의 서약
// 목록을 보충해서 GM이 그래도 체크할 수 있게 한다.
const KNOWN_MISSING_GM_GROUPS = [
  {
    matchNames: ["Quest", "신성한 임무"],
    label:
      "그러면 마스터가 다음 중에서 맹세를 하나 이상 고릅니다. 이 맹세를 지켜야 축복을 유지할 수 있습니다:",
    options: [
      "명예 (금지: 비겁한 전술이나 속임수)",
      "절제 (금지: 탐식이나 육체적 향락)",
      "경건 (필수: 하루하루의 종교적 의식)",
      "용맹 (금지: 악한 것을 살려두는 것)",
      "진실 (금지: 거짓말)",
      "친절 (필수: 어려움에 처한 사람들을 그게 누가 되었건 돌보는 것)"
    ]
  }
];

function applyKnownMissingGmGroups(moveItem, gmGroups) {
  if (gmGroups.length > 0) return;
  const entry = KNOWN_MISSING_GM_GROUPS.find((e) => e.matchNames.includes(moveItem.name));
  if (entry) gmGroups.push({ label: entry.label, options: entry.options, maxCount: 1 });
}

// 팔라딘 기사의 귀감(Perfect Knight) 원문: "신성한 임무를 발동하면 축복을
// 2개 대신 3개 고른다." 신성한 임무의 "축복" 목록만 최대 개수가 2로
// 파싱되므로(그 목록 앞 문단에 "최대 두 가지"라고 적혀 있어서), 그 목록만
// 정확히 골라 3으로 올린다 — 사명/서약 등 신성한 임무의 다른 목록(둘 다
// maxCount가 1이나 그 밖의 값)은 건드리지 않는다.
const QUEST_NAMES = ["Quest", "신성한 임무"];
const PERFECT_KNIGHT_NAMES = ["Perfect Knight", "기사의 귀감"];

function applyPerfectKnightBoonBoost(actor, moveItem, playerGroups) {
  if (!QUEST_NAMES.includes(moveItem.name)) return;
  const hasPerfectKnight = actor.items.some((i) => i.type === "move" && PERFECT_KNIGHT_NAMES.includes(i.name));
  if (!hasPerfectKnight) return;

  for (const group of playerGroups) {
    if (group.maxCount === 2) group.maxCount = 3;
  }
}

function extractListGroups(moveItem, actor) {
  const rawDescription = moveItem.system?.description ?? "";
  const html = $(`<div>${rawDescription}</div>`);
  const playerGroups = [];
  const gmGroups = [];

  html.find("ul, ol").each((_, el) => {
    const $list = $(el);
    const options = $list
      .find("li")
      .map((_, li) => $(li).text().trim())
      .get()
      .filter(Boolean);
    if (options.length === 0) return;

    const precedingText = $list.prev("p").text().trim();
    classifyGroup(playerGroups, gmGroups, { label: precedingText || null, options }, precedingText);
  });

  extractBulletPseudoGroups(html, playerGroups, gmGroups);
  applyKnownMissingGmGroups(moveItem, gmGroups);
  applyPerfectKnightBoonBoost(actor, moveItem, playerGroups);

  console.log(
    `${MODULE_ID} | note-moves: extracted lists for "${moveItem.name}" — player: ${playerGroups.length}, gm: ${gmGroups.length}\n` +
      `  raw description: ${rawDescription}\n` +
      `  playerGroups: ${JSON.stringify(playerGroups)}\n` +
      `  gmGroups: ${JSON.stringify(gmGroups)}`
  );

  return { playerGroups, gmGroups };
}

// maxCount가 1보다 큰 목록(신성한 임무의 축복 등)은 드롭다운 대신
// 체크박스로 보여준다 — 정확히 N개가 아니라 "최대 N개"라 그보다 적게
// 골라도 막지 않고, 초과했을 때만 다시 띄운다(이계의 음률/화음과 같은
// "최대 개수" 원칙). 빈칸이 있는 선택지(예: "만인의 적 ______를 죽인다")는
// 체크하면 그 옆에 채워 넣을 문구를 입력하는 칸이 나타난다.
function buildGroupFieldHtml(group, index) {
  if (group.maxCount > 1) {
    const checkboxesHtml = group.options
      .map((opt, optIndex) => {
        const hasBlank = BLANK_PATTERN.test(opt);
        return `
          <label class="dwauto-counted-option"><input type="checkbox" class="dwauto-multi-answer" data-group="${index}" data-option="${optIndex}" value="${opt}"> ${opt}</label>
          ${hasBlank ? `<input type="text" class="dwauto-multi-blank" data-group="${index}" data-option="${optIndex}" style="display:none;" placeholder="${game.i18n.localize("DWAUTO.NoteMoves.BlankPlaceholder")}">` : ""}
        `;
      })
      .join("");

    return `
      <div class="form-group">
        <label>${group.label ?? game.i18n.localize("DWAUTO.NoteMoves.PromptLabel")}</label>
        <p class="dwauto-counted-count" data-group="${index}"></p>
        <div class="dwauto-counted-list">${checkboxesHtml}</div>
      </div>
    `;
  }

  const selectOptions = group.options
    .map((opt) => `<option value="${opt}">${opt}</option>`)
    .concat(`<option value="${CUSTOM_VALUE}">${game.i18n.localize("DWAUTO.NoteMoves.CustomOption")}</option>`)
    .join("");

  return `
    <div class="form-group">
      <label>${group.label ?? game.i18n.localize("DWAUTO.NoteMoves.PromptLabel")}</label>
      <select name="answer${index}">${selectOptions}</select>
    </div>
    <div class="form-group dwauto-note-blank" data-index="${index}" style="display:none;">
      <input type="text" name="blankAnswer${index}" value="" placeholder="${game.i18n.localize("DWAUTO.NoteMoves.BlankPlaceholder")}">
    </div>
    <div class="form-group dwauto-note-custom" data-index="${index}" style="display:none;">
      <input type="text" name="customAnswer${index}" value="">
    </div>
  `;
}

function promptListAnswers(moveItem, groups) {
  const fieldsHtml = groups.map((group, index) => buildGroupFieldHtml(group, index)).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `<form>${fieldsHtml}</form>`,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const answers = [];
            let tooMany = false;

            groups.forEach((group, index) => {
              if (group.maxCount > 1) {
                const checked = html.find(`.dwauto-multi-answer[data-group="${index}"]:checked`);
                if (checked.length > group.maxCount) {
                  tooMany = true;
                  return;
                }
                checked.each((_, el) => {
                  let value = el.value;
                  if (BLANK_PATTERN.test(value)) {
                    const fill = (
                      html.find(`.dwauto-multi-blank[data-group="${index}"][data-option="${el.dataset.option}"]`).val() ?? ""
                    ).trim();
                    if (fill) value = value.replace(BLANK_PATTERN, fill);
                  }
                  answers.push(value);
                });
                return;
              }

              const value = html.find(`[name="answer${index}"]`).val();
              if (value === CUSTOM_VALUE) {
                const custom = (html.find(`[name="customAnswer${index}"]`).val() ?? "").trim();
                if (custom) answers.push(custom);
                return;
              }
              if (BLANK_PATTERN.test(value)) {
                const fill = (html.find(`[name="blankAnswer${index}"]`).val() ?? "").trim();
                answers.push(fill ? value.replace(BLANK_PATTERN, fill) : value);
                return;
              }
              answers.push(value);
            });

            if (tooMany) {
              ui.notifications.warn(game.i18n.localize("DWAUTO.NoteMoves.TooManySelected"));
              promptListAnswers(moveItem, groups).then(resolve);
              return;
            }

            resolve(answers.filter(Boolean));
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve(null)
        }
      },
      default: "ok",
      width: 480,
      render: (html) => {
        groups.forEach((group, index) => {
          if (group.maxCount > 1) {
            const updateCount = () => {
              const count = html.find(`.dwauto-multi-answer[data-group="${index}"]:checked`).length;
              html
                .find(`.dwauto-counted-count[data-group="${index}"]`)
                .text(game.i18n.format("DWAUTO.NoteMoves.CountedSelectedMax", { count, max: group.maxCount }));
            };
            html.find(`.dwauto-multi-answer[data-group="${index}"]`).on("change", (event) => {
              const optIndex = event.currentTarget.dataset.option;
              html
                .find(`.dwauto-multi-blank[data-group="${index}"][data-option="${optIndex}"]`)
                .toggle(event.currentTarget.checked);
              updateCount();
            });
            updateCount();
            return;
          }

          const updateFieldVisibility = () => {
            const value = html.find(`[name="answer${index}"]`).val();
            html.find(`.dwauto-note-custom[data-index="${index}"]`).toggle(value === CUSTOM_VALUE);
            html.find(`.dwauto-note-blank[data-index="${index}"]`).toggle(value !== CUSTOM_VALUE && BLANK_PATTERN.test(value));
          };
          updateFieldVisibility();
          html.find(`[name="answer${index}"]`).on("change", updateFieldVisibility);
        });
      },
      close: () => resolve(null)
    }).render(true);
  });
}

// 동물 친구의 강점/훈련 특성/약점처럼 "목록에서 정확히 N개(사나움/교활함/
// 본능 수치만큼) 고르는" 선택을 위한 체크박스 다이얼로그. 서사적 빈칸을 위한
// 직접입력 칸을 하나 더 붙인다. N개를 강제로 막지는 않는다 — 선택 개수를
// 실시간으로 보여줘서 참고만 하게 한다(플레이어가 일부러 덜 고를 사정이
// 있을 수도 있으므로). 취소하거나 하나도 안 고르면 빈 배열을 돌려준다(주
// 선택 다이얼로그와 달리 이 단계를 건너뛴다고 무브 발동 자체를 취소할
// 이유는 없다).
function promptCountedMultiSelect(moveItem, label, options, requiredCount) {
  const checkboxesHtml = options
    .map(
      (opt, index) =>
        `<label class="dwauto-counted-option"><input type="checkbox" name="opt${index}" value="${opt}"> ${opt}</label>`
    )
    .join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <p>${label}</p>
          <div class="dwauto-counted-list">${checkboxesHtml}</div>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.NoteMoves.CustomOption")}</label>
            <input type="text" name="customExtra" value="" placeholder="${game.i18n.localize("DWAUTO.NoteMoves.BlankPlaceholder")}">
          </div>
          <p class="dwauto-counted-count"></p>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const checked = html
              .find('input[type="checkbox"]:checked')
              .map((_, el) => el.value)
              .get();
            const custom = (html.find('[name="customExtra"]').val() ?? "").trim();
            if (custom) checked.push(custom);
            resolve(checked);
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve([])
        }
      },
      default: "ok",
      width: 420,
      render: (html) => {
        const updateCount = () => {
          const count = html.find('input[type="checkbox"]:checked').length;
          html
            .find(".dwauto-counted-count")
            .text(game.i18n.format("DWAUTO.NoteMoves.CountedSelected", { count, required: requiredCount }));
        };
        html.find('input[type="checkbox"]').on("change", updateCount);
        updateCount();
      },
      close: () => resolve([])
    }).render(true);
  });
}

// 동물 친구의 "기본 능력치"가 확정된 직후(사나움/교활함/본능 숫자를 이미
// 아는 시점)에만 호출된다 — 강점은 사나움만큼, 훈련 특성은 교활함만큼, 약점은
// 본능만큼 고르는 프롬프트를 순서대로 띄운다. 그 무브의 실제 설명(번역
// 포함)에서 세 목록을 직접 뽑아 쓰므로 하드코딩된 옵션이 없다.
async function promptAnimalCompanionChoiceLists(actor, moveItem, stats) {
  const lists = parseAnimalCompanionChoiceLists(moveItem.system?.description);
  if (!lists) return;

  const steps = [
    { options: lists.strengths, count: stats.ferocity, flag: ANIMAL_STRENGTHS_FLAG, labelKey: "DWAUTO.NoteMoves.AnimalStrengthsLabel" },
    { options: lists.trainings, count: stats.cunning, flag: ANIMAL_TRAININGS_FLAG, labelKey: "DWAUTO.NoteMoves.AnimalTrainingsLabel" },
    { options: lists.weaknesses, count: stats.instinct, flag: ANIMAL_WEAKNESSES_FLAG, labelKey: "DWAUTO.NoteMoves.AnimalWeaknessesLabel" }
  ];

  for (const step of steps) {
    if (step.options.length === 0 || !step.count) continue;
    const chosen = await promptCountedMultiSelect(
      moveItem,
      game.i18n.format(step.labelKey, { count: step.count }),
      step.options,
      step.count
    );
    if (chosen.length > 0) await actor.setFlag(MODULE_ID, step.flag, chosen);
  }
}

async function activate(actor, moveItem) {
  const { playerGroups } = extractListGroups(moveItem, actor);
  let answers = null;

  if (playerGroups.length > 0) {
    answers = await promptListAnswers(moveItem, playerGroups);
    if (!answers) return;
  }

  await setActivated(actor, moveItem.id, true);

  if (isDivineFavorMove(moveItem) && getClericLevel(actor) === null) {
    await setClericLevel(actor, 1);
  }

  if (answers && answers.length > 0) {
    await setAnswer(actor, moveItem.id, answers);

    // 동반 동물의 "기본 능력치 선택" 답이면(사나움/교활함/본능/장갑 넷 다
    // 파싱되면) 숫자로도 따로 저장한다 — 어느 무브에서 왔는지는 안 따진다
    // (이 패턴에 우연히 맞아떨어질 다른 메모형 무브 답은 사실상 없다).
    let animalStats = null;
    for (const answer of answers) {
      const stats = parseAnimalCompanionStats(answer);
      if (stats) {
        animalStats = stats;
        await actor.setFlag(MODULE_ID, ANIMAL_STATS_FLAG, stats);
        break;
      }
    }

    if (animalStats) {
      await promptAnimalCompanionChoiceLists(actor, moveItem, animalStats);
    }

    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.NoteMoves.AnswerChosen", { answer: answers.join(" / ") })
    );
  } else {
    announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.NoteMoves.Activated"));
  }
}

// 설정("메모형 무브 이름")에 등록된 이름과 채팅 카드 제목을 비교한다. 설정값이
// 아직 번역 전(영문 기본값)이어도, 지금 이 시점의 번역 데이터로 다시 한번
// 확인해서 매칭을 놓치지 않는다(born-of-the-soil.js가 쓰던 방식과 동일).
async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.NOTE_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    for (const defaultName of DEFAULT_NOTE_MOVE_NAMES) {
      if (nameMap.get(defaultName) === title) return true;
    }
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title } = info;
    if (actor.type !== "character") return;

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;
    if (isActivated(actor, moveItem.id)) return;

    await activate(actor, moveItem);
  } catch (err) {
    console.error(`${MODULE_ID} | note-moves: onCreateChatMessage failed`, err);
  }
}

// 4개 플래그를 따로따로(각각 별도의 actor.update) 지우면, 그 사이사이 갱신
// 이벤트마다 시트가 자동으로 다시 그려질 수 있어서 아직 일부만 지워진
// "중간 상태"로 렌더링됐다가 마지막 갱신이 끝나야 완전히 사라지는 경합이
// 생길 수 있다(탭이 잠깐 사라졌다 다시 생기는 것처럼 보였던 원인). 네 플래그를
// 한 번의 actor.update로 원자적으로 지워서 그런 중간 상태 자체가 생기지
// 않게 한다. "flags.모듈.플래그.-=키" 문법은 그 키 하나만 지우는 Foundry의
// 표준 플래그 삭제 방식이다.
// 동물 친구 탭을 초기화하는 경우, 무브별이 아니라 액터 하나당 값 하나로
// 저장되는 능력치/강점/훈련/약점 플래그(다른 메모형 무브를 초기화할 때는
// 절대 건드리면 안 된다)도 같이 지워서 재선택 시 옛 숫자가 남지 않게 한다.
// 이 무브가 동물 친구인지는 이름이 아니라 실제 설명 구조(사나움/교활함/본능
// 개수만큼 고르는 <h3>+<p> 목록이 있는지)로 판단한다.
async function resetNoteMove(actor, moveItem) {
  const updates = {
    [`flags.${MODULE_ID}.${ACTIVATED_FLAG}.-=${moveItem.id}`]: null,
    [`flags.${MODULE_ID}.${ANSWER_FLAG}.-=${moveItem.id}`]: null,
    [`flags.${MODULE_ID}.${GM_CHOICE_FLAG}.-=${moveItem.id}`]: null,
    [`flags.${MODULE_ID}.${NOTES_FLAG}.-=${moveItem.id}`]: null
  };

  const isAnimalCompanion = parseAnimalCompanionChoiceLists(moveItem.system?.description) !== null;
  if (isAnimalCompanion) {
    updates[`flags.${MODULE_ID}.-=${ANIMAL_STATS_FLAG}`] = null;
    updates[`flags.${MODULE_ID}.-=${ANIMAL_STRENGTHS_FLAG}`] = null;
    updates[`flags.${MODULE_ID}.-=${ANIMAL_TRAININGS_FLAG}`] = null;
    updates[`flags.${MODULE_ID}.-=${ANIMAL_WEAKNESSES_FLAG}`] = null;
  }

  await actor.update(updates);

  if (isAnimalCompanion) {
    for (const listener of animalCompanionResetListeners) {
      await listener(actor);
    }
  }
}

// "GM이 나중에 정해준다"고 적힌 목록(퀘스트의 서약 등)을 체크박스로 보여준다
// (하나 이상 고를 수 있다는 원문에 맞춰 드롭다운이 아니라 체크박스로 만든다).
// 특별히 GM 권한으로 잠그지는 않는다 — 이 시트를 열어서 편집할 수 있는
// 사람(보통 GM)이 체크하면 된다.
function renderGmChoiceSection(actor, moveItem, gmGroups) {
  if (gmGroups.length === 0) return "";

  const selected = new Set(getGmChoice(actor, moveItem.id));
  const optionsHtml = gmGroups
    .flatMap((group) => group.options)
    .map(
      (opt) =>
        `<label class="dwauto-gm-choice-option"><input type="checkbox" class="dwauto-gm-choice-checkbox" value="${opt}" ${selected.has(opt) ? "checked" : ""}> ${opt}</label>`
    )
    .join("");

  return `
    <label class="cell__title">${game.i18n.localize("DWAUTO.NoteMoves.GmChoiceLabel")}</label>
    <div class="dwauto-gm-choice-list">${optionsHtml}</div>
  `;
}

function renderTab(actor, moveItem, html) {
  const $body = injectActorTab({
    html,
    actor,
    tabKey: `dwauto-note-${moveItem.id}`,
    navLabel: moveItem.name,
    onReset: () => resetNoteMove(actor, moveItem)
  });
  $body.addClass("dwauto-tab");

  const description = moveItem.system?.description ?? "";
  const answers = getAnswer(actor, moveItem.id);
  const text = getNoteText(actor, moveItem.id);
  const { gmGroups } = extractListGroups(moveItem, actor);
  const clericLevel = isDivineFavorMove(moveItem) ? (getClericLevel(actor) ?? 1) : null;
  const isAnimalCompanion = parseAnimalCompanionChoiceLists(description) !== null;
  const stats = isAnimalCompanion ? getAnimalCompanionStats(actor) : null;
  const strengths = isAnimalCompanion ? actor.getFlag(MODULE_ID, ANIMAL_STRENGTHS_FLAG) ?? [] : [];
  const trainings = isAnimalCompanion ? getAnimalCompanionTrainings(actor) : [];
  const weaknesses = isAnimalCompanion ? actor.getFlag(MODULE_ID, ANIMAL_WEAKNESSES_FLAG) ?? [] : [];
  const renderTagRow = (labelKey, items) =>
    items.length > 0
      ? `<label class="cell__title">${game.i18n.localize(labelKey)}</label>${items
          .map((a) => `<a class="tag dwauto-note-answer">${a}</a>`)
          .join(" ")}`
      : "";

  const $section = $(`
    <div class="cell dwauto-note-move">
      ${description ? `<div class="dwauto-note-description">${description}</div>` : ""}
      ${
        answers.length > 0
          ? `<label class="cell__title">${game.i18n.localize("DWAUTO.NoteMoves.AnswerLabel")}</label>${answers
              .map((a) => `<a class="tag dwauto-note-answer">${a}</a>`)
              .join(" ")}`
          : ""
      }
      ${
        stats
          ? `<label class="cell__title">${game.i18n.localize("DWAUTO.NoteMoves.AnimalStatsLabel")}</label><a class="tag dwauto-note-answer">${game.i18n.format("DWAUTO.NoteMoves.AnimalStatsSummary", stats)}</a>`
          : ""
      }
      ${renderTagRow("DWAUTO.NoteMoves.AnimalStrengthsTitle", strengths)}
      ${renderTagRow("DWAUTO.NoteMoves.AnimalTrainingsTitle", trainings)}
      ${renderTagRow("DWAUTO.NoteMoves.AnimalWeaknessesTitle", weaknesses)}
      ${
        clericLevel !== null
          ? `<label class="cell__title">${game.i18n.localize("DWAUTO.NoteMoves.ClericLevelLabel")}</label>
             <input type="number" class="dwauto-cleric-level-input" min="1" value="${clericLevel}">`
          : ""
      }
      ${renderGmChoiceSection(actor, moveItem, gmGroups)}
      <label class="cell__title dwauto-note-move">${game.i18n.localize("DWAUTO.NoteMoves.NotesLabel")}</label>
      <textarea class="dwauto-note-textarea" rows="8">${text}</textarea>
    </div>
  `);

  $section.find(".dwauto-cleric-level-input").on("change", (event) => {
    setClericLevel(actor, event.currentTarget.value);
  });

  $section.find(".dwauto-gm-choice-checkbox").on("change", () => {
    const checked = $section
      .find(".dwauto-gm-choice-checkbox:checked")
      .map((_, el) => el.value)
      .get();
    setGmChoice(actor, moveItem.id, checked);
  });

  $section.find(".dwauto-note-textarea").on("change", (event) => {
    setNoteText(actor, moveItem.id, event.currentTarget.value);
  });

  $body.append($section);
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const names = splitCommaList(SETTINGS.NOTE_MOVE_NAMES);
  if (names.length === 0) return;

  for (const moveItem of actor.items) {
    if (moveItem.type !== "move" || !names.includes(moveItem.name)) continue;
    if (!isActivated(actor, moveItem.id)) continue;
    renderTab(actor, moveItem, html);
  }
}

// v0.24.0 전에는 이 여섯 무브(신/신격/동반 동물/사명/신에게 헌신/황야 속의
// 신)를 "소유만으로" 탭이 떴다. 이미 그 상태로 캐릭터를 플레이해온 세계에서
// 갑자기 탭이 사라지면 당황스러우니, 지금 이미 그 무브를 갖고 있는 액터는
// 한 번에 한해 "이미 발동한 것"으로 간주해 탭이 계속 보이게 한다. 이후로
// 새로 이 무브를 얻는 액터(또는 GM이 나중에 목록에 추가하는 새 이름)는 실제
// 발동이 필요하다.
async function migrateLegacyOwnershipToActivation() {
  if (!game.user.isGM) return;

  let nameMap = null;
  try {
    nameMap = await getMoveNameMap();
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 기본값 기준으로는 진행한다.
  }

  const legacyNames = new Set(DEFAULT_NOTE_MOVE_NAMES);
  if (nameMap) {
    for (const name of DEFAULT_NOTE_MOVE_NAMES) {
      const translated = nameMap.get(name);
      if (translated) legacyNames.add(translated);
    }
  }

  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    const current = actor.getFlag(MODULE_ID, ACTIVATED_FLAG) ?? {};
    let changed = false;
    const next = { ...current };
    for (const moveItem of actor.items) {
      if (moveItem.type !== "move" || !legacyNames.has(moveItem.name)) continue;
      if (next[moveItem.id]) continue;
      next[moveItem.id] = true;
      changed = true;
    }
    if (changed) await actor.setFlag(MODULE_ID, ACTIVATED_FLAG, next);
  }
}

// features/born-of-the-soil.js는 v0.24.0에서 폐지되고 이 파일에 완전히
// 통합됐다(더 이상 "소유 시 탭" 대 "발동 시 탭"을 구분하지 않으므로 별도
// 기능일 이유가 없다). 그 기능이 쓰던 설정("대지의 아들/딸 무브 이름")과
// 액터별 플래그(bornOfSoilActivated/bornOfSoilMoveId/bornOfSoilLand/
// bornOfSoilNotes)를 여기 새 통합 체계로 한 번에 옮긴다.
async function migrateBornOfSoilIntoNoteMoves() {
  if (!game.user.isGM) return;

  const bornNames = game.settings
    .get(MODULE_ID, SETTINGS.BORN_OF_THE_SOIL_MOVE_NAMES)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (bornNames.length > 0) {
    const currentNames = splitCommaList(SETTINGS.NOTE_MOVE_NAMES);
    const existing = new Set(currentNames);
    const toAdd = bornNames.filter((n) => !existing.has(n));
    if (toAdd.length > 0) {
      await game.settings.set(MODULE_ID, SETTINGS.NOTE_MOVE_NAMES, [...currentNames, ...toAdd].join(", "));
    }
  }

  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    if (!actor.getFlag(MODULE_ID, "bornOfSoilActivated")) continue;

    const moveId = actor.getFlag(MODULE_ID, "bornOfSoilMoveId");
    if (moveId) {
      await setActivated(actor, moveId, true);
      const land = actor.getFlag(MODULE_ID, "bornOfSoilLand");
      if (land) await setAnswer(actor, moveId, [land]);
      const notes = actor.getFlag(MODULE_ID, "bornOfSoilNotes");
      if (notes) await setNoteText(actor, moveId, notes);
    }

    await actor.unsetFlag(MODULE_ID, "bornOfSoilActivated");
    await actor.unsetFlag(MODULE_ID, "bornOfSoilMoveId");
    await actor.unsetFlag(MODULE_ID, "bornOfSoilLand");
    await actor.unsetFlag(MODULE_ID, "bornOfSoilNotes");
  }

  console.log(`${MODULE_ID} | note-moves: merged Born of the Soil into the unified note-move system`);
}

// v0.39.0(레인저 명령/Command 자동화)이 나오기 전까지는 동물 친구의 "기본
// 능력치 선택" 답이 저장은 됐어도(ANSWER_FLAG) 숫자로 파싱되지는(ANIMAL_STATS_FLAG)
// 않았다. 이미 동물 친구를 발동해서 답을 골라둔 기존 액터는 activate()가
// 다시 호출되지 않으므로(이미 발동된 무브라 새로 프롬프트를 안 띄운다),
// 저장된 답을 다시 훑어서 놓친 숫자를 채워 넣는다. 강점/훈련 특성/약점은
// 이번에 새로 생긴 선택 단계라 옛 데이터에 애초에 없으므로 백필 대상이
// 아니다 — 필요하면 시트에서 동물 친구 탭을 초기화하고 다시 골라야 한다.
async function migrateBackfillAnimalCompanionStats() {
  if (!game.user.isGM) return;

  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    if (actor.getFlag(MODULE_ID, ANIMAL_STATS_FLAG)) continue;

    const answerMap = actor.getFlag(MODULE_ID, ANSWER_FLAG) ?? {};
    for (const rawAnswers of Object.values(answerMap)) {
      const answers = Array.isArray(rawAnswers) ? rawAnswers : [rawAnswers];
      const stats = answers.map(parseAnimalCompanionStats).find(Boolean);
      if (stats) {
        await actor.setFlag(MODULE_ID, ANIMAL_STATS_FLAG, stats);
        break;
      }
    }
  }

  console.log(`${MODULE_ID} | note-moves: backfilled animal companion stats for already-activated actors`);
}

// 신의 은혜의 클레릭 레벨을 실제 캐릭터 레벨과 같이 움직이게 한다.
// preUpdateActor 시점에는 아직 옛 레벨이 남아있으므로 여기서 잠깐 기억해뒀다가,
// updateActor에서 그 차이(보통 +1이지만 GM이 레벨을 여러 단계 조정하는
// 경우도 있어 델타로 계산한다)만큼 클레릭 레벨도 같이 조정한다.
function onPreUpdateActorForClericLevel(actor, changes) {
  if (!isEnabled()) return true;
  if (actor.type !== "character") return true;

  const flat = foundry.utils.flattenObject(changes);
  if (!("system.attributes.level.value" in flat)) return true;

  lastKnownActorLevel.set(actor.id, Number(actor.system.attributes?.level?.value) || 1);
  return true;
}

function onUpdateActorForClericLevel(actor, changes, options, userId) {
  if (!isEnabled()) return;
  if (actor.type !== "character") return;
  if (userId !== game.user.id) return;

  const flat = foundry.utils.flattenObject(changes);
  if (!("system.attributes.level.value" in flat)) return;

  const oldLevel = lastKnownActorLevel.get(actor.id);
  lastKnownActorLevel.delete(actor.id);
  if (oldLevel === undefined) return;

  const clericLevel = getClericLevel(actor);
  if (clericLevel === null) return;

  const newLevel = Number(flat["system.attributes.level.value"]) || oldLevel;
  const delta = newLevel - oldLevel;
  if (delta === 0) return;

  setClericLevel(actor, clericLevel + delta).then(() => {
    const moveItem = actor.items.find((i) => i.type === "move" && DIVINE_FAVOR_NAMES.includes(i.name));
    if (moveItem) {
      announceActionApplied(
        actor,
        moveItem.name,
        game.i18n.format("DWAUTO.NoteMoves.ClericLevelChanged", { level: Math.max(1, clericLevel + delta) })
      );
    }
  });
}

// 레인저 황무지의 신(God Amidst The Wastes)이 이번 업데이트 전에는
// DIVINE_FAVOR_NAMES에 없어서, 그 전에 이미 발동해둔 액터는 클레릭 레벨이
// 한 번도 초기화되지 않았다 — 이미 발동(isActivated)했는데 아직 클레릭
// 레벨이 없는 액터를 찾아 1로 채워 넣는다(그 뒤로는 레벨업 훅이 정상적으로
// 이어서 관리한다).
async function migrateBackfillClericLevel() {
  if (!game.user.isGM) return;

  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    const moveItem = actor.items.find((i) => i.type === "move" && isDivineFavorMove(i));
    if (!moveItem) continue;
    if (!isActivated(actor, moveItem.id)) continue;
    if (getClericLevel(actor) !== null) continue;

    await setClericLevel(actor, 1);
  }
}

export function registerNoteMoves() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.on("preUpdateActor", onPreUpdateActorForClericLevel);
  Hooks.on("updateActor", onUpdateActorForClericLevel);
  Hooks.once("ready", () => {
    migrateBornOfSoilIntoNoteMoves()
      .then(() => migrateLegacyOwnershipToActivation())
      .then(() => migrateBackfillAnimalCompanionStats())
      .then(() => migrateBackfillClericLevel());
  });
}
