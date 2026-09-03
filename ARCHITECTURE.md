# dw-automation 아키텍처 노트

이 문서는 이 모듈을 계속 만들어오면서 확립된 설계 원칙과 관례를 정리한 것이다.
새 세션(특히 이 저장소를 처음 보는 세션 — 클라우드/모바일에서 이어서 작업하는
경우 포함)이 이 문서만 읽고도 기존 방향성을 잃지 않고 이어갈 수 있게 하는 것이
목적이다. `Nomal's-dw-homebrew-automation`처럼 이 모듈을 필수 모듈로 의존하는
새 모듈을 만들 때도 여기 적힌 관례를 그대로 따라가면 된다.

## 1. 이 모듈이 하는 일

Foundry VTT의 Dungeon World 시스템(`dungeonworld`, asacolips-projects 제작) 위에서
GM의 반복 작업을 자동화하는 모듈이다. 예: 무브 성공 시 데미지 자동 굴림, 지속
주문 페널티 추적, 피격 시 무효화 선택지 제공, 종족 핵심 액션 관리 등. 8개 기본
직업 + 바바리안/이몰레이터(시스템에 같이 딸려오는 확장 직업)의 액션 대부분을
훑어서 자동화했고, 어떤 것을 자동화했는지는 GitHub 릴리스 노트에 직업별로 남아
있다.

필수 의존 모듈: `lib-wrapper`, `dungeonworld-ko`(Nomal-1/t2 — GM의 한글화 모듈).
번역 데이터는 `lib/translation-import.js`가 이 한글화 모듈의 컴펜디엄 번역 파일을
직접 fetch해서 참조한다.

## 2. 절대 원칙: 번역된 자유 텍스트로 로직을 분기하지 않는다

이 프로젝트에서 가장 중요하고, 가장 많이 발목을 잡았던 원칙이다. 이유:

- **액터의 무브/주문 아이템은 컴펜디엄 `_id`나 `sourceId`를 보존하지 않는다**
  (이 환경에서 실측 확인됨 — 같은 무브라도 캐릭터마다 `_id`가 다르게 새로
  생성됨). 그래서 ID 기반 인식은 애초에 불가능하다.
- **GM의 한글화 모듈이 무브 이름뿐 아니라 `system.choices`, `moveResults.*.value`
  같은 서술 텍스트까지 번역한다.** "Choose 2" 같은 영문 키워드로 선택 개수를
  파싱하던 로직, `[[1d6]]` 같은 인라인 롤 브라켓 파싱 등이 번역되면서 전부 깨진
  전례가 있다.
- **어퍼스트로피(’)와 작은따옴표(')가 컴펜디엄마다 뒤섞여 있다.** 이름을 하드코딩할
  때는 반드시 공식 컴펜디엄 원문을 바이트 단위로 확인하고 맞춰야 한다(예:
  "Man’s Best Friend"는 어퍼스트로피, "Kill 'Em All"은 작은따옴표). 이 한 글자
  차이 때문에 번역 자동 채우기가 몇 달째 조용히 실패한 사례가 실제로 있었다
  (v0.111.1에서 수정).

**그래서 이 프로젝트는 항상 다음 중 하나로만 로직을 분기한다:**

1. GM이 직접 관리하는 이름 목록 설정(콤마 구분 문자열, 영문 기본값 + 번역
   자동 채우기 도구로 채움) — `actor.items.find(i => names.includes(i.name))`
2. 선택지 목록의 **위치**(1번째/2번째 등, GM이 숫자로 직접 지정하는 설정) —
   "Choose N" 문구 파싱은 절대 쓰지 않는다
3. 주사위 표기(`\d+d\d+`) — 언어와 무관하게 항상 같은 형태
4. 채팅 카드의 구조적 속성(`data-roll-total`, `.row.result.success` 같은
   CSS 클래스) — 텍스트가 아니라 마크업 구조를 읽는다

새 자동화를 만들 때 "이 문구가 있으면/없으면"으로 판단하고 싶어지는 순간이
오면, 반드시 위 네 가지 중 하나로 바꿔서 만들어야 한다.

## 3. 파일 구조 관례

```
scripts/
  main.js            모든 feature의 import + 등록. init 훅에서 registerSettings(),
                      ready 훅에서 game.dungeonworld가 필요한 것(예: roll-wrapper)
                      만 등록하고, 나머지는 파일 하단에 flat하게 register*Assistant() 나열
  constants.js        MODULE_ID + SETTINGS 키 레지스트리(문자열 상수)
  settings.js         모든 game.settings.register/registerMenu 호출
  data/*.js           여러 행을 가진 설정의 DEFAULT_* 데이터 테이블
  apps/*.js           표 편집용 FormApplication 메뉴 클래스(add/remove row,
                      reset-defaults 버튼 패턴이 거의 모든 파일에서 동일)
  features/*.js       무브/기믹 하나당 파일 하나. register*Assistant() export +
                      필요하면 다른 파일이 재사용할 prompt*/get* 함수 export
  lib/*.js            여러 feature가 공유하는 엔진(무브 카드 파싱, 선택지 다이얼로그,
                      채팅 알림, 상태 플래그 관리 등)
templates/*.html      apps/*.js 메뉴들의 Handlebars 템플릿
lang/ko.json, en.json 전체 UI 문자열. 한국어가 사실상 1순위 언어(이 GM의 실제
                      플레이 언어)이고, 영어는 매뉴얼 번역이라 한국어만큼 자주
                      점검되지 않는다.
```

새 파일을 추가할 때 이 구조를 그대로 따라가면 된다 — feature 하나 = features 파일
하나, 여러 행을 가지는 공용 표가 필요하면 data + apps + templates 세 파일을 같이
만든다.

## 4. 자주 재사용되는 패턴("모양")

- **이름 매칭 헬퍼**: 거의 모든 features 파일 상단에 `splitCommaList(settingKey)`와
  `findXMove(actor)`가 있다(파일마다 각자 정의 — 공유 유틸로 안 빼는 게 확립된
  관례다, 아래 5번 참고).
- **판정 직전 개입 (ask-based override)**: `promptXPreRoll(item)` 형태 함수가
  `{ statOverride }` 또는 `{ bonus: N }`를 돌려주고, `lib/roll-wrapper.js`의
  `wrappedRoll` 안 체인(`interrogator.statOverride ?? precise.statOverride ?? ...`,
  `preRollBonus` 합산식)에 이어붙인다. 예: 협박, 정밀, 논리적, 익숙한 사냥감.
- **굴림 자체를 가로채는 패턴(roll-bypass)**: 시스템의 2d6 굴림 경로 자체를 타면
  안 되는 무브(헤라클레스의 욕망 — 1d6+1d8, 주문 차단 — 시스템 rollType이
  비어있음)는 `wrappedRoll` 최상단에서 조건 확인 후 직접 처리하고 `undefined`를
  반환해 시스템 굴림을 완전히 건너뛴다.
- **피격 시 무효화 표**(`HIT_TRIGGER_MOVES`): "피해를 대가로 무효화" 계열 무브를
  `{name, effect, grantsForward}` 행으로 관리. `effect`는 armor/debility/
  spellDefense/hold/animalCompanion/ongoingPenalty/fireAid/embracePain 중 하나.
  새 효과 타입이 필요하면 이 표에 새 effect 값을 추가하고 `features/hit-trigger.js`의
  `usable` 필터 + dispatch 분기에 한 쌍을 추가한다.
- **클래스 부여**(`CLASS_GRANT_MOVES`): "발동하면 다른 직업 무브를 그대로 얻는다"
  (신의 은혜, 황무지의 신 등). `mode: "fixed"`(정해진 무브 부여) 또는
  `mode: "choice"`(직업+무브를 골라서 부여, 멀티클래스 초급/숙련 등).
- **메모형 무브**(`NOTE_MOVE_NAMES`): 신의 이름, 퀘스트 내용, 동반 동물 특징처럼
  자유 서술이 필요한 무브. 발동하면 캐릭터 시트에 그 무브 이름을 딴 탭 + 자유
  메모란이 생긴다.
- **무브 업그레이드**(`MOVE_UPGRADES`): 상급 무브를 배우면 그 전 단계 무브를
  자동 삭제(`deletesPrevious: true`) 또는 유지("필요" 관계, `false`). **이 자동
  삭제 때문에, 어떤 기능이 "기본 무브 이름"만 검색하면 캐릭터가 업그레이드한
  순간 그 기능이 조용히 멈춘다.** 새 기능을 만들 때 대상 무브에 알려진
  업그레이드가 있으면(`data/move-upgrades.js` 확인), `findXMove`가 업그레이드된
  이름도 같이 검색하도록 만들어야 한다(실제로 이 패턴을 놓쳐서 버그가 났던 적
  여러 번).
- **마이그레이션**: 배열/문자열 타입 설정에 새 기본값을 추가해도, 이미 그 설정을
  한 번이라도 저장한 GM 세계에는 반영되지 않는다(`game.settings`의 default는
  한 번도 저장 안 된 설정에만 적용됨). 그래서 새 기본값을 추가할 때마다
  `migrateAddSurveyedDefaults()`류 함수를 만들어 `Hooks.once("ready", ...)`에서
  실행하고, 이미 저장된 표에 없는 이름만 골라 추가한다. 이름 비교는 번역 여부와
  무관하게 정확해야 하므로 `getMoveNameMap()`으로 영문→번역 매핑을 확인한다.
- **번역 인식 표시/정렬**(`lib/move-class-lookup.js`): 여러 직업이 한 표에 섞인
  설정 메뉴에서 "이 행이 어느 직업 것인지" 배지로 보여줄 때, 저장된 이름이
  영문 기본값이든 이미 번역된 한글이든 상관없이 동작하도록 `getMoveNameMap()`을
  뒤집어(한글→영문) 역조회한다.
- **설정 화면 탭**(`lib/settings-tabs.js`): `renderSettingsConfig` 훅으로 기존
  플랫 목록을 직업별/카테고리별 탭으로 재배치한다. 순수 DOM 재배치라 설정 키/
  저장값을 전혀 안 건드리므로, 안 좋아 보이면 이 파일과 등록 한 줄만 지우면
  완전히 원상복구된다. 분류표는 `data/settings-categories.js`.

## 5. 의도적으로 "중복"인 것들

여러 features 파일에 `splitCommaList`가 똑같이 복붙되어 있다. 공유 유틸로
추출하지 않은 것은 실수가 아니라 의도다 — 각 파일이 자기 안에서 완결되어 있으면
파일 하나만 보고 그 기능 전체를 이해할 수 있고, 삭제할 때도 그 파일만 지우면
끝난다. 새 기능을 추가할 때도 이 관례를 따라 로컬 헬퍼를 그대로 복붙하는 게
맞다 — 억지로 공유 모듈로 리팩터링하지 말 것.

## 6. 겪었던 버그 패턴 (다시 반복하지 않기 위한 기록)

- **어퍼스트로피 불일치**로 번역 자동 채우기가 조용히 실패 (v0.111.1). 이름을
  하드코딩하기 전에 항상 공식 컴펜디엄 원문을 바이트 단위로 확인할 것.
- **무브 업그레이드로 인한 조용한 기능 정지**: 논리적→매우 논리적, 익숙한
  사냥감→사냥의 지식 등 업그레이드되면 기존 이름 검색이 실패. `findXMove`가
  업그레이드된 이름도 fallback으로 검색하게 만들 것.
- **던전월드 시스템 자체의 결함**: `actor-sheet.js`가 주문을 `{0,1,3,5,7,9}` 6개
  고정 키로만 분류해서, 그 외 레벨 값이 저장되면 캐릭터 시트 자체가 깨진다(실제
  사고 발생, 캐릭터 삭제까지 감). `features/spell-level-guard.js`가 저장 자체를
  막는 예방적 안전장치. 시스템 코드를 직접 고치는 건 유지보수 부담이 커서
  피했다.
- **한글 번역 텍스트에 영문 키워드가 없음**: `parseHoldAmount`가 `/hold\s+(\d+)/i`
  로만 찾다가 한글화 모듈이 "Hold N"을 "예비 N점을 받습니다"로 번역해서 오랫동안
  Hold 관련 자동화 전체가 0을 반환했던 적이 있다(v0.108.0에서 발견/수정). 텍스트
  파싱이 꼭 필요하면 번역된 키워드도 같이 매칭하게 만들 것(`/(?:hold|예비)/i`).
- **설정 표 안 이름 중복/모호성**: "Divine Protection"을 클레릭과 팔라딘이 똑같이
  쓴다(원작 자체가 그렇다) — `linkedMoveName` 유무나 `resolveAmbiguousBySiblingName`
  같은 문맥 기반 구분이 필요했다. 이름이 겹칠 수 있다는 걸 항상 의심할 것.
- **한국어 조사 문법**: 한글 텍스트를 자동으로 치환할 때(예: "무브"→"액션",
  "레인저"→"사냥꾼") 받침 유무에 따라 조사(을/를, 은/는, 이/가, 으로/로, 과/와,
  이라/라)가 달라진다. 단순 문자열 치환 전에 반드시 조사가 붙은 형태까지
  확인하고 별도 규칙으로 처리할 것.

## 7. 릴리스 절차

1. `module.json`의 `version` 올리기
2. 관련 파일만 `git add`(절대 `-A`/`.` 쓰지 않음) → 영문 커밋 메시지로 커밋 →
   `git push origin main`
3. PowerShell: `Compress-Archive -Path @('module.json','scripts','styles','lang','templates','README.md') -DestinationPath "$env:TEMP\module.zip" -Force`
4. `git tag vX.Y.Z && git push origin vX.Y.Z`
5. `gh release create vX.Y.Z module.json "$TEMP/module.zip" --title vX.Y.Z --notes "..."`
   (릴리스 노트는 한국어로 작성 — 실제 사용자인 GM이 읽는 글)
6. lang 파일을 건드렸다면 커밋 전에 항상
   `python3 -c "import json; json.load(open('lang/ko.json', encoding='utf-8'))"`로
   유효성 검증(이 환경엔 `node`가 없어서 JS 문법 검사는 수동 재확인으로 대체).

## 8. 작업 방식 관례 (사용자와 합의된 것)

- **채팅은 항상 한국어, 코드/커밋 메시지는 영어.**
- 애매하거나 설계가 여러 갈래로 갈리는 지점은 구현부터 하지 않고 먼저 트레이드
  오프를 짧게 설명하고 사용자 결정을 기다린다(`AskUserQuestion` 활용). 특히
  "지금 당장 반영하지 말고 얘기부터 해보자"라는 요청이 나오면 그 즉시 멈추고
  논의만 진행한다.
- 무브/직업 이름은 절대 추측하지 않고 dungeonworld-ko의 실제 컴펜디엄 번역
  데이터(`raw.githubusercontent.com/Nomal-1/t2/master/compendium/*.json`)를
  직접 fetch해서 확인한다. 공식 용어: "무브"가 아니라 **"액션"**(`TYPES.Item.move`
  = "액션"), 직업명은 야만전사/음유시인/사제/드루이드/전사/소각술사/팔라딘/
  사냥꾼/도적/마법사(레인저·클레릭·위저드 같은 음역 표기 쓰지 않음).
- 큰 리팩터(설정 화면 재구성처럼)를 진행할 때 사용자가 "안 좋아 보이면
  롤백한다는 마인드로 가자"고 하면, 되돌리기 쉬운 구조(순수 DOM 재배치처럼
  데이터 형식을 안 건드리는 방식)를 우선한다.

## 9. 다른 모듈이 이 모듈을 의존할 때 (예: Nomal's-dw-homebrew-automation)

커스텀/홈브루 액션 자동화처럼 이 모듈에 의존하는 새 모듈을 만들 때:

- 새 모듈의 `module.json`에 `relationships.requires`로 이 모듈(`dw-automation`)을
  명시한다.
- 이 모듈의 `scripts/lib/*.js` 내부 파일을 새 모듈이 직접 `import`하지 말고,
  `game.modules.get("dw-automation").api`를 통해서만 접근한다. 이 API는
  `scripts/lib/public-api.js`의 `buildPublicApi()`가 만들고, `main.js`의
  `ready` 훅(`registerRollWrapper()` 다음)에서 `game.modules.get(MODULE_ID).api`에
  얹는다. 현재 노출된 함수(전부 `scripts/lib/public-api.js`에서 재확인 가능):
  - `getMoveCardInfo`, `findMoveItem` (무브 카드 파싱)
  - `getMoveChoiceData`, `promptChoiceSelection`, `extractInlineRoll`,
    `extractSignedInlineRoll` (선택지 다이얼로그)
  - `announceActionApplied`, `announceInfo` (채팅 알림)
  - `promptActorTarget`, `promptActorMultiTarget`, `getCandidateActors`
    (대상 선택 다이얼로그)
  - `getMoveNameMap`, `getClassNameMap` (번역 인식 이름 매칭)
  - `setPendingRollBonus`, `getPendingRollBonus`, `clearPendingRollBonus`,
    `rollBonusAppliesTo` ("다음 판정 한 번" 대기 보정치)
  - `getOrCreateTagsContainer` (캐릭터 시트 무브 항목에 배지 붙이기)

  새 함수가 필요하면 `public-api.js`에 추가하고 이 목록도 같이 갱신할 것.
  내부 파일 경로가 바뀌어도 여기 이름·시그니처만 유지하면 의존 모듈이 조용히
  깨지지 않는다.
- 새 모듈도 이 문서에 적힌 파일 구조/패턴/원칙(2번 항목이 특히 중요)을 그대로
  따라간다 — 별도로 다시 발명하지 않는다.
- 새 모듈의 설정 화면은 이 모듈과 분리된 자기 자신의 설정 목록을 가진다(커스텀
  액션이 dw-automation의 방금 정리한 설정 화면에 다시 섞여 들어가지 않게).
