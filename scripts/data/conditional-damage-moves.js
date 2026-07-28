// Paladin Smite/Holy Smite/Exterminatus, Ranger Viper's Strike/Fangs처럼
// "특정 조건을 만족하면 데미지 주사위를 추가로(또는 페널티로) 굴린다"는
// 무브들. 조건 자체(퀘스트 중인지, 겸용 공격을 했는지 등)를 자동으로 판정할
// 수 없어서, 데미지를 굴릴 때마다 Y/N으로 물어보고 대답에 따라 yesFormula
// 또는 noFormula를 데미지 굴림에 더한다. 비워두면(또는 "0"이면) 그 갈래는
// 아무것도 더하지 않는다.
export const DEFAULT_CONDITIONAL_DAMAGE_MOVES = [
  { name: "Smite", yesFormula: "1d4", noFormula: "0" },
  { name: "Holy Smite", yesFormula: "1d8", noFormula: "0" },
  { name: "Exterminatus", yesFormula: "2d4", noFormula: "-4" },
  { name: "Viper’s Strike", yesFormula: "1d4", noFormula: "0" },
  { name: "Viper’s Fangs", yesFormula: "1d8", noFormula: "0" }
];
