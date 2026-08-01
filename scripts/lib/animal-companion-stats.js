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
