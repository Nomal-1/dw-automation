// 8개 기본 직업(야만전사/음유시인/사제/드루이드/팔라딘/도적/마법사/사냥꾼)과
// 전사(자동화 대상인 드워프/하플링만 우선 추가, 엘프/인간은 자동화 요청이
// 없어 텍스트만 있음)의 클래스 아이템(races 필드) 원문을 그대로 옮긴 종족
// 핵심 액션 데이터.
// 던전월드 공식 컴펜디엄에는 이 텍스트가 별도 무브 아이템으로 존재하지
// 않아(클래스 시트의 races 항목은 그냥 설명 텍스트일 뿐) 번역 컴펜디엄(t2)
// 에서 가져올 수도 없으므로, 이 모듈이 직접 한국어 텍스트를 들고 있는다.
// 종족 핵심 액션 컴펜디엄 생성(lib/race-core-compendium.js)과 레인저
// 하프엘프 자동화(features/race-core.js)가 공통으로 이 표를 쓴다.
export const RACE_CORE_MOVES = {
  barbarian: {
    className: "야만전사",
    officialClassName: "The Barbarian",
    races: [
      {
        key: "outsider",
        name: "야만전사-이방인",
        description:
          "<p>엘프, 드워프, 하플링, 또는 인간일 수 있지만, 당신과 당신의 종족은 이곳 출신이 아닙니다. 매 세션이 시작될 때마다 마스터가 당신의 고향, 왜 그곳을 떠났는지, 또는 무엇을 남겨두고 왔는지에 대해 물어볼 것입니다. 대답하면 경험치 1을 얻습니다.</p>"
      }
    ]
  },
  bard: {
    className: "음유시인",
    officialClassName: "The Bard",
    races: [
      {
        key: "elf",
        name: "음유시인-엘프",
        description:
          "<p>(플레이어가 생각하기에) 중요한 장소에 왔을 때, 마스터에게 그 장소에 관한 역사적 사실 하나를 요청할 수 있습니다.</p>"
      },
      {
        key: "human",
        name: "음유시인-인간",
        description:
          "<p>처음 찾아간 주거지에서, 악사에게 친절을 베푸는 풍습을 중요시하는 사람이 나타나 손님으로 초대합니다.</p>"
      }
    ]
  },
  cleric: {
    className: "사제",
    officialClassName: "The Cleric",
    races: [
      {
        key: "dwarf",
        name: "사제-드워프",
        description:
          "<p>드워프 사제는 돌에 매우 친숙합니다. 돌에 대해서만 쓸 수 있는 목석의 말이 암송주문으로서 추가됩니다.</p>"
      },
      {
        key: "human",
        name: "사제-인간",
        description:
          "<p>인간 사제는 신앙의 폭이 넓습니다. 마법사 주문을 하나 고르십시오. 그 주문은 마치 사제 주문인 것처럼 사용할 수 있습니다.</p>"
      }
    ]
  },
  druid: {
    className: "드루이드",
    officialClassName: "The Druid",
    races: [
      {
        key: "elf",
        name: "드루이드-엘프",
        description:
          "<p>옛 나무들의 수액이 혈관에 흐르고 있습니다. 어느 땅과 결연되어 있건, 엘프 드루이드에게 있어서 거대한 숲은 항상 자기의 땅입니다.</p>"
      },
      {
        key: "human",
        name: "드루이드-인간",
        description:
          "<p>인류는 밭과 외양간을 통해서 동물과 친해졌습니다. 인간 드루이드는 다른 짐승 형태와 별도로 가축의 모습으로도 변신할 수 있습니다.</p>"
      },
      {
        key: "halfling",
        name: "드루이드-하플링",
        description:
          "<p>샘과 냇물이 부르는 치유의 노래를 익혔습니다. 야영을 하면 자신과 동료들이 모두 +1d6만큼 더 치유됩니다.</p>"
      }
    ]
  },
  paladin: {
    className: "팔라딘",
    officialClassName: "The Paladin",
    races: [
      {
        key: "human",
        name: "팔라딘-인간",
        description:
          "<p>아주 잠시라도 신에게 인도해 달라고 기원하면, 주변에 악한 것이 있는지, 있다면 무엇인지를 알 수 있습니다. 마스터가 정직하게 가르쳐 줄 것입니다.</p>"
      }
    ]
  },
  thief: {
    className: "도적",
    officialClassName: "The Thief",
    races: [
      {
        key: "halfling",
        name: "도적-하플링",
        description: "<p>원거리 무기로 공격할 때 피해를 +2 더 줍니다.</p>"
      },
      {
        key: "human",
        name: "도적-인간",
        description:
          "<p>범죄계에 익숙합니다. 범죄 활동에 관해 지식 더듬기나 상황 파악을 할 때 +1을 받습니다.</p>"
      }
    ]
  },
  wizard: {
    className: "마법사",
    officialClassName: "The Wizard",
    races: [
      {
        key: "elf",
        name: "마법사-엘프",
        description: "<p>마법을 마치 숨 쉬는 것처럼 자연스럽게 느낍니다. 마법 탐지가 간편주문이 됩니다.</p>"
      },
      {
        key: "human",
        name: "마법사-인간",
        description:
          "<p>사제 주문을 하나 선택하십시오. 이 주문은 마치 마법사 주문인 것처럼 사용할 수 있습니다.</p>"
      }
    ]
  },
  ranger: {
    className: "사냥꾼",
    officialClassName: "The Ranger",
    races: [
      {
        key: "elf",
        name: "사냥꾼-엘프",
        description: "<p>험난한 여정을 떠날 때, 어떤 역할을 맡건 10+인 것처럼 성공합니다.</p>"
      },
      {
        key: "human",
        name: "사냥꾼-인간",
        description: "<p>던전이나 도시에서 야영을 할 때, 식량을 소비하지 않습니다.</p>"
      }
    ]
  },
  fighter: {
    className: "전사",
    officialClassName: "The Fighter",
    races: [
      {
        key: "dwarf",
        name: "전사-드워프",
        description: "<p>누군가와 술을 같이 마시는 동안, 그 사람과 협상을 할 때 +매 대신 +체 판정을 할 수 있습니다.</p>"
      },
      {
        key: "elf",
        name: "전사-엘프",
        description: "<p>무기 하나를 고릅니다. 이 종류의 무기를 쓸 때는 마치 정밀 태그가 붙은 것처럼 다룹니다.</p>"
      },
      {
        key: "halfling",
        name: "전사-하플링",
        description: "<p>작은 몸집을 유리하게 이용하면 위험 돌파 판정에 +1을 받습니다.</p>"
      },
      {
        key: "human",
        name: "전사-인간",
        description: "<p>한 전투에 한 번, 이미 굴려진 피해 주사위를 무시하고 다시 굴릴 수 있습니다(자기 것이든 남의 것이든).</p>"
      }
    ]
  }
};

export const RANGER_RACE_CORE_MOVES = RACE_CORE_MOVES.ranger.races;
