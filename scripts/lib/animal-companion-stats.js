// 레인저 동반 동물(Animal Companion)의 "기본 능력치 선택" 목록 원문:
//   "Ferocity +2, Cunning +1, Instinct +1, 1 Armor" (그 외 3가지 조합)
// 한글 번역(Nomal-1/t2 확인): "사나움 +2, 교활함 +1, 장갑 1, 본능 +1."
// (Armor만 순서가 다르고 "+" 부호가 없다 — 두 언어 모두 실제 확인된 표기.)
//
// features/note-moves.js가 이 선택지를 이미 문자열 그대로 저장해주므로
// ("Choose a base:" 목록에서 고른 답 그대로), 그 문장에서 각 라벨(영문/한글)
// 옆의 숫자만 뽑아내서 실제 계산에 쓸 수 있는 숫자로 바꾼다. 넷 중 하나라도
// 못 찾으면(다른 언어로 번역됐거나, 이 선택지가 아닌 다른 답이면) null —
// 틀린 값을 조용히 절반만 채우는 것보다 아예 자동화를 건너뛰는 편이 안전하다.
const STAT_PATTERNS = {
  ferocity: [/Ferocity\s*\+?\s*(\d+)/i, /사나움\s*\+?\s*(\d+)/],
  cunning: [/Cunning\s*\+?\s*(\d+)/i, /교활함\s*\+?\s*(\d+)/],
  instinct: [/Instinct\s*\+?\s*(\d+)/i, /본능\s*\+?\s*(\d+)/],
  armor: [/(\d+)\s*Armor/i, /장갑\s*\+?\s*(\d+)/]
};

export function parseAnimalCompanionStats(text) {
  if (!text) return null;

  const result = {};
  for (const [stat, patterns] of Object.entries(STAT_PATTERNS)) {
    let found = null;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        found = Number(match[1]);
        break;
      }
    }
    if (found === null) return null;
    result[stat] = found;
  }
  return result;
}

// 동물 친구 설명 안에는 "기본 능력치를 선택합니다"(<ul>, 이미 parseAnimalCompanionStats로
// 처리됨) 말고도 <h3>제목 문단 바로 뒤에 <p>쉼표 목록</p>이 오는 구조로
// "사나움 수치만큼 선택하는 강점", "교활함만큼 선택하는 훈련 특성",
// "본능만큼 선택하는 약점" 목록이 각각 들어있다(종류 목록도 같은 구조지만
// 여긴 다루지 않는다). 어느 <h3>가 어느 목록인지는 그 제목 문장에 "Ferocity/
// 사나움" · "Cunning/교활함" · "Instinct/본능" 중 어떤 단어가 들어있는지로
// 구분한다 — 원문/번역 모두 그 능력치 이름이 반드시 제목에 등장하기 때문에
// 정확한 헤딩 문구가 조금 달라져도(예: 확장/서드파티 무브) 안정적으로 맞는다.
// "_______" 같은 서사적 빈칸 옵션은 목록에서 제외한다(직접입력으로 대체).
const BLANK_OPTION_PATTERN = /_{2,}/;

function extractHeadingListPairs(description) {
  const html = $(`<div>${description ?? ""}</div>`);
  const pairs = [];
  html.find("h3").each((_, h3) => {
    const heading = $(h3).text();
    const $next = $(h3).next();
    if (!$next.is("p")) return;
    const options = $next
      .text()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !BLANK_OPTION_PATTERN.test(s));
    if (options.length > 0) pairs.push({ heading, options });
  });
  return pairs;
}

function findByKeyword(pairs, keywords) {
  const match = pairs.find((p) => keywords.some((k) => p.heading.includes(k)));
  return match?.options ?? [];
}

// features/note-moves.js가 동물 친구의 "기본 능력치" 답을 확정한 직후(사나움/
// 교활함/본능 숫자를 이미 아는 시점) 이 함수로 강점/훈련/약점 옵션 목록을
// 뽑아서, 각각 사나움/교활함/본능 개수만큼 고르는 다중 선택 프롬프트를
// 띄우는 데 쓴다. 셋 다 못 찾으면(원문 구조 자체가 다른 서드파티 무브 등) null.
export function parseAnimalCompanionChoiceLists(description) {
  const pairs = extractHeadingListPairs(description);
  const strengths = findByKeyword(pairs, ["Ferocity", "사나움"]);
  const trainings = findByKeyword(pairs, ["Cunning", "교활함"]);
  const weaknesses = findByKeyword(pairs, ["Instinct", "본능"]);
  if (strengths.length === 0 && trainings.length === 0 && weaknesses.length === 0) return null;
  return { strengths, trainings, weaknesses };
}
