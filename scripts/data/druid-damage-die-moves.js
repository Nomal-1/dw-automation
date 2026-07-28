// Red of Tooth and Claw / Blood and Thunder: 변신 중(적절한 동물 형태)일 때만
// 데미지 주사위가 이 값으로 바뀐다. 두 무브를 동시에 갖고 있으면(업그레이드로
// 상위 무브까지 배운 경우) dieSize가 더 큰 쪽을 쓴다.
export const DEFAULT_DRUID_DAMAGE_DIE_MOVES = [
  { name: "Red of Tooth and Claw", dieSize: 8 },
  { name: "Blood and Thunder", dieSize: 10 }
];
