import { MOVE_CLASS_LABELS } from "../data/move-class-labels.js";
import { getMoveNameMap } from "./translation-import.js";

// 던전월드 무브 이름은 컴펜디엄마다 어퍼스트로피(’)와 작은따옴표(')가
// 뒤섞여 쓰인다(이 세션에서 여러 번 겪은 버그 패턴) — 조회 전에 하나로
// 통일해서 그 차이 때문에 조회가 실패하지 않게 한다.
function normalizeApostrophe(name) {
  return (name ?? "").replace(/[’']/g, "'");
}

// 설정 메뉴의 표는 저장된 이름이 영문 기본값일 수도, 이미 한글로 번역되어
// 있을 수도 있다. 먼저 영문 표(MOVE_CLASS_LABELS)에서 바로 찾고, 못 찾으면
// dungeonworld-ko 번역 데이터(영문→한글)를 뒤집어서 "이 한글 이름의 원래
// 영문 이름이 뭐였는지" 역으로 찾아 다시 조회한다 — class-grant.js의
// matchesConfiguredRow와 같은 방식(항상 영문 원본을 기준으로 판단).
export async function annotateRowsWithClass(rows, { disambiguate, nameField = "name" } = {}) {
  let reverseMap = null;
  try {
    const nameMap = await getMoveNameMap();
    reverseMap = new Map();
    for (const [en, ko] of nameMap.entries()) {
      if (!reverseMap.has(ko)) reverseMap.set(ko, en);
    }
  } catch (err) {
    // 번역 데이터를 못 읽으면 영문 이름 직접 매칭만으로 판단한다.
  }

  return rows.map((row) => {
    const rawName = row[nameField];
    const direct = normalizeApostrophe(rawName);
    const englishName = MOVE_CLASS_LABELS[direct] ? direct : normalizeApostrophe(reverseMap?.get(rawName) ?? rawName);

    let classLabel = MOVE_CLASS_LABELS[englishName] ?? null;
    if (disambiguate) classLabel = disambiguate(row, englishName) ?? classLabel;

    return { ...row, classLabel };
  });
}

// 표시 순서: 직업 이름 가나다순으로 묶고, 분류를 모르는 행(신규 GM 커스텀
// 무브 등)은 맨 뒤로 보낸다.
export function sortRowsByClass(rows) {
  return [...rows].sort((a, b) => {
    if (!a.classLabel && !b.classLabel) return 0;
    if (!a.classLabel) return 1;
    if (!b.classLabel) return -1;
    return a.classLabel.localeCompare(b.classLabel, "ko");
  });
}
