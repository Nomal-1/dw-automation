import { MODULE_ID, SETTINGS } from "../constants.js";
import { injectActorTab, setActiveTab } from "../lib/actor-tabs.js";

const TAB_KEY = "dwauto-monster";

// 아래 네 값은 취향껏 조정해서 쓰면 된다.
const DAMAGE_DICE = ["d4", "d6", "d8", "d10", "d12"];
const ARMOR_RANGE = [0, 2];
const HP_RANGE = [4, 10];
const COIN_RANGE = [1, 10];

function randInt([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function rollMonster(actor) {
  const damage = DAMAGE_DICE[Math.floor(Math.random() * DAMAGE_DICE.length)];
  const armor = randInt(ARMOR_RANGE);
  const hp = randInt(HP_RANGE);
  const coin = randInt(COIN_RANGE);

  await actor.update({
    "system.attributes.damage.value": damage,
    "system.attributes.ac.value": armor,
    "system.attributes.hp.value": hp,
    "system.attributes.hp.max": hp,
    [`flags.${MODULE_ID}.monsterCoin`]: coin
  });

  ui.notifications.info(game.i18n.format("DWAUTO.Monster.Generated", { name: actor.name }));
}

function onRenderActorSheet(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_MONSTER_GENERATOR)) return;
  if (app.actor?.type !== "npc") return;
  if (!game.user.isGM) return;

  const actor = app.actor;
  const coin = actor.getFlag(MODULE_ID, "monsterCoin");
  const damage = actor.system.attributes?.damage?.value;
  const armor = actor.system.attributes?.ac?.value;
  const hp = actor.system.attributes?.hp?.max;

  const $tabBody = injectActorTab({
    html,
    actor,
    tabKey: TAB_KEY,
    navLabel: game.i18n.localize("DWAUTO.Monster.TabLabel")
  });

  $tabBody.html(`
    <section class="sheet-tab dwauto-tab">
      <div class="dwauto-panel">
        <button type="button" class="dwauto-roll-btn" title="${game.i18n.localize("DWAUTO.Monster.RollButtonTitle")}">
          <i class="fas fa-dice-d20"></i> ${game.i18n.localize("DWAUTO.Monster.RollButton")}
        </button>
        <div class="dwauto-result">
          <div class="dwauto-result-row">
            <span class="dwauto-label">${game.i18n.localize("DWAUTO.Monster.DamageDie")}</span>
            <span class="dwauto-value">${damage ?? "—"}</span>
          </div>
          <div class="dwauto-result-row">
            <span class="dwauto-label">${game.i18n.localize("DWAUTO.Monster.Armor")}</span>
            <span class="dwauto-value">${armor ?? "—"}</span>
          </div>
          <div class="dwauto-result-row">
            <span class="dwauto-label">${game.i18n.localize("DWAUTO.Monster.Hp")}</span>
            <span class="dwauto-value">${hp ?? "—"}</span>
          </div>
          <div class="dwauto-result-row">
            <span class="dwauto-label">${game.i18n.localize("DWAUTO.Monster.Coin")}</span>
            <span class="dwauto-value">${coin ?? "—"}</span>
          </div>
        </div>
      </div>
    </section>
  `);

  $tabBody.find(".dwauto-roll-btn").on("click", async (event) => {
    event.preventDefault();
    setActiveTab(actor.id, TAB_KEY);
    await rollMonster(actor);
  });
}

export function registerMonsterGenerator() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
