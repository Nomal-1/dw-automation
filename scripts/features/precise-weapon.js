import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";

// 던전월드 공식 무기 태그 정밀(Precise) 원문: "It rewards careful strikes.
// You use DEX to hack and slash with this weapon, not STR." 전사 전용
// 무브가 아니라 무기 태그 자체의 효과라, 접근전(Hack & Slash)을 굴리기
// 직전에 어느 무기를 쓰는지 먼저 물어보고(features/attack-assistant.js가
// 데미지를 굴릴 때 다시 무기를 묻는 것과는 별개의, 더 이른 시점의 확인),
// 그 무기가 정밀 태그를 갖고 있으면 이번 판정에 한해 근력 대신 민첩으로
// 판정 능력치를 바꿔치기한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_PRECISE_WEAPON_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAmmoItem(item) {
  return /ammo/i.test(item.system?.tagsString ?? "");
}

function isMeleeWeapon(item) {
  const tags = (item.system?.tagsString ?? "").toLowerCase();
  const meleeKeywords = splitCommaList(SETTINGS.MELEE_WEAPON_TAGS).map((k) => k.toLowerCase());
  return meleeKeywords.some((keyword) => tags.includes(keyword));
}

function hasPreciseTag(weapon) {
  return /\bprecise\b/i.test(weapon.system?.tagsString ?? "");
}

function promptWeaponSelect(weapons) {
  const options = weapons
    .map((w) => `<option value="${w.id}">${w.name}${w.system.tagsString ? ` (${w.system.tagsString})` : ""}</option>`)
    .join("");

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title: game.i18n.localize("DWAUTO.PreciseWeapon.SelectTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.PreciseWeapon.SelectLabel")}</label>
            <select name="weapon">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => finish(html.find('[name="weapon"]').val())
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => finish(null) }
      },
      default: "ok",
      close: () => finish(null)
    }).render(true);
  });
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 지금 굴리려는 무브가
// 근접(Hack & Slash류)이 아니거나, 액터에게 무기가 없으면 아무 것도 묻지
// 않는다.
export async function promptPrecisePreRoll(item) {
  if (!isEnabled()) return { statOverride: null };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { statOverride: null };

  const meleeNames = splitCommaList(SETTINGS.MELEE_MOVE_NAMES);
  if (!meleeNames.includes(item.name)) return { statOverride: null };

  const allWeapons = actor.items.filter(
    (i) => i.type === "equipment" && i.system?.itemType === "weapon" && !isAmmoItem(i)
  );
  if (allWeapons.length === 0) return { statOverride: null };

  const meleeWeapons = allWeapons.filter(isMeleeWeapon);
  const weapons = meleeWeapons.length > 0 ? meleeWeapons : allWeapons;

  const weaponId = await promptWeaponSelect(weapons);
  if (!weaponId) return { statOverride: null };

  const weapon = actor.items.get(weaponId);
  if (!weapon || !hasPreciseTag(weapon)) return { statOverride: null };

  announceActionApplied(actor, weapon.name, game.i18n.localize("DWAUTO.PreciseWeapon.Applied"));
  return { statOverride: "DEX" };
}

export function registerPreciseWeaponAssistant() {
  // 훅이 따로 필요 없다 — roll-wrapper.js가 promptPrecisePreRoll을 직접 부른다.
}
