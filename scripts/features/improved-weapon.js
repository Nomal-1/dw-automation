import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { ENHANCEMENT_OPTIONS, RANGE_OPTIONS } from "../data/signature-weapon-tables.js";
import { getExistingSignatureWeapon } from "./signature-weapon.js";
import { ENHANCEMENTS_FLAG } from "../apps/signature-weapon-builder-app.js";

// 전사 고급액션 무기 강화(Improved Weapon) 원문: "Choose one extra
// enhancement for your signature weapon." 고유병기가 없으면 아예 적용할
// 대상이 없다고 안내하고 끝낸다. 있으면, apps/signature-weapon-builder-app.js가
// 처음 만들 때 골랐던 강화 목록(액터 플래그)을 확인해서 아직 안 고른 것들
// 중에서만 하나를 더 고르게 하고, 그 강화 하나의 효과만 기존 무기 아이템에
// 직접 얹는다(무기를 통째로 다시 만들지 않는다).
const DAMAGE_TAG_PATTERN = /^\+(\d+)\s*damage$/i;
const PIERCING_TAG_PATTERN = /^(\d+)\s*piercing$/i;

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_IMPROVED_WEAPON_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.IMPROVED_WEAPON_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Improved Weapon") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function parseTagsArray(item) {
  try {
    const raw = item.system?.tags;
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function tagsArrayToString(tagsArray) {
  return tagsArray.map((t) => t?.value ?? "").join(", ");
}

function promptEnhancementChoice(remainingOptions) {
  const radioHtml = remainingOptions
    .map(
      (o, i) => `
        <label class="dwauto-radio-row">
          <input type="radio" name="enhancement" value="${o.value}" ${i === 0 ? "checked" : ""}>
          ${o.label}
        </label>
      `
    )
    .join("");

  const extraRangeOptions = RANGE_OPTIONS.map((r) => `<option value="${r.value}">${r.label}</option>`).join("");

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title: game.i18n.localize("DWAUTO.ImprovedWeapon.Title"),
      content: `
        <form class="dwauto-wizard-form">
          <fieldset>
            <legend>${game.i18n.localize("DWAUTO.ImprovedWeapon.ChooseLabel")}</legend>
            ${radioHtml}
            <div class="dwauto-sub-choice">
              <span class="dwauto-sub-choice-label">${game.i18n.localize("DWAUTO.SignatureWeapon.VersatileLabel")}</span>
              <select name="extraRange">${extraRangeOptions}</select>
            </div>
            <div class="dwauto-sub-choice">
              <span class="dwauto-sub-choice-label">${game.i18n.localize("DWAUTO.SignatureWeapon.GlowsLabel")}</span>
              <input type="text" name="glowsCreature" placeholder="${game.i18n.localize("DWAUTO.SignatureWeapon.GlowsPlaceholder")}">
            </div>
          </fieldset>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const value = html.find('[name="enhancement"]:checked').val();
            const extraRange = html.find('[name="extraRange"]').val();
            const glowsCreature = html.find('[name="glowsCreature"]').val();
            finish({ value, extraRange, glowsCreature });
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => finish(null) }
      },
      default: "ok",
      width: 420,
      close: () => finish(null)
    }).render(true);
  });
}

async function applyEnhancementToWeapon(weapon, enhancement, extra) {
  const tags = parseTagsArray(weapon);
  let weight = Number(weapon.system?.weight) || 0;

  if (enhancement.weightMod) weight = Math.max(0, weight + enhancement.weightMod);

  if (enhancement.damageMod) {
    const idx = tags.findIndex((t) => DAMAGE_TAG_PATTERN.test((t?.value ?? "").trim()));
    if (idx === -1) {
      tags.push({ value: `+${enhancement.damageMod} damage` });
    } else {
      const match = DAMAGE_TAG_PATTERN.exec(tags[idx].value.trim());
      tags[idx] = { value: `+${(Number(match[1]) || 0) + enhancement.damageMod} damage` };
    }
  }

  if (enhancement.pierce) {
    const idx = tags.findIndex((t) => PIERCING_TAG_PATTERN.test((t?.value ?? "").trim()));
    if (idx === -1) {
      tags.push({ value: `${enhancement.pierce} piercing` });
    } else {
      const match = PIERCING_TAG_PATTERN.exec(tags[idx].value.trim());
      tags[idx] = { value: `${(Number(match[1]) || 0) + enhancement.pierce} piercing` };
    }
  }

  for (const t of enhancement.tags ?? []) {
    if (!tags.some((existing) => (existing?.value ?? "").toLowerCase() === t.toLowerCase())) {
      tags.push({ value: t });
    }
  }

  if (enhancement.needsExtraRange && extra.extraRange) {
    const rangeOpt = RANGE_OPTIONS.find((r) => r.value === extra.extraRange);
    if (rangeOpt && !tags.some((existing) => (existing?.value ?? "").toLowerCase() === rangeOpt.value.toLowerCase())) {
      tags.push({ value: rangeOpt.value });
    }
  }

  const updates = {
    "system.tags": JSON.stringify(tags),
    "system.tagsString": tagsArrayToString(tags),
    "system.weight": weight
  };

  if (enhancement.needsCreatureInput && extra.glowsCreature) {
    // lib/signature-weapon-builder.js의 computeSignatureWeapon과 같은
    // 문구다(그쪽은 처음 만들 때, 여기는 나중에 추가할 때).
    const currentDescription = weapon.system?.description ?? "";
    const addition = `${extra.glowsCreature} 앞에서 빛남`;
    updates["system.description"] = currentDescription ? `${currentDescription}<br>${addition}` : addition;
  }

  await weapon.update(updates);
  return { weight, tagsString: tagsArrayToString(tags) };
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title } = info;
    if (actor.type !== "character") return;

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const weapon = getExistingSignatureWeapon(actor);
    if (!weapon) {
      announceInfo(actor, game.i18n.localize("DWAUTO.ImprovedWeapon.NoWeapon"));
      return;
    }

    const chosen = actor.getFlag(MODULE_ID, ENHANCEMENTS_FLAG) ?? [];
    const remaining = ENHANCEMENT_OPTIONS.filter((o) => !chosen.includes(o.value));
    if (remaining.length === 0) {
      announceInfo(actor, game.i18n.localize("DWAUTO.ImprovedWeapon.AllChosen"));
      return;
    }

    const picked = await promptEnhancementChoice(remaining);
    if (!picked) return;

    const enhancement = ENHANCEMENT_OPTIONS.find((o) => o.value === picked.value);
    if (!enhancement) return;

    const { weight, tagsString } = await applyEnhancementToWeapon(weapon, enhancement, picked);
    await actor.setFlag(MODULE_ID, ENHANCEMENTS_FLAG, [...chosen, enhancement.value]);

    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.ImprovedWeapon.Applied", {
        weapon: weapon.name,
        enhancement: enhancement.label,
        weight,
        tags: tagsString
      })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | improved-weapon: onCreateChatMessage failed`, err);
  }
}

export function registerImprovedWeaponAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
