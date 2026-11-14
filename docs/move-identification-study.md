# 액션 식별 방식 조사 보고서

- 작성일: 2026-11-14
- 대상: `dw-automation` `main`(커밋 `953c82d`, 운영본 0.117.x와 같은 코드)
- 환경: Foundry 14.370, 던전월드 시스템 1.10.0, Babele 2.9.1, dungeonworld-ko
- 성격: 조사와 제안만 담았습니다. 코드는 바꾸지 않았습니다.

## 0. 결론 먼저

**추천: Babele가 남기는 원문 영어 이름(`flags.babele.originalName`)을 1순위로 쓰고, 지금의 이름 목록은 그대로 두어 대체 수단으로 쓰는 "이중 매칭" 방식.**

1. 레벨업과 기본 액션 추가 때 시스템이 컴펜디엄 문서를 `foundry.utils.duplicate()`로 통째로 복사합니다. 그래서 Babele가 컴펜디엄 문서에 넣은 `flags.babele.originalName`(예: `"Iron Hide"`)이 캐릭터 아이템에도 따라갈 가능성이 큽니다. 이 값은 번역과 상관없는 원본 컴펜디엄 이름입니다.
2. 이름 목록 설정의 **기본값이 이미 영문 원문**입니다(`ironHideMoveNames` 기본값 `"Iron Hide"`). 따라서 번역 자동 채우기를 하지 않아도 기본값이 그대로 맞습니다. 설정 형식, 저장값, 홈브루 API는 바뀌지 않고 판별 조건 하나만 늘어납니다.
3. 플래그가 없는 아이템(손으로 만든 아이템, 홈브루, 옛 캐릭터)은 지금처럼 이름으로 찾습니다. 그래서 **지금보다 나빠지는 경우가 없고**, 마이그레이션도 필요 없습니다.

**전제 조건(확인 필요)**: DW02 캐릭터 아이템에 이 플래그가 실제로 있는지 실측하지 못했습니다. 월드 조회를 두 번 시도했지만 로그인 화면에서 시간 초과로 실패했습니다. 구현 전에 9장의 콘솔 코드로 먼저 확인해야 합니다.

---

## 1. 지금 액션을 알아보는 방식

`ARCHITECTURE.md` 2장의 원칙대로, 이 모듈은 아래 네 가지로만 분기합니다. 그중 **"이 아이템이 무슨 액션인가"를 정하는 수단은 사실상 1번(이름) 하나뿐**입니다.

1. GM이 관리하는 이름 목록 설정 (`actor.items.find(i => names.includes(i.name))`)
2. 선택지 위치(인덱스) 설정
3. 주사위 표기
4. 채팅 카드 마크업 구조(`data-roll-total`, `.row.result.success`)

2~4번은 "어떤 결과가 나왔나"를 읽는 데 쓰고, "어떤 액션인가"는 모두 이름으로 정합니다.

### 1.1 흐름은 두 갈래

| 흐름 | 진입점 | 액션을 정하는 방법 |
|---|---|---|
| 굴림 **전** 개입 | `lib/roll-wrapper.js`의 `wrappedRoll` (libWrapper로 `ItemDw.prototype.roll`을 감쌈) | `this`가 아이템 객체입니다. `item.name`을 이름 목록과 비교합니다 |
| 굴림 **후** 처리 | `Hooks.on("createChatMessage")` 53곳 → `lib/move-card.js`의 `getMoveCardInfo()` | 카드 제목 글자(`.cell__title`)를 이름 목록과 비교한 뒤 `findMoveItem(actor, title)`로 **같은 이름의** 아이템을 찾습니다 |
| 시트 표시 | `Hooks.on("renderActorSheet")` 38곳 | 액터 아이템을 이름 목록으로 찾습니다 |

**던전월드 1.10.0 소스 근거** (`module/rolls.js`, `templates/chat/chat-move.html`):
- 카드 제목은 `templateData.title = this.item.name`입니다. 그래서 "카드 제목 = 아이템 이름"은 항상 성립합니다.
- 채팅 메시지(`chatData`)에는 `user`, `speaker`, `content`, `whisper`만 있습니다. **아이템 ID, UUID, 플래그는 없습니다.** 카드 HTML에도 `data-actor-id`, `data-token-id`, `data-roll-total`만 있습니다.
- 그래서 굴림 후 처리는 지금 구조로는 이름 말고 아이템을 알아낼 방법이 없습니다(대안은 4.6절).

### 1.2 판별 코드 집계

`grep`으로 셌습니다(같은 줄이 두 항목에 겹칠 수 있습니다).

| 종류 | 위치 | 개수 |
|---|---|---|
| 이름 목록 설정 키 (`*_MOVE_NAMES` 등) | `constants.js`, `settings.js` | **121개** (`_NAMES` 117개, 단수 `_NAME` 4개: `FIRST_AID_SPELL_NAME`, `GREATER_FIRST_AID_SPELL_NAME`, `RANGER_ELF_MOVE_NAME`, `RANGER_HUMAN_MOVE_NAME`) |
| 이름을 행 키로 쓰는 표 설정 | `data/*.js` + `apps/*.js` | **17개** (`SPECIAL_ATTACK_MOVES`, `ONGOING_SPELLS`, `HIT_TRIGGER_MOVES`, `HEALING_MOVES`, `HOSPITALLER_MOVES`, `MOVE_UPGRADES`, `DAMAGE_REDUCTION_MOVES`, `CONDITIONAL_DAMAGE_MOVES`, `CONDITIONAL_TAG_MOVES`, `DRUID_DAMAGE_DIE_MOVES`, `CLASS_GRANT_MOVES`, `PREPARE_SPELLS_MOVES`, `ONGOING_PENALTY_REDUCTION_MOVES`, `EMPOWER_MOVES`, `HOLD_GRANT_MOVES`, `SELF_FORWARD_MOVES`, `SPELL_DAMAGE_MOVES`) |
| 파일마다 복사된 `splitCommaList` | `features/*.js` 등 | **69개 파일** |
| 아이템 이름 비교 (`names.includes(i.name)`, `.name ===`) | 53개 파일 | 약 **78줄 + 49줄** |
| 카드 제목과 이름 목록 비교 (`includes(title)` 등) | 57개 파일 | **64줄** |
| `getMoveCardInfo` 사용 | `features`, `lib` | **55개 파일** |
| `findMoveItem`(카드 제목 → 같은 이름 아이템) 사용 | | **42개 파일** |
| 실행 중 영문→한글 번역표 확인 (`nameMap.get("Bolster") === title` 같은 대체 경로) | `getMoveNameMap` 사용 40개 파일 | **30곳** |
| 컴펜디엄에서 이름으로 문서 찾기 | `twice-as-bright.js` `findMoveDocumentByName`, `lib/race-core-compendium.js`, `class-grant.js` | 3개 파일 |
| **Babele 원문 이름 사용** | `features/class-grant.js` `canonicalMoveName(doc)` (컴펜디엄 문서에만 사용) | **1곳** |
| 컴펜디엄 `_id` / `sourceId` / `_stats.compendiumSource` | 없음. `data/attack-moves.js` 주석에 "캐릭터마다 `_id`가 달라 포기"라고 적혀 있음 | **0곳** |
| 아이템에 붙인 모듈 플래그 | 없음. 모듈 플래그는 전부 액터 상태용(`flags.dw-automation.defendReserve` 등) | **0곳** |
| 모듈이 직접 아이템을 만드는 곳 (`createEmbeddedDocuments("Item")`) | `class-grant`, `cleric-dwarf`, `cross-class-spell`, `wizard-elf`, `race-core`, `spellbook-expansion`, `twice-as-bright`, `level-up-info`, `burning-brand`, `lib/poison-item` | **10곳** |
| 이름 변경을 뒤따라 고치는 마이그레이션 | `lib/legacy-name-fixes.js` (`"시그라지는 인언" → "사그라지는 인연"`) | 1건 |

액션이 아닌 아이템:
- 장비: 이름이 아니라 `type === "equipment"`와 태그 문자열(`/ammo/i.test(system.tagsString)`)로 찾습니다. 태그는 번역되지 않아 이미 튼튼합니다.
- 주문: `FIRST_AID_SPELL_NAME` 등 이름 설정을 씁니다.

### 1.3 이름 방식이 실제로 일으킨 문제 (ARCHITECTURE.md 6장 기록)

- 어퍼스트로피(’)와 작은따옴표(') 차이로 번역 자동 채우기가 몇 달간 실패했습니다(v0.111.1).
- 한글화 쪽 오타를 고치자 저장된 설정과 아이템 이름이 어긋났습니다(`legacy-name-fixes.js`).
- 무브 업그레이드로 이름이 바뀌면 기능이 조용히 멈췄습니다(논리적→매우 논리적).
- 클레릭과 팔라딘이 같은 이름 "Divine Protection"을 씁니다(`AMBIGUOUS_NAME_BY_LINK`).
- 기본값 추가 때마다 마이그레이션 함수가 필요합니다(`migrateAddSurveyedDefaults` 계열).

---

## 2. 바탕 사실 (소스 근거)

### 2.1 시스템이 캐릭터에 액션을 넣는 방법 — 던전월드 1.10.0

| 경로 | 코드 | 복사 방법 |
|---|---|---|
| 레벨업, 캐릭터 생성 대화창 | `module/actor/actor-sheet.js` 919–1034행 | `new_moves = moves.map(m => foundry.utils.duplicate(m))` → `createEmbeddedDocuments('Item', new_moves)` |
| 새 캐릭터 기본 액션 | `module/dungeonworld.js` 447–507행 | `moves.map(m => foundry.utils.duplicate(m))` |
| 컴펜디엄 읽기 | `module/utility.js` `loadCompendia()` | `pack.getDocuments()` |

`foundry.utils.duplicate(doc)`는 문서를 JSON으로 바꿨다가 다시 읽는 방식이라, 원본 데이터의 `flags`가 **통째로** 복사됩니다. `_id`는 새로 만들어지고(`keepId` 없음), `_stats.compendiumSource`는 채워지지 않습니다. 그래서 지금까지 "ID 기반 인식은 불가능"이라는 판단은 맞습니다.

### 2.2 Babele가 번역할 때 하는 일 — Babele 2.9.1 (Foundry 13~14 지원)

- `module/script/foundry/wrapper.js` 11행: `CONFIG.DatabaseBackend._getDocuments`를 감싸서, 컴펜디엄 문서를 **DB에서 꺼내는 시점에** 번역합니다. 즉 번역 결과가 문서의 원본 데이터(`_source`)에 들어갑니다.
- `module/script/translation/document-translation.js` 72–94행: 번역할 때 `flags.babele = { translated, hasTranslation, originalName: <원래 이름>, lang, originalPayload? }`를 붙입니다.
- `module/script/actor/actor-translation.js`: Babele는 **월드 액터의 아이템**에도 이 플래그를 직접 씁니다. 지우는 것은 "번역 되돌리기"(`#rollbackUpdateFor`, `"flags.-=babele"`)를 할 때뿐입니다. 즉 Babele 스스로 이 플래그를 액터 아이템의 정상 데이터로 다룹니다.
- `module/script/converter/document-converter.js` 484행: Babele 자신도 `flags.babele.originalName`으로 원본 문서를 찾습니다.

### 2.3 한글화 모듈 (`Nomal-1/t2`, 공개 raw 파일로 확인)

- `module.json`: `babele`를 필수 모듈로 둡니다.
- `compendium/dungeonworld.the-cleric-moves.json`: 항목 키가 **영문 원본 이름**입니다(`"Anointed" → "기름으로 바른 자"`). 매핑 대상은 `name`, `system.description`, `system.moveResults.*.value`, `system.choices`뿐입니다.
- 따라서 `system.class`, `system.moveType`, `system.requiresLevel`, `system.requiresMove`, `system.rollType`은 **번역되지 않습니다.**

### 2.4 2.1~2.3을 합치면

"번역된 컴펜디엄 문서 → `duplicate` → 캐릭터 아이템" 경로라면, 캐릭터 아이템에 `flags.babele.originalName = "Iron Hide"`처럼 원문 영문 이름이 남아야 합니다. **이론상 근거는 탄탄하지만, DW02 실데이터로는 아직 확인하지 못했습니다(9장).**

---

## 3. 대안 비교

| | A. 지금 방식 유지 | B. 모듈 플래그 (`flags.dw-automation.moveKey`) | C. `system.*` 필드 | **D. Babele 원문 이름 + 이름 목록 대체 (추천)** | E. 시트에서 "자동화 종류" 지정 UI |
|---|---|---|---|---|---|
| 번역 내성 | 낮음(번역명을 목록에 채워야 함) | 높음 | 해당 필드는 높음 | 높음 | 높음 |
| 이름 바뀜·오타 내성 | 낮음 | 높음 | — | 높음(컴펜디엄 원문 기준) | 높음 |
| 액션 하나를 콕 집어 식별 | 가능 | 가능 | **불가**(고유 키 없음) | 가능 | 가능 |
| 기존 월드 마이그레이션 | 없음 | **필요**(모든 캐릭터 아이템에 키를 붙여야 함. 결국 처음 한 번은 이름으로 붙임) | 없음 | **없음** | GM이 손으로 지정 |
| 새 아이템 처리 | 그대로 | 생성 훅(`preCreateItem`)에서 매번 키를 붙여야 함 | — | 자동(Babele가 붙임) | GM이 매번 지정 |
| 설정 형식 변경 | 없음 | 138개 설정을 "키" 기준으로 다시 설계해야 함 | — | 없음 | 새 UI와 저장 구조 필요 |
| 홈브루 모듈 영향 | 없음 | API를 키 기준으로 바꾸면 홈브루도 수정 필요 | — | 없음(선택적으로 새 API 사용 가능) | 홈브루도 지원하려면 수정 |
| 구현 규모 | 0 | 매우 큼 | 보조 용도로 작음 | 중간(판별 줄 약 140곳, 대부분 기계적 수정) | 큼 |
| 외부 의존 | 없음 | 없음 | 시스템 데이터 구조 | **Babele 내부 플래그 형식** | 없음 |

### 3.1 A. 지금 방식 유지

- 장점: 일을 안 해도 되고, 지금도 돌아갑니다.
- 단점: 1.3절의 문제가 계속됩니다. 기본값을 추가할 때마다 마이그레이션이 필요하고, 한글화 문구를 고칠 때마다 `legacy-name-fixes.js`가 늘어납니다.

### 3.2 B. 모듈 플래그로 식별 키 부여

- 장점: 가장 확실하고, Babele에 기대지 않습니다. 홈브루 액션도 같은 방식으로 다룰 수 있습니다.
- 단점:
  - 기존 캐릭터 아이템에 키를 붙이려면 처음 한 번은 결국 이름(또는 D의 원문 이름)으로 판별해야 합니다.
  - 새 아이템이 생길 때마다 붙이는 훅이 필요합니다.
  - 121개 이름 목록과 17개 표를 "키" 기준으로 다시 설계해야 하고, 설정 화면도 다시 만들어야 합니다.
  - 플레이어가 아이템을 복제하거나 직접 만들면 키가 빠지거나 잘못 붙을 수 있습니다.
- 마이그레이션: 월드를 열 때 모든 캐릭터 아이템을 돌며 키를 쓰는 작업이 필요합니다. 그 전에 `migration-backup.js`로 백업해야 합니다.
- 결론: D를 먼저 하고, 그래도 부족하면 그다음 단계로 고려할 만합니다.

### 3.3 C. 던전월드 시스템 데이터(`system.*`)

move의 필드는 `choices`, `class`, `description`, `moveGroup`, `moveResults`, `moveType`, `requiresLevel`, `requiresMove`, `rollFormula`, `rollMod`, `rollType`입니다(`template.json`).

- **고유 식별 키가 없어서 단독으로는 쓸 수 없습니다.**
- 다만 `system.class`는 번역되지 않으므로, 이름이 겹칠 때 구분하는 보조 수단으로 좋습니다. 예: "Divine Protection"이 클레릭인지 팔라딘인지. 지금의 `AMBIGUOUS_NAME_BY_LINK` / `resolveAmbiguousBySiblingName` 같은 문맥 추론보다 단순해질 수 있습니다.
- 확인 필요: 실제 캐릭터 아이템의 `system.class` 값이 영문 직업명(`"The Cleric"` 등)인지, 비어 있는 경우는 없는지.

### 3.4 D. Babele 원문 이름 (추천)

판별 조건을 이렇게 바꿉니다(파일마다 로컬 헬퍼로 복사하는 관례를 그대로 따름).

```js
// 개념 예시 — 실제 구현 아님
function itemMatchesNames(item, names) {
  const original = item.flags?.babele?.originalName;
  return names.includes(item.name) || (original != null && names.includes(original));
}
```

- 장점:
  - 설정 기본값(영문)이 그대로 맞아서, **번역 자동 채우기가 없어도 동작**합니다.
  - 한글화 문구를 고쳐도(오타 수정 등) 원문 이름은 그대로라 자동화가 끊기지 않습니다. `legacy-name-fixes.js` 같은 뒤처리가 필요 없어집니다.
  - 원문 이름은 컴펜디엄 원본에서 그대로 오므로, 어퍼스트로피 종류를 사람이 맞출 필요가 줄어듭니다. 다만 설정 기본값은 사람이 입력한 것이라, 비교할 때 ’와 '를 같게 보는 정규화를 넣는 것이 안전합니다.
  - 마이그레이션도, 설정 형식 변경도, 홈브루 수정도 필요 없습니다.
  - ARCHITECTURE.md 2장 원칙("번역된 자유 텍스트로 분기하지 않는다")에 더 가까워집니다. 번역 전 원문으로 분기하기 때문입니다.
- 단점과 한계:
  - 플래그가 없는 아이템이 있습니다. 시트에서 직접 만든 아이템, 홈브루 액션, Babele 도입 전에 만든 캐릭터, "번역 되돌리기"를 한 아이템 등입니다. 이런 아이템은 지금처럼 이름 목록으로 찾으므로 **나빠지지는 않지만 좋아지지도 않습니다.**
  - `flags.babele`은 Babele의 공개 API가 아니라 내부 데이터 형식입니다. 다만 Babele 자신의 UI와 변환기가 이 필드에 기대고 있어 쉽게 바뀌지는 않을 것으로 봅니다.
  - Foundry 12(운영 호환 목표)에서 쓰는 Babele 버전도 같은 플래그를 붙이는지는 **확인 필요**입니다. Babele 2.9.1의 최소 지원은 13입니다. 다만 플래그가 없으면 이름으로 돌아가므로 12에서 깨지지는 않습니다.
- 굴림 후 처리 쪽 변경: 지금은 "카드 제목이 이름 목록에 있나"를 먼저 봅니다. 이것을 "카드 제목으로 아이템 찾기(`findMoveItem`, 그대로 유효) → 그 아이템이 이름 목록에 맞나(`itemMatchesNames`)" 순서로 바꿉니다.

### 3.5 E. 시트에서 "자동화 종류"를 지정하는 UI

- 장점: 홈브루나 손으로 만든 액션까지 GM이 원하는 자동화에 연결할 수 있습니다. 예를 들어 "이 홈브루 액션을 철갑 피부처럼 취급"하는 식입니다.
- 단점: UI, 저장 구조, 키 목록이 모두 새로 필요합니다(B의 저장 방식 + 화면). 손이 많이 갑니다.
- 결론: 기본 경로로는 과합니다. B를 하게 되면 그 위에 얹는 "수동 덮어쓰기"로 의미가 있습니다.

### 3.6 보조 아이디어: 굴림 후 처리에 아이템을 직접 전달

`wrappedRoll`은 아이템 객체를 알고 있습니다. 굴리기 직전에 "이 액터가 지금 굴린 아이템"을 기록해 두고, `preCreateChatMessage` 훅에서 메시지에 `flags.dw-automation.itemId`를 붙이면, 굴림 후 처리가 카드 제목 대신 아이템을 직접 받을 수 있습니다.

- 주의: 시스템의 `rollMove`는 `ChatMessage.create`를 `roll.render().then(...)` 안에서 **기다리지 않고** 부릅니다. 그래서 `wrapped()`가 끝난 뒤에 기록을 지우면 경쟁 상태가 생깁니다. 메시지의 speaker 액터와 카드 제목이 기록과 일치할 때만 쓰는 식의 방어가 필요합니다.
- 카드 제목은 언제나 `item.name`이라 지금 방식도 틀리지는 않습니다. 같은 이름 아이템이 두 개 있는 드문 경우 말고는 이득이 작아서 **우선순위는 낮습니다.**

---

## 4. 한글화·홈브루 모듈에 미치는 영향

### 4.1 dungeonworld-ko (`Nomal-1/t2`)

- D안: 수정할 것이 없습니다. 오히려 한글화 문구를 고칠 때 이 모듈 설정을 같이 맞출 부담이 줄어듭니다.
- B안: 수정할 것은 없지만, 키를 붙이는 기준(최초 판별)은 결국 한글화 이름이나 원문 이름에 의존합니다.

### 4.2 홈브루 모듈 (`Nomal-1/Nomals-dw-homebrew-automation` 0.5.1, 공개 raw 파일로 확인)

- 쓰는 공개 API: `getMoveCardInfo`, `findMoveItem`, `announceInfo`, `announceActionApplied`, `promptActorTarget`, `getOrCreateTagsContainer`. **D안은 이 API들의 동작을 바꾸지 않습니다.**
- 자체 판별: 이름 목록 설정 4개(`guiltyGearMoveNames`, `striveMoveNames`, `guiltyGearMeleeMoveNames`, `guiltyGearDefendMoveNames`)와 하드코딩 이름 비교 약 17줄(`guilty-gear-core.js`, `guilty-gear-attacks.js`, `guilty-gear-defense.js`).
- 홈브루 액션은 자체 데이터(`data/guilty-gear-items.js`)로 만들어서 Babele 플래그가 없습니다. 그래서 D안의 이득을 받지 못하고 지금처럼 이름으로 동작합니다.
- 홈브루가 튼튼해지려면, 홈브루 쪽에서 아이템을 만들 때 자기 모듈 플래그(B 방식)를 붙이는 편이 맞습니다. 직접 만드는 아이템이라 비용이 작습니다. 다만 이건 별도 작업입니다.
- 선택 사항: `public-api.js`에 `getCanonicalMoveName(item)` / `itemMatchesNames(item, names)`를 추가하면 홈브루도 같은 규칙을 쓸 수 있습니다. ARCHITECTURE.md 9장 목록도 같이 갱신해야 합니다.
- 홈브루 저장소 전체는 이 세션에 붙어 있지 않습니다. `main.js`에서 import로 이어지는 파일 11개만 raw URL로 읽었습니다. 앱/메뉴 파일 등 나머지는 보지 못했습니다.

---

## 5. 추천안(D) 구현 시 바꿀 곳

| 위치 | 내용 | 개수(추정) |
|---|---|---|
| 각 `features/*.js`의 `findXMove` 류 (`names.includes(i.name)`) | `itemMatchesNames(i, names)`로 교체 | 약 78줄 |
| 굴림 후 처리의 카드 제목 비교 (`includes(title)` + `nameMap.get("…") === title`) | "아이템 찾기 → 아이템 판별" 순서로 바꾸기 | 64줄 + 30곳 |
| `lib/roll-wrapper.js` (`isCastSpellMove` 등) | 같은 교체 | 몇 곳 |
| 표 설정 행 매칭 (`HIT_TRIGGER_MOVES` 등 17개 표의 이름 비교) | 같은 교체 | 표마다 1~3곳 |
| 로컬 헬퍼 복사 | 기존 `splitCommaList`처럼 파일마다 복사(ARCHITECTURE.md 5장 관례) | 약 70개 파일 |
| `lib/public-api.js` + ARCHITECTURE.md 9장 | 선택: 새 함수 노출 | 1~2곳 |
| ’ / ' 정규화 | 헬퍼 안에서 처리 | 헬퍼당 1줄 |

**합계: 판별 코드 약 140곳, 약 70개 파일.** 대부분 같은 모양의 기계적 수정입니다. 설정 형식, 저장값, 마이그레이션은 바뀌지 않습니다.

바꾸지 않아도 되는 것:
- `getMoveCardInfo`, `findMoveItem`(카드 제목 = 아이템 이름은 시스템이 보장)
- 장비 태그 판별
- 선택지 인덱스와 주사위 표기 파싱

권장 진행 순서:
1. 9장의 확인을 먼저 합니다.
2. 자주 쓰는 기능 몇 개(예: 철갑 피부, 공격 보조)에만 시범 적용하고 한 세션 써 봅니다.
3. 나머지로 넓힙니다.

이렇게 하면 문제가 생겨도 되돌리기 쉽습니다.

---

## 6. 위험

1. **플래그가 실제로 없을 수 있음(가장 큰 위험).** 실측하지 못했습니다. 특히 오래전(Foundry 12, 옛 Babele)에 만든 캐릭터에는 없을 수 있습니다. 없더라도 이름 방식으로 돌아가니 기능이 깨지지는 않지만, 기대한 효과가 없습니다.
2. **Babele 내부 형식 변경.** 공개 API가 아니라서 Babele 업데이트로 키 이름이 바뀔 수 있습니다. 그래도 이름 방식으로 돌아가므로 조용히 "예전 수준"으로 내려갈 뿐입니다.
3. **같은 원문 이름 문제는 그대로.** "Divine Protection"처럼 직업 사이에 원문 이름이 같으면 원문으로도 구분되지 않습니다. `system.class`로 구분하는 보완이 필요합니다(확인 필요).
4. **GM이 일부러 이름을 바꾼 아이템.** 지금은 이름을 바꾸면 자동화가 꺼집니다. D안에서는 원문 플래그가 남아 계속 켜집니다. 의도와 다를 수 있습니다(드문 경우).
5. **수정 범위가 넓음.** 140곳 안팎을 고치므로 한 곳을 빠뜨리면 그 기능만 예전 방식으로 남습니다. 버그는 아니지만 일관성이 떨어집니다. 단계적으로 진행해야 합니다.

---

## 7. 확인 필요 목록

| 항목 | 이유 | 방법 |
|---|---|---|
| DW02 캐릭터 아이템의 `flags.babele.originalName` 존재 비율 | 추천안의 전제 | 9장 콘솔 코드 |
| 같은 아이템의 `_stats.compendiumSource` / `flags.core.sourceId` 존재 여부 | Foundry 14에서 드래그로 넣은 아이템은 다를 수 있음 | 9장 콘솔 코드 |
| 시트에 직접 끌어다 놓은 아이템(드래그)에도 플래그가 남는지 | 레벨업 경로 외의 경로 | 테스트 캐릭터에 하나 끌어다 놓고 확인 |
| Foundry 12용 Babele도 같은 플래그를 붙이는지 | 12 호환 유지 | 12 테스트 월드 또는 Babele 옛 태그 소스 확인 |
| 캐릭터 아이템의 `system.class` 값 형태 | 이름 겹침 구분용 | 9장 콘솔 코드 |

---

## 8. 조사 방법과 출처

- 이 저장소: `ARCHITECTURE.md`, `README.md`, `scripts/` 전체를 `grep`으로 집계하고 주요 파일을 직접 읽었습니다.
- 던전월드 1.10.0: 공식 배포 zip(`asacolips-artifacts.s3.amazonaws.com/dungeonworld/1.10.0/dungeonworld.zip`, 매니페스트 compatibility 14 / verified 14.369)을 받아 `module/rolls.js`, `module/actor/actor-sheet.js`, `module/dungeonworld.js`, `module/utility.js`, `templates/chat/chat-move.html`, `template.json`을 읽었습니다.
- Babele 2.9.1: GitLab `riccisi/foundryvtt-babele` 태그 2.9.1 소스 아카이브를 읽었습니다.
- dungeonworld-ko: `raw.githubusercontent.com/Nomal-1/t2/master/` 의 `module.json`, `compendium/dungeonworld.the-cleric-moves.json`.
- 홈브루 모듈: `raw.githubusercontent.com/Nomal-1/Nomals-dw-homebrew-automation/main/` 의 `module.json`, `scripts/main.js`와 거기서 import하는 파일들.
- DW02 실측: `dw02-fvtt` 스킬로 읽기 전용 조회를 2회 시도했습니다. 서버 상태 확인(DW02 / dungeonworld 1.10.0 / Foundry 14.370 / 접속자 0)은 됐지만, 로그인 화면(`select[name=userid]`)이 뜨지 않아 시간 초과로 실패했습니다. 아무것도 수정하지 않았습니다.

---

## 9. 구현 전 확인용 콘솔 코드 (GM이 F12 콘솔에 붙여 넣기, 읽기 전용)

```js
const rows = {};
for (const a of game.actors.filter(a => a.type === "character")) {
  for (const i of a.items) {
    if (!["move", "spell"].includes(i.type)) continue;
    const s = i._source, r = rows[i.type] ??= { total: 0, babele: 0, compSrc: 0, coreSrc: 0, classSet: 0 };
    r.total++;
    if (s.flags?.babele?.originalName) r.babele++;
    if (s._stats?.compendiumSource) r.compSrc++;
    if (s.flags?.core?.sourceId) r.coreSrc++;
    if (s.system?.class) r.classSet++;
  }
}
console.table(rows);
console.log(game.actors.find(a => a.type === "character")?.items
  .filter(i => i.type === "move").slice(0, 10)
  .map(i => [i.name, i.flags?.babele?.originalName, i.system?.class]));
```

`babele` 숫자가 `total`에 가까우면 추천안이 그대로 성립합니다. 0에 가까우면 B안(모듈 플래그)을 다시 검토해야 하고, 그때도 첫 키 부여는 지금 이름 목록으로 합니다.
