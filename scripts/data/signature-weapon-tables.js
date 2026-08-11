// 전사 핵심액션 고유병기(Signature Weapon) 원문 그대로 옮긴 선택지 표.
// 출처: 던전월드 시스템 컴펜디엄(the-fighter-moves, "Signature Weapon").
// 태그 값 자체는 이 모듈의 다른 무기 태그(불타는 낙인 등)와 마찬가지로
// 영문 그대로 쓴다 — 근접/사격 자동 인식이나 피해·관통 문구 인식(태그
// 카탈로그)이 전부 영문 태그를 기준으로 비교하기 때문이다. 표시용 라벨은
// Nomal-1/t2 한글화 모듈의 태그 컴펜디엄(dungeonworld.tags.json) 공식
// 번역을 그대로 따른다: Hand=반걸음, Close=한걸음, Reach=몇걸음,
// Messy=파괴적, Forceful=괴력, Precise=정밀.
export const BASE_OPTIONS = [
  { value: "Sword", label: "검 (Sword)" },
  { value: "Axe", label: "도끼 (Axe)" },
  { value: "Hammer", label: "망치 (Hammer)" },
  { value: "Spear", label: "창 (Spear)" },
  { value: "Flail", label: "도리깨 (Flail)" },
  { value: "Fists", label: "맨주먹 (Fists)" }
];

// 2번째 질문: 무기에 가장 잘 맞는 사정거리를 고르십시오.
export const RANGE_OPTIONS = [
  { value: "hand", label: "반걸음 (Hand)" },
  { value: "reach", label: "몇걸음 (Reach)" },
  { value: "close", label: "한걸음 (Close)" }
];

// 3번째 질문: 강화를 두 개 고르십시오.
export const ENHANCEMENT_OPTIONS = [
  { value: "hooksSpikes", label: "갈고리와 가시: 피해 +1, 무게 +1", damageMod: 1, weightMod: 1 },
  { value: "sharp", label: "날카로움: 관통 +2", pierce: 2 },
  { value: "perfectlyWeighted", label: "완벽한 균형: 정밀(precise) 태그 추가", tags: ["precise"] },
  { value: "serratedEdges", label: "톱니날: 피해 +1", damageMod: 1 },
  { value: "glows", label: "특정 생물 앞에서 빛남(직접 정하기)", needsCreatureInput: true },
  { value: "huge", label: "거대함: 파괴적(messy), 괴력(forceful) 태그 추가", tags: ["messy", "forceful"] },
  { value: "versatile", label: "다재다능: 사정거리를 하나 더 고를 수 있다", needsExtraRange: true },
  { value: "wellCrafted", label: "정교한 제작: 무게 -1", weightMod: -1 }
];

// 4번째 질문: 외양을 고르십시오(서사적 효과만 있음).
export const LOOK_OPTIONS = [
  { value: "ancient", label: "고풍스러움 (Ancient)" },
  { value: "unblemished", label: "흠 없음 (Unblemished)" },
  { value: "ornate", label: "화려함 (Ornate)" },
  { value: "bloodStained", label: "피로 얼룩짐 (Blood-stained)" },
  { value: "sinister", label: "불길함 (Sinister)" }
];
