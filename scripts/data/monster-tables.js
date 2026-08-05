/* 던전월드 한국어 공개판(김성일역, CC BY 3.0) "괴물" 챕터의 "괴물 만들기"/"보물"
 * 절차를 그대로 옮긴 데이터 표. 출처: https://sites.google.com/view/dwtemporary/괴물
 * npc-tables.js(본능/재주/이름 표)와 같은 이유로 원문 텍스트를 그대로 담아두고
 * 번역하지 않는다 — 이 표 자체가 한국어 룰북 원문이라 영문판이 존재하지 않는다.
 * lib/monster-builder.js가 이 표를 읽어 실제 계산을 한다.
 */

// "한 단계 낮춘다/높인다"의 기준이 되는 피해 주사위 단계표. 표의 기본값(대집단
// d6/소집단 d8/외톨이 d10)에 d4와 d12를 더해 양쪽으로 한 단계씩 움직일 여지를
// 둔다.
export const DAMAGE_DICE = ["d4", "d6", "d8", "d10", "d12"];

// 3번째 질문: 사냥이나 싸움을 어떤 식으로 합니까?
export const ORGANIZATION_OPTIONS = [
  { value: "horde", label: "큰 무리를 지어서: 대집단, 피해 d6, HP 3", tag: "대집단", damageDie: "d6", hp: 3 },
  { value: "group", label: "둘에서 다섯 사이의 작은 무리를 지어서: 소집단, 피해 d8, HP 6", tag: "소집단", damageDie: "d8", hp: 6 },
  { value: "solo", label: "혼자서: 외톨이, 피해 d10, HP 12", tag: "외톨이", damageDie: "d10", hp: 12 }
];

// 4번째 질문: 얼마나 큽니까?
export const SIZE_OPTIONS = [
  {
    value: "tiny",
    label: "고양이보다 작음: 매우 작음, 반걸음, 피해 -2",
    tags: ["매우 작음"],
    rangeTags: ["반걸음"],
    damageMod: -2
  },
  { value: "small", label: "하플링 크기: 작음, 한걸음", tags: ["작음"], rangeTags: ["한걸음"] },
  { value: "normal", label: "사람 크기: 한걸음", tags: [], rangeTags: ["한걸음"] },
  {
    value: "large",
    label: "수레 크기: 큼, 한걸음, 몇걸음, HP +4, 피해 +1",
    tags: ["큼"],
    rangeTags: ["한걸음", "몇걸음"],
    hp: 4,
    damageMod: 1
  },
  {
    value: "huge",
    label: "수레보다 훨씬 큼: 거대, 몇걸음, HP +8, 피해 +3",
    tags: ["거대"],
    rangeTags: ["몇걸음"],
    hp: 8,
    damageMod: 3
  }
];

// 5번째 질문: 가장 중요한 방어 수단은 무엇입니까?
export const ARMOR_OPTIONS = [
  { value: "0", label: "옷이나 맨살: 장갑 0", armor: 0 },
  { value: "1", label: "가죽이나 두꺼운 피부: 장갑 1", armor: 1 },
  { value: "2", label: "사슬 갑옷이나 비늘: 장갑 2", armor: 2 },
  { value: "3", label: "판금 갑옷이나 뼈: 장갑 3", armor: 3 },
  { value: "4", label: "영구적인 보호 마법: 장갑 4, 마법적", armor: 4, tags: ["마법적"] }
];

// 6번째 질문: 무엇으로 유명합니까? (복수 선택 가능)
export const FAME_OPTIONS = [
  { value: "might", label: "용솟음치는 힘: 피해 +2, 괴력", damageMod: 2, tags: ["괴력"] },
  { value: "skilled", label: "공격 솜씨: 피해 주사위를 두 번 굴리고 더 높은 쪽을 취합니다", rollMode: "advantage" },
  { value: "defensive", label: "방어 솜씨: 장갑 +1", armor: 1 },
  { value: "precise", label: "정확한 타격: 관통 +1", pierce: 1 },
  { value: "tough", label: "놀라운 지구력: HP +4", hp: 4 },
  {
    value: "tricky",
    label: "속임수: 은밀. 치사한 수법에 관한 액션을 만드십시오",
    tags: ["은밀"],
    reminder: "속임수 — 치사한 수법에 관한 액션을 만드십시오."
  },
  {
    value: "feature",
    label: "날개, 아가미 등 유용한 특성: 특기사항을 추가하십시오",
    reminder: "날개, 아가미 등 유용한 특성을 특기사항에 추가하십시오."
  },
  { value: "blessed", label: "신의 은총: 신성, 피해 +2나 HP +2, 또는 둘 다(마스터 선택)", tags: ["신성"], needsBlessedChoice: true },
  {
    value: "magic",
    label: "주문과 마법: 마법적, 주문을 나타내는 액션을 만드십시오",
    tags: ["마법적"],
    reminder: "주문과 마법 — 주문을 나타내는 액션을 만드십시오."
  }
];

// "신의 은총"을 골랐을 때의 하위 선택.
export const BLESSED_CHOICE_OPTIONS = [
  { value: "damage", label: "피해 +2" },
  { value: "hp", label: "HP +2" },
  { value: "both", label: "피해 +2, HP +2 모두" }
];

// 7번째 질문: 가장 자주 사용하는 공격 방식은 무엇입니까? (복수 선택 가능)
export const ATTACK_TRAIT_OPTIONS = [
  { value: "vicious", label: "공격 수단이 흉악하고 눈에 잘 띈다: 피해 +2", damageMod: 2 },
  { value: "reach", label: "괴물이 적들과 거리를 둘 수 있게 해 준다: 몇걸음", rangeTags: ["몇걸음"] },
  { value: "weak", label: "공격 수단이 작고 약하다: 피해 주사위를 한 단계 낮춥니다", dieStep: -1 },
  { value: "metal", label: "금속도 꿰뚫거나 자를 수 있다: 파괴적, 관통 +1", tags: ["파괴적"], pierce: 1 },
  {
    value: "metalShred",
    label: "(위 항목 대신) 금속을 그냥 찢어발길 수 있다: 파괴적, 관통 +3",
    tags: ["파괴적"],
    pierce: 3,
    overrides: "metal"
  },
  { value: "ignoresArmor", label: "갑옷을 무시하는 피해를 준다 (마법, 거대한 덩치 등): 장갑 무시", tags: ["장갑 무시"] },
  { value: "rangedMid", label: "주로 원거리에서 공격을 한다: 중거리", rangeTags: ["중거리"] },
  { value: "rangedFar", label: "주로 원거리에서 공격을 한다: 장거리", rangeTags: ["장거리"] }
];

// 8번째 질문: 다음 중 적절한 설명을 모두 고르십시오.
export const TRAIT_OPTIONS = [
  {
    value: "sneaky",
    label: "싸움에서 피해를 잘 주는 것 외의 이유로 위험하다: 음흉, 피해 주사위를 한 단계 낮춥니다",
    tags: ["음흉"],
    dieStep: -1,
    reminder: "음흉 — 괴물이 위험한 이유를 나타내는 액션을 만드십시오."
  },
  {
    value: "organized",
    label: "큰 집단을 이루고, 서로 위험을 알려준다: 조직적",
    tags: ["조직적"],
    reminder: "조직적 — 동료들에게 도움을 청하는 액션을 만드십시오."
  },
  { value: "intelligent", label: "인간을 비롯한 문명 종족과 비슷할 정도로 똑똑하다: 지능적", tags: ["지능적"] },
  { value: "cautious", label: "방패나 그 비슷한 것을 능동적으로 활용하여 몸을 지킨다: 조심스러움, 장갑 +1", tags: ["조심스러움"], armor: 1 },
  { value: "hoarder", label: "인간이 귀중하게 여길 만한 것들을 모은다 (황금, 보석, 비밀): 보물지기", tags: ["보물지기"] },
  {
    value: "planar",
    label: "이 세계 너머 다른 곳에서 왔다: 이계",
    tags: ["이계"],
    reminder: "이계 — 이 세계의 것이 아닌 지식과 능력을 사용하는 액션을 만드십시오."
  },
  { value: "resilient", label: "생물로서의 생명보다 더 끈질긴 무언가를 갖고 있다: HP +4", hp: 4 },
  {
    value: "construct",
    label: "누군가에 의해 만들어졌다: 인공물",
    tags: ["인공물"],
    reminder: "인공물 — 그 제작 방식이나 목적에 관한 특기사항을 한두 개 쓰십시오."
  },
  {
    value: "horrific",
    label: "외모가 괴이하거나, 무섭거나, 끔찍하다: 끔찍함",
    tags: ["끔찍함"],
    reminder: "끔찍함 — 왜 그렇게 무시무시한지 특기사항에 기록하십시오."
  },
  { value: "amorphous", label: "오장육부도 없고, 신체 구조라고 할 만한 것이 없다: 부정형, +1 장갑, HP +3", tags: ["부정형"], armor: 1, hp: 3 },
  { value: "ancient", label: "인간, 엘프, 드워프보다 오래된 존재이거나, 그런 오래된 종족에 속한다: 피해 주사위를 한 단계 높입니다", dieStep: 1 },
  { value: "peaceful", label: "폭력을 싫어한다: 피해를 두 번 굴리고 더 낮은 쪽을 취합니다", rollMode: "disadvantage" }
];

// 보물: 괴물의 피해 주사위를 굴리고(태그에 따라 조정), 그 결과를 아래 표에서
// 찾는다. formula가 있으면 그 값을 실제로 굴려 text에 대입한다. rollAgain이면
// 이 결과 외에 표를 한 번 더 굴린다. composite는 한 항목에서 여러 번 굴려야
// 하는 경우(18번)를 위한 것이다.
export const TREASURE_TABLE = [
  { text: "돈 약간.", formula: "2d8", unit: "닢" },
  { text: "현 상황에 유용한 물건 하나." },
  { text: "돈 조금.", formula: "4d10", unit: "닢" },
  { text: "작지만 값비싼 물건 하나 (보석, 미술품 등).", formula: "2d10*10", unit: "닢", weight: "0" },
  { text: "사소한 마법 물품." },
  { text: "중요한 정보 (단서, 지도 등)." },
  { text: "돈 주머니.", formula: "1d4*100", unit: "닢" },
  { text: "아주 비싸고 작은 물건 하나 (보석, 미술품 등).", formula: "2d6*100", unit: "닢", weight: "0" },
  { text: "돈과 기타 소형 귀중품이 든 상자.", formula: "3d6*100", unit: "닢", weight: "1" },
  { text: "마법 물품 또는 마법적 효과." },
  { text: "돈 주머니 여럿.", formula: "2d4*100", unit: "닢" },
  { text: "지위나 직책의 상징 (왕관, 깃발 등).", formula: "3d4*100", unit: "닢" },
  { text: "대형 미술품.", formula: "4d4*100", unit: "닢", weight: "1" },
  { text: "적어도 아래 금액에 상당하는 독특한 물건.", formula: "5d4*100", unit: "닢" },
  { text: "새로운 주문을 하나 배우는 데 필요한 정보 일체.", rollAgain: true },
  { text: "비밀문이나 통로, 또는 그런 곳에 관한 정보.", rollAgain: true },
  { text: "주인공들 중 한 명에 관계된 것.", rollAgain: true },
  {
    text: "보물더미.",
    composite: [
      { formula: "1d10*1000", unit: "닢" },
      { formula: "1d10*10", unit: "개(각각 2d6×100 닢 가치의 보석)" }
    ]
  }
];
