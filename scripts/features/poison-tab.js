import { MODULE_ID, SETTINGS } from "../constants.js";
import { injectActorTab } from "../lib/actor-tabs.js";
import { getUsedPoisons, addUsedPoison } from "../lib/poison-state.js";
import { createOrIncrementPoisonItem } from "../lib/poison-item.js";
import { DEFAULT_POISONS } from "../data/poison-tables.js";
import { announceActionApplied } from "../lib/announce.js";

// 도적 고급액션 독의 달인(Poison Master, "한 번이라도 사용한 독은 위험 없이
// 다룰 수 있다")/독제사(Brewer, "한 번이라도 사용한 독을 3회분씩 무료로
// 만들 수 있다")는 둘 다 "지금까지 사용한 독" 목록을 전제로 하는 무브라
// 같은 탭을 공유한다(요청대로 두 무브를 둘 다 가지고 있어도 탭이 두 개로
// 나뉘지 않는다). 독제사를 가진 경우에만 "독 제조" 버튼이 추가로 붙는다.
// 둘 다 판정 없는 패시브 무브라 "발동"이라는 개념이 없어서, 클릭 트리거가
// 아니라 무브 소지 여부로 탭을 켠다(무쇠의 몸/무자비와 같은 패턴).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_POISON_TRACKER_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasPoisonMaster(actor) {
  const names = splitCommaList(SETTINGS.POISON_MASTER_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

function hasBrewer(actor) {
  const names = splitCommaList(SETTINGS.BREWER_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

function promptAddPoison() {
  const presetOptions = DEFAULT_POISONS.map(
    (p, i) => `
      <div class="form-group dwauto-choice-option">
        <label><input type="radio" name="poisonPick" value="${i}" ${i === 0 ? "checked" : ""}> <strong>${p.name}</strong> (${p.tag})</label>
      </div>
    `
  ).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("DWAUTO.Poison.AddTitle"),
      content: `
        <form>
          ${presetOptions}
          <div class="form-group dwauto-choice-option">
            <label><input type="radio" name="poisonPick" value="custom"> ${game.i18n.localize("DWAUTO.Poison.CustomOption")}</label>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Poison.CustomNameLabel")}</label>
            <input type="text" name="customName">
          </div>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Poison.CustomTagLabel")}</label>
            <input type="text" name="customTag" placeholder="${game.i18n.localize("DWAUTO.Poison.CustomTagPlaceholder")}">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const pick = html.find('[name="poisonPick"]:checked').val();
            if (pick === "custom") {
              const name = String(html.find('[name="customName"]').val() ?? "").trim();
              const tag = String(html.find('[name="customTag"]').val() ?? "").trim();
              if (!name) {
                ui.notifications.warn(game.i18n.localize("DWAUTO.Poison.CustomNameRequired"));
                resolve(null);
                return;
              }
              resolve({ name, tag });
            } else {
              const preset = DEFAULT_POISONS[Number(pick)];
              resolve(preset ? { name: preset.name, tag: preset.tag } : null);
            }
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => {}
    }).render(true);
  });
}

function promptBrewChoice(poisons) {
  const options = poisons
    .map((p) => `<option value="${p.id}">${p.name}${p.tag ? ` (${p.tag})` : ""}</option>`)
    .join("");

  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("DWAUTO.Poison.BrewTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Poison.BrewSelectLabel")}</label>
            <select name="poison">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => resolve(poisons.find((p) => p.id === html.find('[name="poison"]').val()) ?? null)
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

function renderPoisonTab($body, actor, allowBrew) {
  const poisons = getUsedPoisons(actor);

  const listHtml = poisons.length
    ? `<ul class="dwauto-poison-list">${poisons
        .map((p) => `<li>${p.name}${p.tag ? ` <span class="dwauto-poison-tag">(${p.tag})</span>` : ""}</li>`)
        .join("")}</ul>`
    : `<p class="dwauto-poison-empty">${game.i18n.localize("DWAUTO.Poison.Empty")}</p>`;

  $body.append(`<h3>${game.i18n.localize("DWAUTO.Poison.TabLabel")}</h3>`);
  $body.append(listHtml);

  const $actions = $('<div class="dwauto-poison-actions"></div>');
  $body.append($actions);

  const $addButton = $(
    `<button type="button" class="dwauto-roll-btn dwauto-poison-add">${game.i18n.localize("DWAUTO.Poison.AddButton")}</button>`
  );
  $actions.append($addButton);
  $addButton.on("click", async (event) => {
    event.preventDefault();
    const picked = await promptAddPoison();
    if (!picked) return;
    await addUsedPoison(actor, { name: picked.name, tag: picked.tag });
    actor.sheet?.render(false);
  });

  if (allowBrew) {
    const $brewButton = $(
      `<button type="button" class="dwauto-roll-btn dwauto-poison-brew">${game.i18n.localize("DWAUTO.Poison.BrewButton")}</button>`
    );
    $actions.append($brewButton);
    $brewButton.on("click", async (event) => {
      event.preventDefault();
      const current = getUsedPoisons(actor);
      if (current.length === 0) {
        ui.notifications.warn(game.i18n.localize("DWAUTO.Poison.BrewNoneWarning"));
        return;
      }
      const chosen = await promptBrewChoice(current);
      if (!chosen) return;

      const description = DEFAULT_POISONS.find((p) => p.name === chosen.name)?.description ?? "";
      const total = await createOrIncrementPoisonItem(actor, chosen.name, chosen.tag, 3, description);
      announceActionApplied(
        actor,
        game.i18n.localize("DWAUTO.Poison.BrewButton"),
        game.i18n.format("DWAUTO.Poison.Brewed", { name: chosen.name, total })
      );
    });
  }
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;
  if (!hasPoisonMaster(actor) && !hasBrewer(actor)) return;

  const $body = injectActorTab({
    html,
    actor,
    tabKey: "dwauto-poison",
    navLabel: game.i18n.localize("DWAUTO.Poison.TabLabel")
  });
  $body.addClass("dwauto-tab");
  renderPoisonTab($body, actor, hasBrewer(actor));
}

export function registerPoisonTrackerAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
