# 던전월드 자동화 툴킷 (dw-automation)

Foundry VTT의 던전월드(Dungeon World) 시스템용 GM 자동화 모듈입니다. Foundry V12.331 / Dungeon World 1.8.2 기준으로 작성되었습니다.

기능은 모듈 설정에서 개별적으로 켜고 끌 수 있습니다.

## 기능

- **NPC 자동 생성**: NPC 시트에 "랜덤생성" 탭을 추가해 이름·본능·재주를 무작위로 굴립니다.
- **몬스터 스탯 생성**: NPC 시트에 "몬스터 스탯" 탭을 추가해 데미지 다이스·방어구·HP·코인을 무작위로 굴려 바로 시트에 반영합니다.
- **공격 데미지 자동 굴림**: 근접(Hack & Slash)/사격(Volley) 무브가 성공·부분 성공하면 데미지를 굴릴지 물어보고, 사용한 무기를 선택하면 태그(예: `2 damage`)를 반영해 데미지를 굴립니다. 사격 무기라면 화살 등 탄약 소모 개수도 물어보고 실제 아이템의 사용 횟수를 차감합니다. 결과 채팅 메시지의 버튼으로 현재 타겟에 방어구 감소까지 반영된 피해를 바로 적용할 수 있습니다.
- 근접/사격으로 인식할 무브 이름은 설정에서 쉼표로 구분해 직접 지정할 수 있습니다 (번역 모듈로 무브 이름이 바뀐 경우 대응).

## 설치

Foundry 모듈 설치 화면에서 아래 매니페스트 URL을 사용하세요:

```
https://github.com/Nomal-1/dw-automation/releases/latest/download/module.json
```

### 필수 모듈: 던전월드 한글화(dungeonworld-ko)

이 모듈의 UI와 자동화 문구는 한국어 전용으로 만들어져 있어, [던전월드 한글화 모듈](https://github.com/Nomal-1/t2)이 반드시 설치·활성화되어 있어야 합니다. 아래 매니페스트 URL로 먼저(또는 같이) 설치하세요:

```
https://github.com/Nomal-1/t2/releases/latest/download/module.json
```

## 이전 모듈과의 관계

이 모듈은 [dw-instant-npc](https://github.com/Nomal-1/dw-instant-npc)의 NPC 생성 기능을 포함하며, 이를 대체합니다.
