import { MODULE_ID, SETTINGS } from "../constants.js";

// "Hack & Slash" / "Volley" 채팅 카드의 구조 (dungeonworld/templates/chat/chat-move.html):
//   <section><div class="... chat-card move-card" data-actor-id="...">
//     <h2 class="cell__title">{{move name}}</h2>
//     <div class="row result success|partial|failure">...</div>
// 번역 모듈로 무브 이름이 바뀐 테이블이면 설정에서 이름을 맞춰주면 된다.

function getConfiguredNames(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTagDamageBonus(item) {
  const tagsString = item.system?.tagsString ?? "";
  const match = tagsString.match(/(\d+)\s*damage/i);
  return match ? parseInt(match[1], 10) : 0;
}

function isAmmoItem(item) {
  return /ammo/i.test(item.system?.tagsString ?? "");
}

function isRangedWeapon(item) {
  const tags = (item.system?.tagsString ?? "").toLowerCase();
  return tags.includes("near") || tags.includes("far");
}

async function rollDamage(actor, weapon, dmgMod) {
  const die = actor.system.attributes?.damage?.value || "d6";
  const miscBonus = actor.system.attributes?.damage?.misc || "";
  const tagBonus = parseTagDamageBonus(weapon);

  let formula = die;
  if (miscBonus) formula += `+${miscBonus}`;
  if (tagBonus) formula += `+${tagBonus}`;
  if (dmgMod) formula += `+${dmgMod}`;

  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();

  const flavor = `
    <h3>${game.i18n.format("DWAUTO.Attack.DamageFlavor", { weapon: weapon.name })}</h3>
    <div class="dwauto-damage-buttons">
      <button type="button" class="dwauto-apply-damage" data-op="full">${game.i18n.localize("DWAUTO.Attack.ApplyFull")}</button>
      <button type="button" class="dwauto-apply-damage" data-op="half">${game.i18n.localize("DWAUTO.Attack.ApplyHalf")}</button>
      <button type="button" class="dwauto-apply-damage" data-op="double">${game.i18n.localize("DWAUTO.Attack.ApplyDouble")}</button>
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
  const meleeNames = getConfiguredNames(SETTINGS.MELEE_MOVE_NAMES);
  const rangedNames = getConfiguredNames(SETTINGS.RANGED_MOVE_NAMES);
  if (!meleeNames.includes(title) && !rangedNames.includes(title)) return;

  const resultRow = card.find(".row.result");
  if (!resultRow.hasClass("success") && !resultRow.hasClass("partial")) return;

  promptDamageRoll(actor);
}

function onApplyDamageClick(event, message) {
  const op = event.currentTarget.dataset.op;
  const total = message.rolls?.[0]?.total ?? 0;
  const targets = Array.from(game.user.targets);

  if (targets.length === 0) {
    ui.notifications.warn(game.i18n.localize("DWAUTO.Attack.NoTargets"));
    return;
  }

  for (const token of targets) {
    token.actor?.applyDamage?.(total, { op });
  }
}

function onRenderChatMessage(message, html) {
  html.find(".dwauto-apply-damage").on("click", (event) => onApplyDamageClick(event, message));
}

export function registerAttackAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderChatMessage", onRenderChatMessage);
}
