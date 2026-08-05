import { MODULE_ID } from "../constants.js";
import {
  ORGANIZATION_OPTIONS,
  SIZE_OPTIONS,
  ARMOR_OPTIONS,
  FAME_OPTIONS,
  BLESSED_CHOICE_OPTIONS,
  ATTACK_TRAIT_OPTIONS,
  TRAIT_OPTIONS
} from "../data/monster-tables.js";
import { computeMonsterBuild, formatDamageFormula } from "../lib/monster-builder.js";

const ANSWERS_FLAG = "monsterBuildAnswers";

function mapRadioOptions(options, current) {
  return options.map((o) => ({ ...o, checked: o.value === current }));
}

function mapCheckOptions(options, currentMap) {
  return options.map((o) => ({ ...o, checked: Boolean(currentMap?.[o.value]) }));
}

// 던전월드 한국어 공개판 "괴물 만들기" 절차(3~8번 질문)를 그대로 옮긴 폼.
// 1번(액션)/2번(본능) 질문은 순수 서술형이라 자동화하지 않는다 — 본능은 이미
// features/npc-generator.js의 "랜덤생성" 탭이 별도로 다룬다. 제출하면
// lib/monster-builder.js의 computeMonsterBuild가 전부 계산하고, 이 파일의
// _updateObject가 그 결과를 액터에 적용한다.
export class MonsterBuilderApp extends FormApplication {
  constructor(actor, options = {}) {
    super(actor, options);
  }

  get actor() {
    return this.object;
  }

  get title() {
    return game.i18n.format("DWAUTO.MonsterBuilder.Title", { name: this.actor.name });
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-monster-builder",
      template: `modules/${MODULE_ID}/templates/monster-builder.html`,
      width: 640,
      height: "auto",
      closeOnSubmit: true,
      resizable: true
    });
  }

  getData() {
    const saved = this.actor.getFlag(MODULE_ID, ANSWERS_FLAG) ?? {};

    return {
      organizationOptions: mapRadioOptions(ORGANIZATION_OPTIONS, saved.organization ?? "group"),
      sizeOptions: mapRadioOptions(SIZE_OPTIONS, saved.size ?? "normal"),
      armorOptions: mapRadioOptions(ARMOR_OPTIONS, saved.armor ?? "1"),
      fameOptions: mapCheckOptions(FAME_OPTIONS, saved.fame),
      blessedChoiceOptions: mapRadioOptions(BLESSED_CHOICE_OPTIONS, saved.blessedChoice ?? "damage"),
      attackName: saved.attackName ?? "",
      attackTraitOptions: mapCheckOptions(ATTACK_TRAIT_OPTIONS, saved.attackTraits),
      traitOptions: mapCheckOptions(TRAIT_OPTIONS, saved.traits),
      applyDuplicateBonus: Boolean(saved.applyDuplicateBonus)
    };
  }

  async _updateObject(event, formData) {
    const data = foundry.utils.expandObject(formData);
    const result = computeMonsterBuild(data);

    // 시트의 "태그" 칸(system.tags)은 아이템 태그와 완전히 같은 형식이다
    // (JSON.stringify한 {value}[] + 쉼표로 합친 표시용 tagsString — 던전월드
    // 시스템의 actor-sheet.js _prepareNpcItems가 그렇게 파싱한다). 여기서
    // 안 채워주면 계산은 다 되는데 시트에는 아무것도 안 보이는 상태가 된다.
    const allTags = [...result.tags, ...result.rangeTags];
    const tagsJson = JSON.stringify(allTags.map((value) => ({ value })));
    const tagsString = allTags.join(", ");

    await this.actor.update({
      "system.attributes.damage.value": formatDamageFormula(result.damageDie, result.damageMod, result.rollMode),
      "system.attributes.damage.piercing": result.pierce > 0 ? `${result.pierce} piercing` : "",
      "system.attributes.ac.value": result.armor,
      "system.attributes.hp.value": result.hp,
      "system.attributes.hp.max": result.hp,
      "system.tags": tagsJson,
      "system.tagsString": tagsString,
      [`flags.${MODULE_ID}.${ANSWERS_FLAG}`]: data,
      [`flags.${MODULE_ID}.monsterTags`]: result.tags,
      [`flags.${MODULE_ID}.monsterRangeTags`]: result.rangeTags,
      [`flags.${MODULE_ID}.monsterAttackName`]: result.attackName,
      [`flags.${MODULE_ID}.monsterReminders`]: result.reminders,
      [`flags.${MODULE_ID}.monsterDamageDie`]: result.damageDie,
      [`flags.${MODULE_ID}.monsterDamageMod`]: result.damageMod,
      [`flags.${MODULE_ID}.monsterRollMode`]: result.rollMode
    });

    ui.notifications.info(game.i18n.format("DWAUTO.Monster.Generated", { name: this.actor.name }));
  }
}
