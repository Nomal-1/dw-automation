// "자유 기입형" 무브: 주사위 대신 플레이어가 신의 이름/영역, 퀘스트 내용,
// 동반 동물 등 서사적인 무언가를 직접 정해야 하는 무브. features/note-moves.js가
// 이 목록에 있는 이름의 무브를 소유만 하고 있어도 캐릭터 시트에 그 무브 이름을
// 딴 탭과 자유 메모란을 만들어준다(대지의 아들/딸은 소유가 아니라 실제 발동을
// 감지해야 해서 별도 설정/기능(features/born-of-the-soil.js)으로 분리돼 있다).
//
// 8개 기본 직업 + 바바리안/이몰레이터 컴펜디엄(1.8.2) 전수조사로 찾은 것:
//   - Deity(클레릭): 신의 이름과 영역을 직접 정함
//   - Apotheosis(클레릭): 신격화 이후의 정체성을 서술
//   - Animal Companion(레인저): 동반 동물의 종류/이름/특징을 정함
//   - Quest(팔라딘): "___를 처단/수호/진실을 밝힌다" 식으로 개인 사명을 정함
//   - Divine Favor(팔라딘): 새 신을 이름 짓거나 기존 신 중 하나를 택함
//   - God Amidst The Wastes(레인저): Divine Favor와 완전히 같은 문구의
//     멀티클래스 클레릭 무브(레인저 목록에도 실려있음)
export const DEFAULT_NOTE_MOVE_NAMES = [
  "Deity",
  "Apotheosis",
  "Animal Companion",
  "Quest",
  "Divine Favor",
  "God Amidst The Wastes"
];
