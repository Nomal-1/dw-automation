import { MODULE_ID, SETTINGS } from "../constants.js";
import { TAG_CATALOG } from "../data/tag-catalog.js";

// "Hack & Slash" / "Volley" 채팅 카드의 구조 (dungeonworld/templates/chat/chat-move.html):
//   <section><div class="... chat-card move-card" data-actor-id="...">
//     <h2 class="cell__title">{{move name}}</h2>
//     <div class="row result success|partial|failure">...</div>
// 번역 모듈로 무브 이름이 바뀐 테이블이면 설정에서 이름을 맞춰주면 된다.

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 근접/사격 판정: 무기 태그(tagsString)에 설정된 키워드(기본값 "near, far")가
// 하나라도 포함되어 있으면 사격 무기로 취급한다. 던전월드 기본 무기는 근접이
// hand/close/reach, 사격이 near/far 태그를 쓰는 관례를 이용한 것으로, 무기 자체에
// "근접"/"사격"을 구분하는 별도 필드가 있는 게 아니다. 이 키워드 목록은
// 모듈 설정(사격 공격 판정 태그)에서 직접 편집할 수 있다.
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

async function rollDamage(actor, weapon, dmgMod) {
  const die = actor.system.attributes?.damage?.value || "d6";
  const miscBonus = actor.system.attributes?.damage?.misc || "";

  let formula = die;
  if (miscBonus) formula += `+${miscBonus}`;
  if (dmgMod) formula += `+${dmgMod}`;

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

async function handleAmmoAndRoll(actor, weapon, dmgMod) {
  let consumed = null;

  if (isRangedWeapon(weapon)) {
    const ammoItems = actor.items.filter((i) => i.type === "equipment" && isAmmoItem(i));
    if (ammoItems.length > 0) {
      consumed = await promptAmmo(ammoItems);
    }
  }

  await rollDamage(actor, weapon, dmgMod);

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

function promptWeaponChoice(actor) {
  const weapons = actor.items.filter(
    (i) => i.type === "equipment" && i.system?.itemType === "weapon" && !isAmmoItem(i)
  );
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
          if (weapon) handleAmmoAndRoll(actor, weapon, dmgMod);
        }
      },
      cancel: { label: game.i18n.localize("DWAUTO.Cancel") }
    },
    default: "roll"
  }).render(true);
}

async function promptDamageRoll(actor) {
  const confirmed = await Dialog.confirm({
    title: game.i18n.localize("DWAUTO.Attack.ConfirmTitle"),
    content: `<p>${game.i18n.format("DWAUTO.Attack.ConfirmContent", { name: actor.name })}</p>`,
    defaultYes: true
  });
  if (!confirmed) return;

  promptWeaponChoice(actor);
}

function onCreateChatMessage(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_ATTACK_ASSISTANT)) return;
  // 굴린 사람의 클라이언트에서만 후속 다이얼로그를 띄운다 (다른 접속자 전원에게 뜨는 것 방지).
  if (userId !== game.user.id) return;

  const card = $(message.content).find(".chat-card.move-card").first();
  if (!card.length) return;

  const actor = game.actors.get(card.attr("data-actor-id"));
  if (!actor) return;

  const title = card.find(".cell__title").first().text().trim();
  const meleeNames = splitCommaList(SETTINGS.MELEE_MOVE_NAMES);
  const rangedNames = splitCommaList(SETTINGS.RANGED_MOVE_NAMES);
  if (!meleeNames.includes(title) && !rangedNames.includes(title)) return;

  const resultRow = card.find(".row.result");
  if (!resultRow.hasClass("success") && !resultRow.hasClass("partial")) return;

  promptDamageRoll(actor);
}

export function registerAttackAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
