# 8개 기본 직업 패시브/액션 자동화 분류

던전월드 8개 기본 클래스(파이터/클레릭/시프/위저드/레인저/팔라딘/바드/드루이드)의 시작 무브 + 2/6레벨 어드밴스드 무브, 총 192개를 전수 조사한 분류표. 소스: `dungeonworld-system` 1.8.2 태그, `packs/the-*-moves`.

## 분류 기준 (4가지 자동화 패턴 + 범위 밖)

사용자가 처음 제시한 3가지(선택지 프롬프트 / 조건부 확인 / 자동 수치 반영)에 더해, 무브 데이터 구조를 실제로 까보니 **하나 더** 발견됨 — Hold 자동 설정.

- **[A] 선택지 프롬프트**: 굴림 결과에 따라 목록에서 N개를 고르게 함. 무브 아이템 자체의 `system.choices` 필드(대부분 `<ul><li>` 리스트)와 `system.moveResults.partial/success.value`의 "Choose N" 문구를 읽어서 **범용 다이얼로그 하나로 재사용 가능** — 무브마다 따로 코드를 안 짜도 됨. 액터가 실제로 갖고 있는 무브 아이템의 데이터를 그대로 읽는 거라 번역 여부와도 무관함.
  - 대부분(Bend Bars, Backstab, Arcane Art, Called Shot, I Am The Law, Elemental Mastery)은 `choices` 필드를 씀.
  - 일부(Cast a Spell 계열)는 `choices`가 비어있고 `moveResults.partial.value` 안에 자체적으로 `<ul><li>` 목록이 박혀 있음 — 파서가 두 위치를 다 봐야 함.
  - "Choose N" 문구가 아예 없이 그냥 "choose an ally and an effect" 식으로 개수가 암시만 되는 경우(Arcane Art)도 있어서, 명시 안 되면 기본값 1로 처리하고 무브별 오버라이드(Eldritch Tones가 Arcane Art를 2개로 늘림 등)를 얹는 구조가 필요함.
- **[B] 조건부 확인(Y/N)**: 자동 판별이 불가능한 상황 조건이 붙어서, 트리거 시점에 GM/플레이어에게 "지금 이 조건에 해당합니까?" 물어봐야 함. (사용자가 예시로 든 "피의 향기" = Fighter의 Scent of Blood가 정확히 이 유형)
- **[C] 자동 수치 반영**: 상시 적용되거나, 이미 갖고 있는 데이터(무기 태그 등)로 조건 판별이 가능해서 물어볼 필요 없이 바로 더할 수 있음.
- **[D] Hold 자동 설정**: 굴림 결과에 따라 `system.attributes.hold.value`를 자동으로 세팅하는 패턴(성공=Hold 3, 부분성공=Hold 1 같은 식). [A]와 비슷하지만 "고르기"가 아니라 "자원 수치 설정"이라 별도 컴포넌트로 두는 게 나음. `choices` 필드에 딸려오는 목록은 "선택"이 아니라 "이 Hold로 GM에게 물어볼 수 있는 질문 목록"이라 표시만 해주면 됨.
- **[E] 정적 패시브(Active Effect 후보)**: "이 무브를 갖고 있으면 항상 방어구 +1" 같은, 채팅 트리거가 아니라 액터 스탯 자체를 바꾸는 패시브. Foundry의 Active Effect로 처리하는 게 맞고, 우리 채팅 훅 구조와는 다른 별도 작업임.
- **[-] 범위 밖**: 캐릭터 생성 시 1회성 선택, 순수 서사/GM 재량 텍스트, 또는 자동화 기반이 안 갖춰진 다른 무브(Parley, Defy Danger, Discern Realities, Take Watch, Aid/Interfere 등)에 종속된 무브라 지금 단계에서 손댈 수 없는 것들.

## 부수 발견: 무브 이름 설정에 추가해야 할 것

지금 `meleeMoveNames`/`rangedMoveNames`는 Hack & Slash / Volley만 커버합니다. 그런데 **Thief의 Backstab**(근접, 무기 데미지 굴림)과 **Ranger의 Called Shot**(사격, 무기 데미지 굴림)도 구조적으로 완전히 같은 "무기로 공격 → 성공/부분성공 시 데미지" 패턴입니다. 이 둘도 기본값에 넣어야 할 것 같습니다.

---

## Fighter
- Bend Bars, Lift Gates — **[A]** choices 4개 중 2/3개 선택
- Merciless / Bloodthirsty — **[C]** 데미지를 줄 때마다 상시 +1d4 / +1d8 (레벨6이 레벨2를 대체)
- Evil Eye — **[D]** 성공/부분성공 시 Hold 2/1
- Scent of Blood / Taste of Blood — **[B]** "같은 적에게 다시 접근전"인지 확인 후 다음 공격 +1d4/+1d8
- Iron Hide / Steel Hide — **[E]** 상시 방어구 +1/+2
- Armored, Signature Weapon, Blacksmith, Heirloom, Improved Weapon, Eye For Weaponry, Through Death's Eyes, Multiclass* — **[-]**
- Interrogator, Seeing Red — **[-]** (Parley/Discern Realities 자동화 자체가 없어서 보류)

## Cleric
- Cast A Spell — **[A]** moveResults 안에 내장된 목록에서 1개 선택 (7-9 한정)
- Turn Undead, Divine Guidance, Deity, Commune, First Aid, Greater First Aid, Orison, Serenity, Providence, Apotheosis, Anointed, Chosen One, Reaper, Multiclass Dabbler — **[-]**
- Devoted Healer, Invigorate, Hospitaller류 — **[-]** (치유 자동화 자체가 아직 없음, 별도 기능으로 취급 필요)

## Thief
- Backstab — **[A]** choices 4개 중 1/2개 선택 (+ 위 "무브 이름 설정" 항목 참고)
- Trap Expert — **[D]** 성공/부분성공 시 Hold 3/1, choices는 "물어볼 질문" 표시용
- Cheap Shot / Dirty Fighter — **[C]** 정밀(precise)/한손(hand) 무기 태그 확인만 하면 되므로 자동 반영 가능
- Cautious / Extremely Cautious — **[C]** Trap Expert Hold 자동설정값을 올려주는 보정치
- Flexible Morals, Poisoner, Brewer, Connections, Envenom, Poison Master, Wealth And Taste, Alchemist, Disguise, Heist, Tricks Of The Trade — **[-]**
- Shoot First, Evasion — **[-]** (선제/Defy Danger 자동화 없음)

## Wizard
- Cast a Spell — **[A]** (Cleric와 동일 패턴)
- Prepare Spells, Ritual, Spell Defense, Spellbook, Enchanter류, Expanded Spellbook, Fount of Knowledge, Know-It-All, Logical류, Quick Study, Ethereal Tether, Mystical Puppet Strings, Self-Powered, Prodigy/Master — **[-]**
- Counterspell / Protective Counter, Empowered Magic류 — **[-]** (대상 피격/주문시전 트리거 자체가 없음)

## Ranger
- Called Shot — **[A]** (+ "무브 이름 설정" 항목 참고, 사격 무기 데미지 굴림)
- Hunt & Track — **[D]**류 (성공 시 2개 중 1개 선택 + 정보 획득, choices 구조는 약간 다름)
- Smaug's Belly — **[C]** 이 액터의 사격 공격에 "2 piercing" 원문을 자동으로 얹어주면 됨 (지금 태그 자동표시 로직 재사용)
- Animal Companion, Half-elven, Well-trained, Wild Empathy/Speech, Camouflage, Familiar/Hunter's Prey, Follow Me/Strider, God Amidst The Wastes, Special Trick, Unnatural Ally, Observant — **[-]**

## Paladin
- I Am The Law — **[A]** choices 3개 중 1개(GM이 NPC 반응 고름)
- Armored, Quest, Charge!/Ever Onward, Divine Favor/Evidence, Voice/Divine Authority, Perfect Knight — **[-]**
- Lay On Hands, Hospitaller류 — **[-]** (치유 자동화 없음)
- Bloody Aegis, Indomitable, Setup/Tandem Strike, Exterminatus, Smite류, Holy/Divine Protection — 전부 **[?]** (아래 참고)

## Bard
- Arcane Art / Eldritch Tones·Chord — **[A]** choices 4개 중 1/2개 선택
- Metal Hurlant — **[C]류** roll+CON 자체 데미지 1d10을 주는, 무기 없이 발동하는 독자적 공격 무브 (신규 패턴)
- A Port In The Storm, Bardic Lore, Charming & Open/Devious, Multiclass*, An Ear For Magic, Unforgettable Face — **[-]**
- A Little Help, Bamboozle/Con, It Goes To Eleven, Reputation — **[-]** (Aid/Interfere·Parley 자동화 없음, 또는 순수 서사)
- Healing Song/Chorus, Vicious Cacophony/Blast — **[?]** (Arcane Art 선택 결과에 종속, 아래 참고)
- Duelist's Parry/Block — **[?]** (아래 참고)

## Druid
- Shapeshifter — **[D]** 실패/부분/성공 시 Hold 1/2/3 (실패해도 Hold 주는 특이 케이스)
- Elemental Mastery — **[A]** choices 3개 중 1/2개 선택
- Barkskin — **[E]** 상시 방어구 +1
- Born of the Soil, By Nature Sustained, Spirit Tongue, Studied Essence, Eyes of the Tiger, Thing-talker/World-talker, Chimera, Doppleganger's Dance, Embracing No Form, Weather Weaver, The Druid Sleep, Stalker's Sister, Hunter's Brother — **[-]**
- Balance, Red of Tooth and Claw/Blood and Thunder, Shed, Formcrafter/Formshaper — **[?]** (아래 참고, 전부 "변신 상태" 추적에 의존)

---

## 판단이 필요한 애매한 항목 (제 임의 판단으로 분류 안 함)

1. **Fighter: Armor Mastery / Armored Perfection** — 피격 시 방어구 1 깎아서 피해 무효화. "PC가 피해를 받는 시점"을 잡아낼 훅이 지금 전혀 없음(우리는 지금 PC가 공격할 때만 훅함). 이런 "피격 시" 트리거를 아예 새로 만들 것인지?
2. **Fighter: Superior Warrior** — Hack & Slash 자체의 성공 등급표에 12+ 구간을 새로 추가함(기존 10+와 다른 효과). 이건 무브 하나가 다른 무브의 판정 자체를 바꾸는 케이스라, 저희 "성공/부분성공만 감지" 구조를 건드려야 함.
3. **Cleric/Paladin: Lay On Hands, Hospitaller, Devoted Healer 등 치유 계열 전부** — 지금 저희 자동화는 "데미지 굴림"만 다루고 "치유 굴림"은 아예 없음. 치유도 비슷한 구조로 새로 만들 가치가 있는지, 아니면 이번 범위에서 뺄지?
4. **Paladin: Bloody Aegis, Indomitable** — 역시 "피격 시" 트리거 필요 (1번과 같은 이슈).
5. **Paladin: Exterminatus, Smite/Holy Smite** — "지정한 적/Quest 중"이라는 상태를 추적해야 함. Quest는 캐릭터시트에 구조화된 필드가 없어서(그냥 서사 텍스트), "지금 퀘스트 중입니까?" 매번 물어볼지, 아니면 액터 플래그로 GM이 수동 토글하게 만들지?
6. **Paladin: Setup Strike/Tandem Strike** — "내가 Hack & Slash 하면 아군의 다음 공격에 보너스" — 보너스를 받는 대상이 나 자신이 아니라 **다른 PC**라서, 그 PC가 다음에 공격할 때 이 보너스를 기억해뒀다가 반영해야 함. 상태를 누구 액터에, 얼마나(1회성) 저장할지 설계가 필요함.
7. **Wizard: Spell Augmentation** — 데미지를 줄 때 진행 중인 주문(ongoing spell)을 하나 소모하고 그 레벨만큼 데미지 추가. "진행 중인 주문" 추적 방식이 필요함.
8. **Ranger: Command** — 동반 동물의 능력치(사나움 등)를 내 공격/판정에 더함. 동반 동물이 별도 액터인지 그냥 캐릭터 시트 안 데이터인지부터 확인 필요.
9. **Ranger: Viper's Strike/Fangs** — "양손무기 동시 공격" 상황을 자동 감지할 수 없어서 Y/N으로 물어볼지, 아니면 아예 무기 선택 다이얼로그에 "겸용 공격" 체크박스를 넣을지.
10. **Ranger: Blot Out The Sun** — Volley 판정 전에 화살을 미리 더 써서 다중 타겟을 노리는 무브. 지금 화살 소모 다이얼로그는 "판정 후"에 뜨는데, 이건 "판정 전" 개입이 필요해서 흐름 순서 자체를 바꿔야 함.
11. **Thief: Underdog/Serious Underdog** — "숫자에서 밀릴 때"를 씬에 있는 적대 토큰 수 세기로 근사할지, 아니면 그냥 Y/N으로 물어볼지.
12. **Thief: Strong Arm, True Aim** — 근접무기를 사격무기처럼 던져서 쓸 수 있게 해주는 규칙. 지금 근접/사격 판정이 무기 태그 기반인데, 이 무브가 있으면 그 판정 자체가 예외적으로 뒤집힘.
13. **Bard: Duelist's Parry/Block, Healing Song/Chorus, Vicious Cacophony/Blast** — 전부 Arcane Art에서 "어떤 효과를 골랐는지"에 종속된 후속 보너스라, [A] 선택지 다이얼로그 결과와 연동시켜야 함 (선택지를 골랐을 때만 발동).
14. **Druid: Balance** — 데미지를 줄 때마다 쌓이는 "밸런스"라는 자원인데, 캐릭터시트 스키마에 이런 필드가 아예 없음. 액터 플래그로 새로 만들어서 추적할지?
15. **Druid: Red of Tooth and Claw/Blood and Thunder, Shed, Formcrafter/Formshaper** — 전부 "지금 변신한 상태인지"에 의존하는데, Shapeshifter 자체를 Hold 자동설정([D])까지만 만들 계획이라 "변신 상태 여부"를 별도로 추적하는 로직이 있어야 이것들도 자동화됨.

이 15개는 전부 "현재 자동화 안 되어 있는 다른 시스템(피격 트리거, 치유 굴림, 변신 상태, 팀원 간 버프 전달, Quest 상태)"에 걸쳐 있어서, 하나씩 어떻게 갈지 정해주시면 그에 맞춰 설계하겠습니다.
