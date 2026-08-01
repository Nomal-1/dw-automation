// 위저드 Prepare Spells / 클레릭 Commune: "시간을 들여 조용히 명상/기원하면"
// 지금까지 준비/부여받은 주문을 전부 잃고, 새로 주문을 고른다는 무브. 원문
// 근거(공식 컴펜디엄, asacolips-projects/dungeonworld 1.8.2):
//   - Prepare Spells: "Lose any spells you already prepared. Prepare new
//     spells chosen from your spellbook whose total levels don't exceed your
//     own level +1. Prepare your cantrips which never count against your
//     limit."
//   - Commune: "Lose any spells already granted to you. Are granted new
//     spells of your choice whose total levels don't exceed your own level
//     +1, and none of which is a higher level than your own level. Prepare
//     all of your rotes, which never count against your limit."
//
// 두 무브 모두 "레벨 합이 (자기 레벨+1)을 넘지 않게 고르고, 0레벨 주문
// (칸트립/로트)은 한도에 안 들어가며 자동으로 전부 준비된다"는 점은 같다.
// 클레릭 Commune만 원문에 "자기 레벨보다 높은 주문은 아예 고를 수 없다"는
// 추가 제한이 있어서(위저드 Prepare Spells엔 이 문구가 없음), 그 차이를
// enforceIndividualLevelCap로 표현한다.
//
// 주문 아이템의 system.spellLevel(0=칸트립/로트, 그 외엔 1/3/5/7/9)과
// system.prepared(이미 다른 자동화 — features/spellcasting.js의 "주문 시전"
// 선택 목록 — 가 그대로 참조하는 필드)를 그대로 재사용한다.
export const DEFAULT_PREPARE_SPELLS_MOVES = [
  { name: "Prepare Spells", enforceIndividualLevelCap: false },
  { name: "Commune", enforceIndividualLevelCap: true }
];
