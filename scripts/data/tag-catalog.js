// 던전월드 공식 태그 컴펜디엄(systems/dungeonworld/packs/tags) 중, 데미지 굴림과
// 관련 있는 태그만 추려낸 목록.
//
// "raw" 타입은 굴림 수식에는 더하지 않고, 매칭된 태그 원문 그대로(예: "1 piercing",
// "+1 damage", "Ignores Armor")를 채팅 메시지에 노출시킨다. 던전월드 시스템 자체의
// 피해 적용 버튼(전체/절반/두배/치유)이 메시지 전체 텍스트를 정규식으로 훑어서
// "N piercing" / "+N damage" / "ignores armor"를 찾아 자동으로 반영하기 때문에,
// 우리는 그 원문 문자열만 보여주면 되고 방어구/관통 계산 자체는 시스템이 대신 해준다.
// (attack-assistant.js의 rollDamage 참고. 굴림 수식에 직접 더하면 버튼을 눌렀을 때
// 이중으로 반영되므로 절대 더하면 안 된다.)
//
// "note" 타입은 시스템이 전혀 자동화해주지 않는 서술형 태그라서, 참고용 문구로만
// 표시한다.
export const TAG_CATALOG = [
  {
    key: "damageBonus",
    pattern: /\+?(\d+)\s*damage/i,
    effect: "raw",
    labelKey: "DWAUTO.Tags.DamageBonus.Label"
  },
  {
    key: "piercing",
    pattern: /(\d+)\s*piercing/i,
    effect: "raw",
    labelKey: "DWAUTO.Tags.Piercing.Label"
  },
  {
    key: "ignoresArmor",
    pattern: /ignores armor/i,
    effect: "raw",
    labelKey: "DWAUTO.Tags.IgnoresArmor.Label"
  },
  {
    key: "forceful",
    pattern: /forceful/i,
    effect: "note",
    labelKey: "DWAUTO.Tags.Forceful.Label",
    noteKey: "DWAUTO.Tags.Forceful.Note"
  },
  {
    key: "messy",
    pattern: /messy/i,
    effect: "note",
    labelKey: "DWAUTO.Tags.Messy.Label",
    noteKey: "DWAUTO.Tags.Messy.Note"
  }
];
