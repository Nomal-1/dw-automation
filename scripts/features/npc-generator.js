import { MODULE_ID, SETTINGS } from "../constants.js";
import { injectActorTab, setActiveTab } from "../lib/actor-tabs.js";
import { INSTINCTS, TRAITS, NAMES } from "../data/npc-tables.js";

const TAB_KEY = "dwauto-npc";

async function rollNpc(actor) {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const instinctIdx = Math.floor(Math.random() * INSTINCTS.length);
  const traitIdx = Math.floor(Math.random() * TRAITS.length);

  await actor.update({
    name,
    [`flags.${MODULE_ID}.instinct`]: INSTINCTS[instinctIdx],
    [`flags.${MODULE_ID}.instinctNum`]: instinctIdx + 1,
    [`flags.${MODULE_ID}.trait`]: TRAITS[traitIdx],
    [`flags.${MODULE_ID}.traitNum`]: traitIdx + 1
  });

  ui.notifications.info(game.i18n.format("DWAUTO.Npc.Generated", { name }));
}

function onRenderActorSheet(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_NPC_GENERATOR)) return;
  if (app.actor?.type !== "npc") return;
  if (!game.user.isGM) return;

  const actor = app.actor;
  const instinct = actor.getFlag(MODULE_ID, "instinct");
  const instinctNum = actor.getFlag(MODULE_ID, "instinctNum");
  const trait = actor.getFlag(MODULE_ID, "trait");
  const traitNum = actor.getFlag(MODULE_ID, "traitNum");

  const $tabBody = injectActorTab({
    html,
    actor,
    tabKey: TAB_KEY,
    navLabel: game.i18n.localize("DWAUTO.Npc.TabLabel")
  });

  $tabBody.html(`
    <section class="sheet-tab dwauto-tab">
      <div class="dwauto-panel">
        <button type="button" class="dwauto-roll-btn" title="${game.i18n.localize("DWAUTO.Npc.RollButtonTitle")}">
          <i class="fas fa-dice-d20"></i> ${game.i18n.localize("DWAUTO.Npc.RollButton")}
        </button>
        <div class="dwauto-result">
          <div class="dwauto-result-row">
            <span class="dwauto-label">${game.i18n.localize("DWAUTO.Npc.Instinct")}</span>
            <span class="dwauto-value">${instinct ? `#${instinctNum} ${instinct}` : "—"}</span>
          </div>
          <div class="dwauto-result-row">
            <span class="dwauto-label">${game.i18n.localize("DWAUTO.Npc.Trait")}</span>
            <span class="dwauto-value">${trait ? `#${traitNum} ${trait}` : "—"}</span>
          </div>
        </div>
      </div>
    </section>
  `);

  $tabBody.find(".dwauto-roll-btn").on("click", async (event) => {
    event.preventDefault();
    setActiveTab(actor.id, TAB_KEY);
    await rollNpc(actor);
  });
}

export function registerNpcGenerator() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
