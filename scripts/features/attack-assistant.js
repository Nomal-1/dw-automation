import { MODULE_ID, SETTINGS } from "../constants.js";
import { TAG_CATALOG } from "../data/tag-catalog.js";
import { DEFAULT_ATTACK_BEHAVIOR } from "../data/attack-moves.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { getMoveChoiceData, promptChoiceSelection, extractInlineRoll } from "../lib/move-choices.js";
import { announceActionApplied } from "../lib/announce.js";
import { getActiveOngoingSpells, removeActiveOngoingSpell } from "../lib/ongoing-spells-state.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import { incrementBalanceOnDamage, applyDamageDieOverride, getFormshaperDamageBonus } from "./druid.js";
import { getCommandDamageBonus } from "./command.js";
import { getPendingDamageForward, clearPendingDamageForward } from "../lib/damage-forward-state.js";

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

// 바바리안 Musclebound: "무기를 쥐고 있는 동안 그 무기는 forceful/messy
// 태그를 갖는다." 무기의 실제 tagsString과 무관하게 이 무브를 가진
// 액터라면 항상 적용되는 "가상 태그"라, TAG_CATALOG를 그대로 재사용하되
// 무기 문자열 매칭 대신 무브 소지 여부로 판정한다.
function hasMusclebound(actor) {
  const names = splitCommaList(SETTINGS.MUSCLEBOUND_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

// 모듈 설정(태그 자동 반영 목록)에서 켜둔 태그만 검사한다.
// "raw" 타입은 매칭된 태그 원문(예: "1 piercing", "+1 damage")을 그대로 반환한다 —
// 이 문자열을 채팅 메시지에 노출시켜 두면, 던전월드 시스템의 네이티브 피해 적용
// 버튼(전체/절반/두배/치유)이 클릭 시 메시지 텍스트를 정규식으로 훑어서 알아서
// 관통/방어구무시/데미지보너스를 반영해준다(dungeonworld/module/chat.js의
// _chatActionDamage 참고). 그래서 여기서는 절대 수식에 더하면 안 된다 — 더하면
// 버튼을 눌렀을 때 이중으로 반영된다.
// "note" 타입은 시스템이 자동화해주지 않는 서술형 태그라 참고 문구로만 보여준다.
function getTagDisplay(weapon, actor) {
  const enabled = game.settings.get(MODULE_ID, SETTINGS.ENABLED_DAMAGE_TAGS);
  const tagsString = weapon.system?.tagsString ?? "";

  const rawTags = [];
  const notes = [];
  const noteKeysAdded = new Set();

  for (const tag of TAG_CATALOG) {
    if (!enabled.includes(tag.key)) continue;
    const match = tagsString.match(tag.pattern);
    if (!match) continue;

    if (tag.effect === "raw") {
      rawTags.push(match[0]);
    } else {
      notes.push(game.i18n.format(tag.noteKey, { n: match[1] ?? "" }));
      noteKeysAdded.add(tag.key);
    }
  }

  if (actor && hasMusclebound(actor)) {
    for (const key of ["forceful", "messy"]) {
      if (noteKeysAdded.has(key) || !enabled.includes(key)) continue;
      const tag = TAG_CATALOG.find((t) => t.key === key);
      notes.push(game.i18n.localize(tag.noteKey));
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

async function rollDamage(actor, weapon, dmgMod, extraDice, extraRawTags = []) {
  let die = actor.system.attributes?.damage?.value || "d6";
  die = applyDamageDieOverride(actor, die);
  const miscBonus = actor.system.attributes?.damage?.misc || "";

  let formula = die;
  formula = appendTerm(formula, miscBonus);
  formula = appendTerm(formula, extraDice);
  formula = appendTerm(formula, getFormshaperDamageBonus(actor));
  formula = appendTerm(formula, dmgMod);

  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();

  const { rawTags, notes } = getTagDisplay(weapon, actor);
  rawTags.push(...extraRawTags);

  const rollHtml = await roll.render();

  const content = `
    <h3>${game.i18n.format("DWAUTO.Attack.DamageFlavor", { weapon: weapon.name })}</h3>
    ${rawTags.length ? `<p class="dwauto-raw-tags">${rawTags.join(", ")}</p>` : ""}
    ${notes.length ? `<ul class="dwauto-tag-notes"><li>${notes.join("</li><li>")}</li></ul>` : ""}
    ${rollHtml}
    <div class="chat-damage-buttons">
      <button type="button" class="button damage full-damage" data-action="damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyFullTitle")}"><i class="fas fa-user-minus"></i></button>
      <button type="button" class="button damage half-damage" data-action="half-damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyHalfTitle")}"><i class="fas fa-user-minus"></i> 1/2</button>
      <button type="button" class="button damage double-damage" data-action="double-damage" title="${game.i18n.localize("DWAUTO.Attack.ApplyDoubleTitle")}"><i class="fas fa-user-minus"></i> 2X</button>
      <button type="button" class="button heal heal-damage" data-action="heal" title="${game.i18n.localize("DWAUTO.Attack.ApplyHealTitle")}"><i class="fas fa-user-plus"></i></button>
    </div>
  `;

  const chatData = {
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  };

  // Roll#toMessage로 메시지를 만들면 Foundry가 이 메시지를 "굴림" 타입으로
  // 취급해서, 굴림 부분을 매 클라이언트마다(공개 여부에 따라) 자체적으로 다시
  // 렌더링하며 우리가 content에 넣어둔 태그 문구/버튼을 통째로 무시해버린다
  // (비공개/블라인드 굴림을 클라이언트별로 다르게 보여주기 위한 동작). 이걸
  // 피하려고 actor.js의 rollMove(시스템 자체의 무브 굴림)와 완전히 같은
  // 방식으로, 렌더링된 굴림 HTML을 직접 content에 심고 ChatMessage.create로
  // 평범한 메시지를 만든다. Dice So Nice 3D 주사위 연동도 시스템과 동일하게
  // 수동으로 호출해줘야 한다(rolls 배열을 안 붙이므로 자동으로 안 뜬다).
  if (game.dice3d) {
    await game.dice3d.showForRoll(roll, game.user, true, null, false);
  } else {
    chatData.sound = CONFIG.sounds.dice;
  }
  await ChatMessage.create(chatData);

  await incrementBalanceOnDamage(actor);
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

// 척살(Exterminatus)처럼 "조건 미충족" 쪽 페널티가 붙는 무브는, 맹세한 적이
// 도망쳐서 한동안 다른 적만 상대하는 구간에 매번 "아니오"를 눌러야 해서
// 번거롭다. 캐릭터 시트에 토글 배지를 하나 붙여서, 켜두면 그 무브는 물어보지
// 않고 매번 자동으로 "아니오"(noFormula)를 적용한다. 실제 값은 액터 플래그로
// 저장한다.
const AUTO_NO_FLAG = "conditionalDamageAutoNo";

function getAutoNoLocks(actor) {
  return actor.getFlag(MODULE_ID, AUTO_NO_FLAG) ?? [];
}

async function setAutoNoLock(actor, moveName, locked) {
  const current = getAutoNoLocks(actor);
  const next = locked ? Array.from(new Set([...current, moveName])) : current.filter((n) => n !== moveName);
  await actor.setFlag(MODULE_ID, AUTO_NO_FLAG, next);
}

// 척살(Exterminatus)처럼 "적을 지정해야만" 효과 자체가 존재하는 무브
// (requiresDesignation: true)를 위한 별도 플래그. 비지정 상태면 이 무브는
// 질문도, 보너스도, 페널티도 전혀 없이 완전히 무시된다 — 아직 대상을
// 선언하지 않았거나 이미 쓰러뜨려서 효과가 끝난 상태를 나타낸다.
const DESIGNATION_FLAG = "conditionalDamageDesignated";

function getDesignations(actor) {
  return actor.getFlag(MODULE_ID, DESIGNATION_FLAG) ?? [];
}

async function setDesignation(actor, moveName, designated) {
  const current = getDesignations(actor);
  const next = designated ? Array.from(new Set([...current, moveName])) : current.filter((n) => n !== moveName);
  await actor.setFlag(MODULE_ID, DESIGNATION_FLAG, next);
}

// Paladin Smite/Holy Smite/Exterminatus, Ranger Viper's Strike/Fangs처럼
// "특정 조건을 만족하면 데미지 주사위를 추가로(또는 페널티로) 굴리는"
// 무브들. 조건(퀘스트 중인지, 겸용 공격을 했는지 등)을 자동 판정할 수
// 없어서 하나씩 Y/N으로 물어보고, 대답에 따라 yesFormula 또는 noFormula를
// 데미지 공식에 이어붙인다. 해당 무브가 없으면 조용히 빈 문자열을 반환한다.
// "자동 아니오" 토글이 켜진 무브는 물어보지 않고 바로 noFormula를 적용한다.
async function promptConditionalDamageBonuses(actor) {
  const table = game.settings.get(MODULE_ID, SETTINGS.CONDITIONAL_DAMAGE_MOVES);
  const owned = table.filter((row) => actor.items.some((i) => i.type === "move" && i.name === row.name));
  if (owned.length === 0) return "";

  const locks = getAutoNoLocks(actor);
  const designations = getDesignations(actor);
  let extra = "";
  for (const row of owned) {
    if (row.requiresDesignation && !designations.includes(row.name)) continue;

    const confirmed = locks.includes(row.name)
      ? false
      : await Dialog.confirm({
          title: row.name,
          content: `<p>${game.i18n.format("DWAUTO.ConditionalDamage.Prompt", { name: row.name })}</p>`,
          defaultYes: false
        });

    const formula = confirmed ? row.yesFormula : row.noFormula;
    if (formula && formula.trim() && formula.trim() !== "0") {
      extra = appendTerm(extra, formula);
      const messageKey = confirmed
        ? "DWAUTO.ConditionalDamage.Yes"
        : row.requiresDesignation
          ? "DWAUTO.ConditionalDamage.ReverseNo"
          : "DWAUTO.ConditionalDamage.No";
      announceActionApplied(actor, row.name, game.i18n.format(messageKey, { formula: formula.trim() }));
    }
  }
  return extra;
}

// Ranger Smaug's Belly처럼 "특정 조건을 만족하면 이번 공격에 데미지 태그
// 원문(예: "2 piercing")을 하나 추가로 붙이는" 무브들. promptConditionalDamageBonuses와
// 같은 Y/N 질문 패턴이지만, 주사위 공식이 아니라 원문 문자열 배열을 반환해서
// rollDamage의 rawTags에 그대로 얹는다("아니오"면 아무것도 붙지 않는다).
// "자동 아니오" 잠금은 conditional damage moves와 같은 플래그를 공유한다
// (액터+무브 이름으로 구분되므로 표가 달라도 충돌하지 않는다).
async function promptConditionalTagMoves(actor) {
  const table = game.settings.get(MODULE_ID, SETTINGS.CONDITIONAL_TAG_MOVES);
  const owned = table.filter((row) => actor.items.some((i) => i.type === "move" && i.name === row.name));
  if (owned.length === 0) return [];

  const locks = getAutoNoLocks(actor);
  const tags = [];
  for (const row of owned) {
    const confirmed = locks.includes(row.name)
      ? false
      : await Dialog.confirm({
          title: row.name,
          content: `<p>${game.i18n.format("DWAUTO.ConditionalTagMoves.Prompt", { name: row.name })}</p>`,
          defaultYes: false
        });

    if (confirmed) {
      tags.push(row.tag);
      announceActionApplied(actor, row.name, game.i18n.format("DWAUTO.ConditionalTagMoves.Yes", { tag: row.tag }));
    }
  }
  return tags;
}

const WEAPON_USES_TAG_PATTERN = /^(\d+)\s*uses?$/i;

function parseWeaponTagsArray(item) {
  try {
    const raw = item.system?.tags;
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function weaponTagsArrayToString(tagsArray) {
  return tagsArray.map((t) => t?.value ?? "").join(", ");
}

// 소각술사 불타는 낙인처럼 "N uses" 태그를 가진 무기는 공격할 때마다(근접/
// 사격 구분 없이) 사용 횟수가 1씩 준다(원문: "Each attack with the weapon
// consumes one use"). 0이 되면 태그만 지우는 게 아니라 아이템 자체를
// 삭제한다 — 이름만 바꿔두면 인벤토리에 그대로 남아 계속 공격에 쓸 수
// 있어서, "다 쓴 무기는 더 이상 선택조차 안 되게" 하려면 실제로 지워야
// 한다. 무기에 이 태그가 아예 없으면 조용히 아무것도 하지 않는다.
async function consumeWeaponUses(weapon) {
  const tags = parseWeaponTagsArray(weapon);
  let matchedIndex = -1;
  let oldValue = 0;

  for (let i = 0; i < tags.length; i++) {
    const match = WEAPON_USES_TAG_PATTERN.exec((tags[i]?.value ?? "").trim());
    if (match) {
      matchedIndex = i;
      oldValue = Number(match[1]) || 0;
      break;
    }
  }
  if (matchedIndex === -1) return;

  const newValue = oldValue - 1;
  const spent = newValue <= 0;
  const actor = weapon.actor;
  const weaponName = weapon.name;

  if (spent) {
    await weapon.delete();
  } else {
    const nextTags = [...tags];
    nextTags[matchedIndex] = { value: `${newValue} uses` };
    await weapon.update({
      "system.tags": JSON.stringify(nextTags),
      "system.tagsString": weaponTagsArrayToString(nextTags)
    });
  }

  if (actor) {
    announceActionApplied(
      actor,
      weaponName,
      game.i18n.format(
        spent ? "DWAUTO.Attack.WeaponUsesSpent" : "DWAUTO.Attack.WeaponUsesRemaining",
        { remaining: Math.max(0, newValue) }
      )
    );
  }
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
  const conditionalTags = await promptConditionalTagMoves(actor);
  const commandBonus = getCommandDamageBonus(actor);
  const damageForward = getPendingDamageForward(actor);
  const finalExtraDice = appendTerm(
    appendTerm(appendTerm(extraDice || "", conditionalExtra), commandBonus),
    damageForward ? String(damageForward.amount) : ""
  );
  const finalDmgMod = (Number(dmgMod) || 0) + augBonus;

  await rollDamage(actor, weapon, finalDmgMod, finalExtraDice, conditionalTags);
  await consumeWeaponUses(weapon);

  if (damageForward) {
    await clearPendingDamageForward(actor);
    announceActionApplied(
      actor,
      damageForward.source,
      game.i18n.format("DWAUTO.ArcaneArt.DamageForwardConsumed", { amount: `+${damageForward.amount}` })
    );
  }

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
  // (promptDamageRoll 참고), Fighter Superior Warrior/바바리안 Smash!처럼
  // 근접 무브의 12+를 소비하는 무브가 있으면 별도로 채팅에 알린다. 둘 다
  // "근접 무브에서 12+가 뜨면"이라는 같은 조건이라 같은 자리에서 처리하되,
  // 원문 문구가 서로 달라 메시지는 각자 설정 표를 쓴다.
  if (result === "success" && info.isExtreme && !behavior.ranged) {
    const superiorWarriorNames = splitCommaList(SETTINGS.SUPERIOR_WARRIOR_MOVE_NAMES);
    const superiorWarriorMove = actor.items.find(
      (i) => i.type === "move" && superiorWarriorNames.includes(i.name)
    );
    if (superiorWarriorMove) {
      announceActionApplied(actor, superiorWarriorMove.name, game.i18n.localize("DWAUTO.SuperiorWarrior.Applied"));
    }

    const smashNames = splitCommaList(SETTINGS.SMASH_MOVE_NAMES);
    const smashMove = actor.items.find((i) => i.type === "move" && smashNames.includes(i.name));
    if (smashMove) {
      announceActionApplied(actor, smashMove.name, game.i18n.localize("DWAUTO.Smash.Applied"));
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

// 캐릭터 시트의 무브 목록에 "자동 아니오" 토글 배지를 붙인다. 클릭할 때마다
// 켜짐/꺼짐이 바뀌고, 켜져 있으면 데미지를 굴릴 때 그 무브는 물어보지 않고
// 바로 noFormula를 적용한다(척살이 도망친 적을 쫓는 동안 매번 "아니오"를
// 누르지 않아도 되도록).
function onRenderActorSheet(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_ATTACK_ASSISTANT)) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const table = game.settings.get(MODULE_ID, SETTINGS.CONDITIONAL_DAMAGE_MOVES);
  const locks = getAutoNoLocks(actor);
  const designations = getDesignations(actor);

  for (const row of table) {
    const moveItem = actor.items.find((i) => i.type === "move" && i.name === row.name);
    if (!moveItem) continue;

    const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
    if (!$item.length) continue;

    const $tags = getOrCreateTagsContainer($item);

    const designated = designations.includes(row.name);

    // 척살처럼 대상 지정이 필요한 무브: 지정/비지정 배지를 붙인다.
    // 비지정 상태에서는 이 무브 자체가 완전히 무시되므로, "자동 아니오"
    // 배지는 지정된 상태에서만 의미가 있어 같이 붙인다.
    if (row.requiresDesignation && !$tags.find(".dwauto-designation-badge").length) {
      const $designationBadge = $(
        `<a class="tag dwauto-designation-badge${designated ? " dwauto-designation-on" : ""}" title="${game.i18n.localize("DWAUTO.ConditionalDamage.DesignationTitle")}">${game.i18n.localize(designated ? "DWAUTO.ConditionalDamage.DesignationOn" : "DWAUTO.ConditionalDamage.DesignationOff")}</a>`
      );
      $tags.append($designationBadge);

      $designationBadge.on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await setDesignation(actor, row.name, !designated);
      });
    }

    if (row.requiresDesignation && !designated) continue;

    if (!$tags.find(".dwauto-autono-badge").length) {
      const locked = locks.includes(row.name);
      const noFormula = (row.noFormula || "").trim() || "0";
      const label = locked
        ? game.i18n.format("DWAUTO.ConditionalDamage.AutoNoOn", { formula: noFormula })
        : game.i18n.localize("DWAUTO.ConditionalDamage.AutoNoOff");

      const $badge = $(
        `<a class="tag dwauto-autono-badge${locked ? " dwauto-autono-on" : ""}" title="${game.i18n.localize("DWAUTO.ConditionalDamage.AutoNoTitle")}">${label}</a>`
      );
      $tags.append($badge);

      $badge.on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await setAutoNoLock(actor, row.name, !locked);
      });
    }
  }

  const tagTable = game.settings.get(MODULE_ID, SETTINGS.CONDITIONAL_TAG_MOVES);
  for (const row of tagTable) {
    const moveItem = actor.items.find((i) => i.type === "move" && i.name === row.name);
    if (!moveItem) continue;

    const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
    if (!$item.length) continue;

    const $tags = getOrCreateTagsContainer($item);
    if ($tags.find(".dwauto-autono-badge").length) continue;

    const locked = locks.includes(row.name);
    const label = locked
      ? game.i18n.format("DWAUTO.ConditionalTagMoves.AutoNoOn", { tag: row.tag })
      : game.i18n.localize("DWAUTO.ConditionalTagMoves.AutoNoOff");

    const $badge = $(
      `<a class="tag dwauto-autono-badge${locked ? " dwauto-autono-on" : ""}" title="${game.i18n.localize("DWAUTO.ConditionalTagMoves.AutoNoTitle")}">${label}</a>`
    );
    $tags.append($badge);

    $badge.on("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await setAutoNoLock(actor, row.name, !locked);
    });
  }
}

export function registerAttackAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
