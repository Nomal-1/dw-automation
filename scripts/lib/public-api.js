import { getMoveCardInfo, findMoveItem } from "./move-card.js";
import { getMoveChoiceData, promptChoiceSelection, extractInlineRoll, extractSignedInlineRoll } from "./move-choices.js";
import { announceActionApplied, announceInfo } from "./announce.js";
import { promptActorTarget, promptActorMultiTarget, getCandidateActors } from "./actor-target-picker.js";
import { getMoveNameMap, getClassNameMap } from "./translation-import.js";
import { setPendingRollBonus, getPendingRollBonus, clearPendingRollBonus, rollBonusAppliesTo } from "./roll-bonus-state.js";
import { getOrCreateTagsContainer } from "./sheet-badges.js";

// 이 모듈에 의존하는 다른 모듈(예: Nomal's DW 홈브루 자동화)이 scripts/lib/*.js
// 내부 파일을 직접 import하지 않고 이 API 하나로만 접근하게 하기 위한 공개
// 표면이다. main.js가 ready 훅에서 game.modules.get("dw-automation").api에
// 이 객체를 그대로 얹는다(ARCHITECTURE.md 9번 항목 참고). 내부 파일 구조가
// 바뀌어도 여기 이름·시그니처만 유지하면 의존 모듈이 조용히 깨지지 않는다.
//
// 새 함수를 추가할 땐 여기에도 추가하고, ARCHITECTURE.md의 API 목록도 같이
// 갱신할 것.
export function buildPublicApi() {
  return {
    // lib/move-card.js — 무브 굴림 채팅 카드 파싱
    getMoveCardInfo,
    findMoveItem,

    // lib/move-choices.js — 선택지 목록 다이얼로그
    getMoveChoiceData,
    promptChoiceSelection,
    extractInlineRoll,
    extractSignedInlineRoll,

    // lib/announce.js — 채팅 알림
    announceActionApplied,
    announceInfo,

    // lib/actor-target-picker.js — 대상 선택 다이얼로그
    promptActorTarget,
    promptActorMultiTarget,
    getCandidateActors,

    // lib/translation-import.js — 번역 인식 이름 매칭
    getMoveNameMap,
    getClassNameMap,

    // lib/roll-bonus-state.js — "다음 판정 한 번" 대기 보정치
    setPendingRollBonus,
    getPendingRollBonus,
    clearPendingRollBonus,
    rollBonusAppliesTo,

    // lib/sheet-badges.js — 캐릭터 시트 무브 항목에 배지 붙이기
    getOrCreateTagsContainer
  };
}
