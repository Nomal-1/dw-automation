import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { consumePendingSpellEffectBonus } from "../lib/spell-effect-bonus-state.js";

// 공격 주문(설정: 주문 피해 무브) 자동 피해 굴림. features/healing.js의 치유
// 쪽과 마찬가지로 Cast a Spell 흐름(spellcasting.js)에서 선택된 주문이 이
// 표에 있으면 호출된다.
//
// 대상을 직접 고르고 HP를 갱신하는 healing.js와 달리, 이쪽은
// features/attack-assistant.js의 무기 데미지 굴림과 같은 방식(주사위를
// 굴려서 채팅에 적용 버튼과 함께 올리고, 실제로 누구에게 적용할지는
// 지금 타겟팅된 대상을 보고 GM/플레이어가 버튼을 누른다)을 그대로 따른다
// — 공격 대상은 보통 몬스터라서 대상 선택 드롭다운보다는 던전월드 시스템
// 자체의 타겟팅+데미지 버튼 흐름이 더 자연스럽다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELL_DAMAGE_ASSISTANT);
}

function getSpellDamageRow(name) {
  const table = game.settings.get(MODULE_ID, SETTINGS.SPELL_DAMAGE_MOVES);
  return table.find((row) => row.name === name) ?? null;
}

// "auto"는 주문 아이템의 system.rollFormula(구조적 필드, 번역 무관하게 항상
// 정확)를 그대로 읽는다. healing.js의 resolveFormula와 같은 원리다.
function resolveFormula(spell, row) {
  if (row.formulaMode === "custom") return row.customFormula || null;
  return spell.system?.rollFormula || row.customFormula || null;
}

async function performSpellDamage(caster, spell, row) {
  const formula = resolveFormula(spell, row);
  if (!formula) {
    ui.notifications.warn(game.i18n.format("DWAUTO.SpellDamage.NoFormula", { name: spell.name }));
    return;
  }

  // 클레릭 회개(Martyr)가 걸어둔 "다음 주문 피해/치유에 레벨만큼 추가"를
  // 여기서 소모한다(features/hit-trigger.js 참고).
  const bonus = await consumePendingSpellEffectBonus(caster);
  const finalFormula = bonus ? `${formula}+${bonus.amount}` : formula;

  const roll = new Roll(finalFormula, caster.getRollData());
  await roll.evaluate();

  let rollHtml = await roll.render();
  // 무기 데미지 굴림(attack-assistant.js)과 같은 이유로, 음수 합계는
  // 표시/적용 단계에서 0으로 clamp한다.
  if (roll.total < 0) {
    const $rollHtml = $("<div>").html(rollHtml);
    $rollHtml.find(".dice-total").first().text("0");
    rollHtml = $rollHtml.html();
  }

  const rawTags = row.ignoresArmor ? ["ignores armor"] : [];

  const content = `
    <h3>${game.i18n.format("DWAUTO.SpellDamage.Flavor", { spell: spell.name })}</h3>
    ${rawTags.length ? `<p class="dwauto-raw-tags">${rawTags.join(", ")}</p>` : ""}
    ${rollHtml}
    <div class="chat-damage-buttons">
      <button type="button" class="button damage full-damage" data-action="damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyFullTitle")}"><i class="fas fa-user-minus"></i></button>
      <button type="button" class="button damage half-damage" data-action="half-damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyHalfTitle")}"><i class="fas fa-user-minus"></i> 1/2</button>
      <button type="button" class="button damage double-damage" data-action="double-damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyDoubleTitle")}"><i class="fas fa-user-minus"></i> 2X</button>
      <button type="button" class="button heal heal-damage" data-action="heal" title="${game.i18n.localize("DWAUTO.Attack.ApplyHealTitle")}"><i class="fas fa-user-plus"></i></button>
    </div>
  `;

  const chatData = { user: game.user.id, speaker: ChatMessage.getSpeaker({ actor: caster }), content };
  if (game.dice3d) {
    await game.dice3d.showForRoll(roll, game.user, true, null, false);
  } else {
    chatData.sound = CONFIG.sounds.dice;
  }
  await ChatMessage.create(chatData);

  if (bonus) {
    announceActionApplied(
      caster,
      bonus.source,
      game.i18n.format("DWAUTO.SpellDamage.LevelBonusApplied", { amount: bonus.amount })
    );
  }

  if (row.selfDamageFormula) {
    const selfRoll = new Roll(row.selfDamageFormula, caster.getRollData());
    await selfRoll.evaluate();
    await selfRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      flavor: game.i18n.format("DWAUTO.SpellDamage.SelfDamageFlavor", { spell: spell.name })
    });

    const hp = Number(caster.system.attributes?.hp?.value) || 0;
    await caster.update({ "system.attributes.hp.value": Math.max(0, hp - selfRoll.total) });
    announceActionApplied(
      caster,
      spell.name,
      game.i18n.format("DWAUTO.SpellDamage.SelfDamageApplied", { amount: selfRoll.total })
    );
  }
}

// features/spellcasting.js(Cast a Spell 흐름)에서 선택된 주문이 공격 주문
// 표에 있으면 호출한다.
export async function handleSpellDamage(actor, spellItem) {
  if (!isEnabled()) return;

  const row = getSpellDamageRow(spellItem.name);
  if (!row) return;

  await performSpellDamage(actor, spellItem, row);
}

export function registerSpellDamageAssistant() {
  // 훅이 따로 필요 없다 — spellcasting.js가 handleSpellDamage를 직접 불러서 쓴다.
}
