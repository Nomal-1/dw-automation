// Ranger Smaug's Belly처럼 "특정 조건을 만족하면 이번 공격에 데미지 태그
// 원문을 하나 추가로 붙이는" 무브들. 조건(약점을 파악했는지 등)을 자동
// 판정할 수 없어서 데미지를 굴릴 때마다 Y/N으로 물어보고, "예"면 tag
// 문자열을 데미지 메시지에 원문 그대로 노출시킨다(TAG_CATALOG의 "raw"
// 태그와 같은 방식 — 던전월드 시스템의 피해 적용 버튼이 메시지 텍스트를
// 정규식으로 훑어서 알아서 반영한다). CONDITIONAL_DAMAGE_MOVES와 달리
// "아니오"일 때 아무것도 더하지 않는 것 외에 다른 페널티가 없어서
// noFormula/requiresDesignation 없이 tag 하나만 갖는다.
export const DEFAULT_CONDITIONAL_TAG_MOVES = [{ name: "Smaug's Belly", tag: "2 piercing" }];
