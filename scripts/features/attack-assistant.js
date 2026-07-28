import { MODULE_ID, SETTINGS } from "../constants.js";
import { TAG_CATALOG } from "../data/tag-catalog.js";
import { DEFAULT_ATTACK_BEHAVIOR } from "../data/attack-moves.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { getMoveChoiceData, promptChoiceSelection, extractInlineRoll } from "../lib/move-choices.js";
import { announceActionApplied } from "../lib/announce.js";
import { getActiveOngoingSpells, removeActiveOngoingSpell } from "../lib/ongoing-spells-state.js";

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 근접/사격 판정: 무기 태그(tagsString)에 설정된 키워드가 하나라도 포함되어
// 있으면 해당 유형으로 취급한다. 던전월드 기본 무기는 근접이 hand/close/reach,
// 사격이 near/far 태그를 쓰는 관례를 이용한 것으로, 무기 자체에 "근접"/"사격"을
// 구분하는 별도 필드가 있는 게 아니다. 이 키워드 목록은 모듈 설정(근접/사격 무기
// 판정 태그)에서 직접 편집할 수 있다.
function isMeleeWeapon(item) {
  const tags = (item.system?.tagsString ?? "").toLowerCase();
  const meleeKeywords = splitCommaList(SETTINGS.MELEE_WEAPON_TAGS).map((k) => k.toLowerCase());
  return meleeKeywords.some((keyword) => tags.includes(keyword));
}

function isRangedWeapon(item) {
  const tags = (item.system?.tagsString ?? "").toLowerCase();
  const rangedKeywords = splitCommaList(SETTINGS.RANGED_WEAPON_TAGS).map((k) => k.toLowerCase());
  return rangedKeywords.some((keyword) => tags.includes(keyword));
}

function isAmmoItem(item) {
  return /ammo/i.test(item.system?.tagsString ?? "");
}

// 모듈 설정(태그 자동 반영 목록)에서 켜둔 태그만 검사한다.
// "raw" 타입은 매칭된 태그 원문(예: "1 piercing", "+1 damage")을 그대로 반환한다 —
// 이 문자열을 채팅 메시지에 노출시켜 두면, 던전월드 시스템의 네이티브 피해 적용
// 버튼(전체/절반/두배/치유)이 클릭 시 메시지 텍스트를 정규식으로 훑어서 알아서
// 관통/방어구무시/데미지보너스를 반영해준다(dungeonworld/module/chat.js의
// _chatActionDamage 참고). 그래서 여기서는 절대 수식에 더하면 안 된다 — 더하면
// 버튼을 눌렀을 때 이중으로 반영된다.
// "note" 타입은 시스템이 자동화해주지 않는 서술형 태그라 참고 문구로만 보여준다.
function getTagDisplay(weapon) {
  const enabled = game.settings.get(MODULE_ID, SETTINGS.ENABLED_DAMAGE_TAGS);
  const tagsString = weapon.system?.tagsString ?? "";

  const rawTags = [];
  const notes = [];

  for (const tag of TAG_CATALOG) {
    if (!enabled.includes(tag.key)) continue;
    const match = tagsString.match(tag.pattern);
    if (!match) continue;

    if (tag.effect === "raw") {
      rawTags.push(match[0]);
    } else {
      notes.push(game.i18n.format(tag.noteKey, { n: match[1] ?? "" }));
    }
  }

  return { rawTags, notes };
}

// term이 이미 부호(+/-)로 시작하면 그대로 붙이고, 아니면 "+"를 붙여서 이어준다.
// term이 비어 있으면 formula를 그대로 반환한다. 데미지 공식을 여러 출처(무기
// 기본 다이스, 선택지 보너스, 조건부 보너스 등)에서 안전하게 이어붙이기 위한
// 공용 헬퍼다.
function appendTerm(formula, term) {
  if (!term) return formula;
  const t = String(term).trim();
  if (!t) return formula;
  return t.startsWith("+") || t.startsWith("-") ? `${formula}${t}` : `${formula}+${t}`;
}

async function rollDamage(actor, weapon, dmgMod, extraDice) {
  const die = actor.system.attributes?.damage?.value || "d6";
  const miscBonus = actor.system.attributes?.damage?.misc || "";

  let formula = die;
  formula = appendTerm(formula, miscBonus);
  formula = appendTerm(formula, extraDice);
  formula = appendTerm(formula, dmgMod);

  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();

  const { rawTags, notes } = getTagDisplay(weapon);

  const flavor = `
    <h3>${game.i18n.format("DWAUTO.Attack.DamageFlavor", { weapon: weapon.name })}</h3>
    ${rawTags.length ? `<p class="dwauto-raw-tags">${rawTags.join(", ")}</p>` : ""}
    ${notes.length ? `<ul class="dwauto-tag-notes"><li>${notes.join("</li><li>")}</li></ul>` : ""}
    <div class="chat-damage-buttons">
      <button type="button" class="button damage full-damage" data-action="damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyFullTitle")}"><i class="fas fa-user-minus"></i></button>
      <button type="button" class="button damage half-damage" data-action="half-damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyHalfTitle")}"><i class="fas fa-user-minus"></i> 1/2</button>
      <button type="button" class="button damage double-damage" data-action="double-damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyDoubleTitle")}"><i class="fas fa-user-minus"></i> 2X</button>
      <button type="button" class="button heal heal-damage" data-action="heal" title="${game.i18n.localize("DWAUTO.Attack.ApplyHealTitle")}"><i class="fas fa-user-plus"></i></button>
    </div>
  `;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor
  });
}

function promptAmmo(ammoItems) {
  const ammoOptions = ammoItems
    .map((a) => `<option value="${a.id}">${a.name} (${game.i18n.localize("DWAUTO.Attack.Remaining")}: ${a.system.uses ?? 0})</option>`)
    .join("");

  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("DWAUTO.Attack.AmmoDialogTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Attack.AmmoItemLabel")}</label>
            <select name="ammoItem">${ammoOptions}</select>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Attack.AmmoCountLabel")}</label>
            <input type="number" name="ammoCount" value="1" min="0">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            resolve({
              ammoItemId: html.find('[name="ammoItem"]').val(),
              ammoCount: Math.max(0, Number(html.find('[name="ammoCount"]').val()) || 0)
            });
          }
        },
        skip: {
          label: game.i18n.localize("DWAUTO.Attack.AmmoSkip"),
          callback: () => resolve(null)
        }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

// Wizard의 Spell Augmentation: 지속 중인 주문을 하나 소모해서 그 레벨만큼
// 데미지를 추가한다. 이 무브가 없거나 지속 중인 주문이 없으면 그냥 0을 반환한다
// (물어보지 않고 조용히 넘어감).
async function promptSpellAugmentation(actor) {
  const moveNames = splitCommaList(SETTINGS.SPELL_AUGMENTATION_MOVE_NAMES);
  const hasMove = actor.items.some((i) => i.type === "move" && moveNames.includes(i.name));
  if (!hasMove) return 0;

  const active = getActiveOngoingSpells(actor);
  if (active.length === 0) return 0;

  return new Promise((resolve) => {
    const options = active.map((s) => `<option value="${s.itemId}">${s.name}</option>`).join("");

    new Dialog({
      title: game.i18n.localize("DWAUTO.SpellAugmentation.Title"),
      content: `
        <p>${game.i18n.localize("DWAUTO.SpellAugmentation.Content")}</p>
        <form>
          <div class="form-group">
            <select name="spell">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        yes: {
          label: game.i18n.localize("DWAUTO.SpellAugmentation.Use"),
          callback: async (html) => {
            const itemId = html.find('[name="spell"]').val();
            const spellItem = actor.items.get(itemId);
            const level = Number(spellItem?.system?.spellLevel) || 0;
            await removeActiveOngoingSpell(actor, itemId);
            announceActionApplied(
              actor,
              game.i18n.localize("DWAUTO.SpellAugmentation.Title"),
              game.i18n.format("DWAUTO.SpellAugmentation.Applied", { spell: spellItem?.name ?? "?", level })
            );
            resolve(level);
          }
        },
        no: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve(0)
        }
      },
      default: "no",
      close: () => resolve(0)
    }).render(true);
  });
}

// Paladin Smite/Holy Smite/Exterminatus, Ranger Viper's Strike/Fangs처럼
// "특정 조건을 만족하면 데미지 주사위를 추가로(또는 페널티로) 굴리는"
// 무브들. 조건(퀘스트 중인지, 겸용 공격을 했는지 등)을 자동 판정할 수
// 없어서 하나씩 Y/N으로 물어보고, 대답에 따라 yesFormula 또는 noFormula를
// 데미지 공식에 이어붙인다. 해당 무브가 없으면 조용히 빈 문자열을 반환한다.
async function promptConditionalDamageBonuses(actor) {
  const table = game.settings.get(MODULE_ID, SETTINGS.CONDITIONAL_DAMAGE_MOVES);
  const owned = table.filter((row) => actor.items.some((i) => i.type === "move" && i.name === row.name));
  if (owned.length === 0) return "";

  let extra = "";
  for (const row of owned) {
    const confirmed = await Dialog.confirm({
      title: row.name,
      content: `<p>${game.i18n.format("DWAUTO.ConditionalDamage.Prompt", { name: row.name })}</p>`,
      defaultYes: false
    });

    const formula = confirmed ? row.yesFormula : row.noFormula;
    if (formula && formula.trim() && formula.trim() !== "0") {
      extra = appendTerm(extra, formula);
      announceActionApplied(
        actor,
        row.name,
        game.i18n.format(confirmed ? "DWAUTO.ConditionalDamage.Yes" : "DWAUTO.ConditionalDamage.No", {
          formula: formula.trim()
        })
      );
    }
  }
  return extra;
}

async function handleAmmoAndRoll(actor, weapon, dmgMod, extraDice) {
  let consumed = null;

  if (isRangedWeapon(weapon)) {
    const ammoItems = actor.items.filter((i) => i.type === "equipment" && isAmmoItem(i));
    if (ammoItems.length > 0) {
      consumed = await promptAmmo(ammoItems);
    }
  }

  const augBonus = await promptSpellAugmentation(actor);
  const conditionalExtra = await promptConditionalDamageBonuses(actor);
  const finalExtraDice = appendTerm(extraDice || "", conditionalExtra);
  const finalDmgMod = (Number(dmgMod) || 0) + augBonus;

  await rollDamage(actor, weapon, finalDmgMod, finalExtraDice);

  if (consumed && consumed.ammoCount > 0) {
    const ammoItem = actor.items.get(consumed.ammoItemId);
    if (ammoItem) {
      const current = Number(ammoItem.system.uses) || 0;
      const next = Math.max(0, current - consumed.ammoCount);
      await ammoItem.update({ "system.uses": next });
      ui.notifications.info(
        game.i18n.format("DWAUTO.Attack.AmmoConsumed", { name: ammoItem.name, count: consumed.ammoCount, remaining: next })
      );
    }
  }
}

function promptWeaponChoice(actor, ranged, extraDice) {
  const allWeapons = actor.items.filter(
    (i) => i.type === "equipment" && i.system?.itemType === "weapon" && !isAmmoItem(i)
  );

  // 무브 종류(근접/사격)에 맞는 무기만 먼저 보여준다. 태그가 없거나 애매해서
  // 둘 중 어느 쪽으로도 안 걸리는 무기가 있으면(홈브루 장비 등) 목록이 텅 비지
  // 않도록 전체 무기로 되돌아간다.
  const matching = allWeapons.filter((w) => (ranged ? isRangedWeapon(w) : isMeleeWeapon(w)));
  const weapons = matching.length > 0 ? matching : allWeapons;

  if (weapons.length === 0) {
    ui.notifications.warn(game.i18n.format("DWAUTO.Attack.NoWeapons", { name: actor.name }));
    return;
  }

  const weaponOptions = weapons
    .map((w) => `<option value="${w.id}">${w.name}${w.system.tagsString ? ` (${w.system.tagsString})` : ""}</option>`)
    .join("");

  new Dialog({
    title: game.i18n.localize("DWAUTO.Attack.WeaponDialogTitle"),
    content: `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize("DWAUTO.Attack.WeaponLabel")}</label>
          <select name="weapon">${weaponOptions}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("DWAUTO.Attack.ModLabel")}</label>
          <input type="number" name="mod" value="0">
        </div>
      </form>
    `,
    buttons: {
      roll: {
        label: game.i18n.localize("DWAUTO.Attack.RollButton"),
        callback: (html) => {
          const weapon = actor.items.get(html.find('[name="weapon"]').val());
          const dmgMod = Number(html.find('[name="mod"]').val()) || 0;
          if (weapon) handleAmmoAndRoll(actor, weapon, dmgMod, extraDice);
        }
      },
      cancel: { label: game.i18n.localize("DWAUTO.Cancel") }
    },
    default: "roll"
  }).render(true);
}

async function promptDamageRoll(actor, ranged, isExtreme) {
  const content = isExtreme
    ? `<p>${game.i18n.format("DWAUTO.Attack.ConfirmContentExtreme", { name: actor.name })}</p>`
    : `<p>${game.i18n.format("DWAUTO.Attack.ConfirmContent", { name: actor.name })}</p>`;

  const confirmed = await Dialog.confirm({
    title: game.i18n.localize("DWAUTO.Attack.ConfirmTitle"),
    content,
    defaultYes: true
  });
  if (!confirmed) return;

  promptWeaponChoice(actor, ranged);
}

// 무브 자체의 "Choose N" 문구로 개수를 추정해보되(getMoveChoiceData), 설정
// 표에서 GM이 직접 지정한 개수(overrideCount)가 있으면 그걸 우선한다 — 번역되면
// "Choose N" 문구 자체가 사라져서 자동 추정이 안 통하는 경우가 있기 때문이다.
function resolvePickCount(autoCount, overrideCount) {
  if (Number.isFinite(overrideCount) && overrideCount > 0) return overrideCount;
  return autoCount || 1;
}

// 무브 아이템의 choices를 보여주고, 고른 선택지 안에 주사위 표기(1d6, [[1d6]] 등)가
// 있으면 그 값을 보너스 데미지로 붙여서 무기 데미지 굴림까지 이어간다
// (Backstab: "통상적인 피해 +1d6을 줍니다"를 골랐을 때만 데미지를 굴림).
function handleGatedChoiceAttack(actor, moveItem, result, ranged, overrideCount) {
  const { options, count } = getMoveChoiceData(moveItem, result);

  promptChoiceSelection({
    title: moveItem.name,
    options,
    count: resolvePickCount(count, overrideCount),
    onConfirm: (selected) => {
      announceActionApplied(actor, moveItem.name, selected.join(", "));

      const bonusDice = selected.map(extractInlineRoll).find((d) => d);
      if (bonusDice) {
        promptWeaponChoice(actor, ranged, bonusDice);
      }
    }
  });
}

// 무브의 choices가 데미지 여부를 좌우하지 않는 경우(Called Shot: 선택지는
// 머리/팔/다리 같은 연출용이고, 데미지는 결과 등급만으로 결정됨). 선택지를
// 먼저 보여주고, 그 뒤 필요하면 원래 데미지 굴림 절차로 이어간다.
function handleFlavorChoiceAttack(actor, moveItem, result, ranged, shouldDamage, isExtreme, overrideCount) {
  const { options, count } = getMoveChoiceData(moveItem, result);

  const proceed = () => {
    if (shouldDamage) promptDamageRoll(actor, ranged, isExtreme);
  };

  if (options.length === 0) {
    proceed();
    return;
  }

  promptChoiceSelection({
    title: moveItem.name,
    options,
    count: resolvePickCount(count, overrideCount),
    onConfirm: (selected) => {
      announceActionApplied(actor, moveItem.name, selected.join(", "));
      proceed();
    },
    onCancel: proceed
  });
}

function onCreateChatMessage(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_ATTACK_ASSISTANT)) return;
  // 굴린 사람의 클라이언트에서만 후속 다이얼로그를 띄운다 (다른 접속자 전원에게 뜨는 것 방지).
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title, result } = info;
  if (result !== "success" && result !== "partial") return;

  const moveItem = findMoveItem(actor, title);

  // 1) "특수 공격 무브" 설정 표(Backstab/Called Shot처럼 선택지에 따라 거동이
  //    달라지는 무브)에 이름이 등록되어 있는지 먼저 확인한다.
  const specialMoves = game.settings.get(MODULE_ID, SETTINGS.SPECIAL_ATTACK_MOVES);
  const special = specialMoves.find((m) => m.name === title);
  let behavior = special
    ? {
        ranged: special.ranged,
        damageOnPartial: special.damageOnPartial,
        damageOnSuccess: special.damageOnSuccess,
        choiceGatesDamage: special.gatesDamage,
        pickCount: result === "success" ? special.successPickCount : special.partialPickCount
      }
    : null;

  // 2) 없으면 근접/사격 무브 이름 목록(Hack & Slash/Volley류, 선택지 없이 항상
  //    데미지를 굴리는 단순한 무브)으로 폴백한다.
  if (!behavior) {
    const meleeNames = splitCommaList(SETTINGS.MELEE_MOVE_NAMES);
    const rangedNames = splitCommaList(SETTINGS.RANGED_MOVE_NAMES);
    const isRangedName = rangedNames.includes(title);
    if (!meleeNames.includes(title) && !isRangedName) return;
    behavior = { ...DEFAULT_ATTACK_BEHAVIOR, ranged: isRangedName };
  }

  // 극단적 성공(12+)은 데미지 굴림 확인 다이얼로그 문구에 반영되고
  // (promptDamageRoll 참고), Fighter Superior Warrior처럼 근접 무브의 12+를
  // 소비하는 무브가 있으면 별도로 채팅에 알린다.
  if (result === "success" && info.isExtreme && !behavior.ranged) {
    const superiorWarriorNames = splitCommaList(SETTINGS.SUPERIOR_WARRIOR_MOVE_NAMES);
    const superiorWarriorMove = actor.items.find(
      (i) => i.type === "move" && superiorWarriorNames.includes(i.name)
    );
    if (superiorWarriorMove) {
      announceActionApplied(actor, superiorWarriorMove.name, game.i18n.localize("DWAUTO.SuperiorWarrior.Applied"));
    }
  }

  const shouldDamage = result === "success" ? behavior.damageOnSuccess : behavior.damageOnPartial;
  const hasChoices = moveItem && getMoveChoiceData(moveItem, result).options.length > 0;

  if (hasChoices && behavior.choiceGatesDamage) {
    handleGatedChoiceAttack(actor, moveItem, result, behavior.ranged, behavior.pickCount);
  } else if (hasChoices) {
    handleFlavorChoiceAttack(actor, moveItem, result, behavior.ranged, shouldDamage, info.isExtreme, behavior.pickCount);
  } else if (shouldDamage) {
    promptDamageRoll(actor, behavior.ranged, info.isExtreme);
  }
}

export function registerAttackAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
