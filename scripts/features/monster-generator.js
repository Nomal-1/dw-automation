import { MODULE_ID, SETTINGS } from "../constants.js";
import { injectActorTab, setActiveTab } from "../lib/actor-tabs.js";
import { MonsterBuilderApp } from "../apps/monster-builder-app.js";
import { formatDamageFormula, rollTreasure } from "../lib/monster-builder.js";

const TAB_KEY = "dwauto-monster";

// 던전월드 한국어 공개판 "괴물" 챕터의 "괴물 만들기" 절차(apps/
// monster-builder-app.js)로 완전히 대체됐다. 예전에는 피해 다이스/장갑/HP/
// 소지금을 서로 무관하게 무작위로 굴렸는데, 이제는 그 절차의 질문에 답하는
// 방식으로 만들고, 보물도 원문 표(피해 주사위를 굴려 1~18 결과를 찾는 방식)
// 그대로 굴린다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_MONSTER_GENERATOR);
}

function promptTreasureConditions() {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title: game.i18n.localize("DWAUTO.Monster.TreasureConditionsTitle"),
      content: `
        <form>
          <label class="dwauto-check-row">
            <input type="checkbox" name="traveling">
            ${game.i18n.localize("DWAUTO.Monster.TreasureTraveling")}
          </label>
          <label class="dwauto-check-row">
            <input type="checkbox" name="leaderBonus">
            ${game.i18n.localize("DWAUTO.Monster.TreasureLeader")}
          </label>
          <label class="dwauto-check-row">
            <input type="checkbox" name="elderBonus">
            ${game.i18n.localize("DWAUTO.Monster.TreasureElder")}
          </label>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Monster.RollTreasureButton"),
          callback: (html) =>
            finish({
              traveling: html.find('[name="traveling"]').is(":checked"),
              leaderBonus: html.find('[name="leaderBonus"]').is(":checked"),
              elderBonus: html.find('[name="elderBonus"]').is(":checked")
            })
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => finish(null) }
      },
      default: "ok",
      close: () => finish(null)
    }).render(true);
  });
}

async function rollAndAnnounceTreasure(actor) {
  const damageDie = actor.getFlag(MODULE_ID, "monsterDamageDie");
  if (!damageDie) {
    ui.notifications.warn(game.i18n.localize("DWAUTO.Monster.NoDamageDieYet"));
    return;
  }

  const conditions = await promptTreasureConditions();
  if (!conditions) return;

  const tags = actor.getFlag(MODULE_ID, "monsterTags") ?? [];
  const hoarder = tags.includes("보물지기");

  const { lines } = await rollTreasure(damageDie, { hoarder, ...conditions });

  const extraNotes = [];
  if (tags.includes("마법적")) extraNotes.push(game.i18n.localize("DWAUTO.Monster.TreasureNoteMagic"));
  if (tags.includes("신성")) extraNotes.push(game.i18n.localize("DWAUTO.Monster.TreasureNoteDivine"));
  if (tags.includes("이계")) extraNotes.push(game.i18n.localize("DWAUTO.Monster.TreasureNotePlanar"));
  if (conditions.traveling) extraNotes.push(game.i18n.localize("DWAUTO.Monster.TreasureNoteTraveling"));

  const content = `
    <h3>${game.i18n.format("DWAUTO.Monster.TreasureResultTitle", { name: actor.name })}</h3>
    <ul>${lines.map((line) => `<li>${line}</li>`).join("")}</ul>
    ${extraNotes.length ? `<ul>${extraNotes.map((n) => `<li>${n}</li>`).join("")}</ul>` : ""}
  `;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id)
  });
}

function renderResultPanel(actor) {
  const damageDie = actor.getFlag(MODULE_ID, "monsterDamageDie");
  const damageMod = actor.getFlag(MODULE_ID, "monsterDamageMod") ?? 0;
  const rollMode = actor.getFlag(MODULE_ID, "monsterRollMode") ?? null;
  const armor = actor.system.attributes?.ac?.value;
  const hp = actor.system.attributes?.hp?.max;
  const tags = actor.getFlag(MODULE_ID, "monsterTags") ?? [];
  const rangeTags = actor.getFlag(MODULE_ID, "monsterRangeTags") ?? [];
  const attackName = actor.getFlag(MODULE_ID, "monsterAttackName") ?? "";
  const reminders = actor.getFlag(MODULE_ID, "monsterReminders") ?? [];

  const damageText = damageDie ? formatDamageFormula(damageDie, damageMod, rollMode) : "—";
  const allTags = [...tags, ...rangeTags];

  return `
    <div class="dwauto-result">
      ${attackName ? `<div class="dwauto-result-row"><span class="dwauto-label">${game.i18n.localize("DWAUTO.Monster.AttackName")}</span><span class="dwauto-value">${attackName}</span></div>` : ""}
      <div class="dwauto-result-row">
        <span class="dwauto-label">${game.i18n.localize("DWAUTO.Monster.DamageDie")}</span>
        <span class="dwauto-value">
          ${damageText}
          ${rollMode === "advantage" ? `<br><small>${game.i18n.localize("DWAUTO.Monster.RollModeAdvantageNote")}</small>` : ""}
          ${rollMode === "disadvantage" ? `<br><small>${game.i18n.localize("DWAUTO.Monster.RollModeDisadvantageNote")}</small>` : ""}
        </span>
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
        <span class="dwauto-label">${game.i18n.localize("DWAUTO.Monster.Tags")}</span>
        <span class="dwauto-value">${allTags.length ? allTags.join(", ") : "—"}</span>
      </div>
      ${
        reminders.length
          ? `<div class="dwauto-result-row dwauto-monster-reminders">
               <span class="dwauto-label">${game.i18n.localize("DWAUTO.Monster.Reminders")}</span>
               <ul>${reminders.map((r) => `<li>${r}</li>`).join("")}</ul>
             </div>`
          : ""
      }
    </div>
  `;
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;
  if (app.actor?.type !== "npc") return;
  if (!game.user.isGM) return;

  const actor = app.actor;

  const $tabBody = injectActorTab({
    html,
    actor,
    tabKey: TAB_KEY,
    navLabel: game.i18n.localize("DWAUTO.Monster.TabLabel")
  });

  $tabBody.html(`
    <section class="sheet-tab dwauto-tab">
      <div class="dwauto-panel">
        <button type="button" class="dwauto-roll-btn dwauto-monster-build-btn" title="${game.i18n.localize("DWAUTO.Monster.BuildButtonTitle")}">
          <i class="fas fa-dice-d20"></i> ${game.i18n.localize("DWAUTO.Monster.BuildButton")}
        </button>
        <button type="button" class="dwauto-roll-btn dwauto-monster-treasure-btn" title="${game.i18n.localize("DWAUTO.Monster.RollTreasureButtonTitle")}">
          <i class="fas fa-coins"></i> ${game.i18n.localize("DWAUTO.Monster.RollTreasureButton")}
        </button>
        ${renderResultPanel(actor)}
      </div>
    </section>
  `);

  $tabBody.find(".dwauto-monster-build-btn").on("click", (event) => {
    event.preventDefault();
    setActiveTab(actor.id, TAB_KEY);
    new MonsterBuilderApp(actor).render(true);
  });

  $tabBody.find(".dwauto-monster-treasure-btn").on("click", async (event) => {
    event.preventDefault();
    setActiveTab(actor.id, TAB_KEY);
    await rollAndAnnounceTreasure(actor);
  });
}

export function registerMonsterGenerator() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
