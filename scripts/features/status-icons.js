import { MODULE_ID } from "../constants.js";
import { PARTY_STATUS_FLAGS } from "../data/party-status.js";
import { activeGM } from "../lib/gm-query.js";

// Shows dw-automation's hidden actor flags (pending bonuses, ongoing states) as display-only
// ActiveEffects so players can see them as token status icons and on the sheet.
//
// The flag stays the source of truth. The effect is a mirror with no changes: deleting the icon
// does not turn the state off (it comes back on the next sync), and nothing reads the effect.
// Only the active GM writes the mirrors, so there is one writer and no duplicates.

export const STATUS_ICON_SETTING = "statusEffectIcons";
const MIRROR_FLAG = "statusMirror";

// Which flags get an icon, and which core icon. Flags not listed here stay GM-screen only.
const ICONS = {
  pendingRollBonus: "icons/svg/upgrade.svg",
  pendingDamageForward: "icons/svg/sword.svg",
  pendingHeistBonus: "icons/svg/upgrade.svg",
  pendingSpellEffectBonus: "icons/svg/upgrade.svg",
  saferPlaceForwardPending: "icons/svg/upgrade.svg",
  recruitPenaltyPending: "icons/svg/downgrade.svg",
  knowItAllPending: "icons/svg/book.svg",
  iAmTheLawPending: "icons/svg/upgrade.svg",
  defendVengeancePending: "icons/svg/upgrade.svg",
  everOnwardArmorPending: "icons/svg/shield.svg",
  defendReserve: "icons/svg/shield.svg",
  divineHold: "icons/svg/angel.svg",
  trapExpertHold: "icons/svg/hazard.svg",
  communePenaltyCount: "icons/svg/downgrade.svg",
  seeingRedActive: "icons/svg/eye.svg",
  throughDeathsEyesActive: "icons/svg/skull.svg",
  loveTruckActive: "icons/svg/aura.svg",
  onTheMoveActive: "icons/svg/wingfoot.svg",
  heraclesActive: "icons/svg/aura.svg",
  duelistParryActive: "icons/svg/shield.svg",
  druidShapeshift: "icons/svg/statue.svg",
  dopplegangersDanceHiding: "icons/svg/invisible.svg",
  underdogConditionActive: "icons/svg/aura.svg",
  indestructibleHungerPenalty: "icons/svg/downgrade.svg"
  // twiceAsBrightUsed: a "used" marker, not a state on the character — no icon
};

const label = (flag) => game.i18n.localize(`DWAUTO.GmScreen.Status.${flag}`);

function isEnabled() {
  try {
    return !!game.settings.get(MODULE_ID, STATUS_ICON_SETTING);
  } catch (err) {
    return false;
  }
}

/** The mirror effects this actor should have now: Map(flag -> { name, img }). */
export function desiredMirrors(actor) {
  const out = new Map();
  if (!isEnabled()) return out;
  const flags = actor.flags?.[MODULE_ID] ?? {};
  for (const def of PARTY_STATUS_FLAGS) {
    const img = ICONS[def.flag];
    if (!img) continue;
    const value = flags[def.flag];
    if (value === undefined || value === null || value === false || value === 0) continue;
    let name = label(def.flag);
    if (def.kind === "number") {
      const n = Number(value) || 0;
      if (n <= 0) continue;
      name = `${name} ${n}`;
    } else if (def.kind === "bonus") {
      const amount = Number(value?.amount) || 0;
      if (!amount) continue;
      name = `${name} ${amount > 0 ? "+" : ""}${amount}`;
    }
    out.set(def.flag, { name, img });
  }
  return out;
}

const mirrorsOf = (actor) => actor.effects.filter((e) => e.getFlag(MODULE_ID, MIRROR_FLAG));

/** Make the actor's mirror effects match its flags. Only the active GM writes. */
export async function syncStatusIcons(actor) {
  if (!actor || actor.type !== "character" || !game.user.isGM || activeGM()?.id !== game.user.id) return;
  const want = desiredMirrors(actor);
  const have = mirrorsOf(actor);
  const toDelete = [];
  const toUpdate = [];
  const seen = new Set();
  for (const effect of have) {
    const flag = effect.getFlag(MODULE_ID, MIRROR_FLAG);
    const target = want.get(flag);
    if (!target || seen.has(flag)) {
      toDelete.push(effect.id);
      continue;
    }
    seen.add(flag);
    if (effect.name !== target.name || effect.img !== target.img) toUpdate.push({ _id: effect.id, name: target.name, img: target.img });
  }
  const description = game.i18n.localize("DWAUTO.StatusIcons.EffectDescription");
  const toCreate = [...want]
    .filter(([flag]) => !seen.has(flag))
    .map(([flag, { name, img }]) => ({
      name,
      img,
      description,
      showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
      transfer: false,
      flags: { [MODULE_ID]: { [MIRROR_FLAG]: flag } }
    }));
  try {
    if (toDelete.length) await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete, { dwautoStatusSync: true });
    if (toUpdate.length) await actor.updateEmbeddedDocuments("ActiveEffect", toUpdate, { dwautoStatusSync: true });
    if (toCreate.length) await actor.createEmbeddedDocuments("ActiveEffect", toCreate, { dwautoStatusSync: true });
  } catch (err) {
    console.warn(`${MODULE_ID} | status icon sync failed for ${actor.name}`, err);
  }
}

const timers = new Map();
function queueSync(actor) {
  if (!actor) return;
  clearTimeout(timers.get(actor.id));
  timers.set(
    actor.id,
    setTimeout(() => {
      timers.delete(actor.id);
      syncStatusIcons(game.actors.get(actor.id) ?? actor);
    }, 150)
  );
}

function syncAll() {
  for (const actor of game.actors) if (actor.type === "character") queueSync(actor);
}

export function registerStatusIconSettings() {
  game.settings.register(MODULE_ID, STATUS_ICON_SETTING, {
    name: "DWAUTO.StatusIcons.SettingName",
    hint: "DWAUTO.StatusIcons.SettingHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => syncAll()
  });
}

export function registerStatusIcons() {
  Hooks.once("ready", () => syncAll());
  Hooks.on("updateActor", (actor, changes) => {
    if (changes?.flags?.[MODULE_ID] !== undefined || Object.keys(changes?.flags ?? {}).some((k) => k.startsWith(`-=${MODULE_ID}`))) queueSync(actor);
  });
  Hooks.on("createActor", (actor) => queueSync(actor));
  // A GM who joins later (or becomes the active GM) brings the icons up to date.
  Hooks.on("userConnected", () => syncAll());
  // Someone deleted a mirror by hand: the state is still on, so put the icon back.
  Hooks.on("deleteActiveEffect", (effect, options) => {
    if (options?.dwautoStatusSync || !effect.getFlag(MODULE_ID, MIRROR_FLAG)) return;
    if (effect.parent instanceof Actor) queueSync(effect.parent);
  });
}
