// 던전월드 시스템의 약화(Debility)는 능력치 자체에 붙는 불리언 필드다
// (system.abilities.<str|dex|con|int|wis|cha>.debility). 이름표(Weak/Shaky/...)는
// 던전월드 시스템 자체의 월드 설정(debilityLabelSTR 등)에서 읽어오므로, GM이
// 이름을 바꾸든 번역 모듈을 쓰든 우리가 텍스트를 매칭할 필요가 전혀 없다 —
// 다른 설정들과 달리 이 부분은 구조적으로 번역에 안전하다.
export const DEBILITY_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

export function getDebilityLabel(key) {
  const settingKey = `debilityLabel${key.toUpperCase()}`;
  return game.i18n.localize(game.settings.get("dungeonworld", settingKey));
}

export function getOpenDebilities(actor) {
  return DEBILITY_ABILITIES.filter((key) => !actor.system.abilities?.[key]?.debility);
}

export function hasAllDebilities(actor) {
  return getOpenDebilities(actor).length === 0;
}
