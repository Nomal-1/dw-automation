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
//
// 독학박사(Alchemist, 독제사 대체) 원문: "자기가 한 번이라도 사용한 적이
// 있는 독을 3회분 만들 수 있습니다. 아니면 원하는 효과를 가진 독을
// 묘사하십시오... 마스터가 조건을 하나 이상 골라 제시할 것입니다." 독제사의
// 능력(사용한 독 조제)을 그대로 포함하면서 "독 창작"이라는 새 선택지가
// 추가되는 것이라, 독 제조 버튼 자체는 그대로 두고 선택지만 하나 늘린다
// (강철의 몸/살기등등처럼 완전히 대체하는 게 아니라 급소 가격/치사한 수법에
// 더 가까운 "능력 추가형" 업그레이드).
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

function hasAlchemist(actor) {
  const names = splitCommaList(SETTINGS.ALCHEMIST_MOVE_NAMES);
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

// allowInvent가 켜져 있으면(독학박사) 선택지 맨 끝에 "독 창작"을 추가한다.
// 반환값은 { invent: true } 이거나 { invent: false, poison } 이다.
function promptBrewChoice(poisons, allowInvent) {
  const options = poisons
    .map((p) => `<option value="${p.id}">${p.name}${p.tag ? ` (${p.tag})` : ""}</option>`)
    .join("");
  const inventOption = allowInvent
    ? `<option value="__invent">${game.i18n.localize("DWAUTO.Poison.InventOption")}</option>`
    : "";

  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("DWAUTO.Poison.BrewTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Poison.BrewSelectLabel")}</label>
            <select name="poison">${options}${inventOption}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const value = html.find('[name="poison"]').val();
            if (value === "__invent") {
              resolve({ invent: true });
              return;
            }
            resolve({ invent: false, poison: poisons.find((p) => p.id === value) ?? null });
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

// 독학박사의 "독 창작": 효과를 자유롭게 적고, 마스터가 전달한 부작용 조건을
// 임의의 수만큼(0개 포함) 체크한다.
const ALCHEMIST_CONDITION_KEYS = [
  "DWAUTO.Poison.Condition1",
  "DWAUTO.Poison.Condition2",
  "DWAUTO.Poison.Condition3",
  "DWAUTO.Poison.Condition4"
];

function promptInventPoison() {
  const checks = ALCHEMIST_CONDITION_KEYS.map(
    (key, i) => `
      <div class="form-group dwauto-choice-option">
        <label><input type="checkbox" name="condition" value="${i}"> ${game.i18n.localize(key)}</label>
      </div>
    `
  ).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("DWAUTO.Poison.InventTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Poison.CustomNameLabel")}</label>
            <input type="text" name="name">
          </div>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Poison.EffectLabel")}</label>
            <textarea name="effect" class="dwauto-poison-effect"></textarea>
          </div>
          <p>${game.i18n.localize("DWAUTO.Poison.ConditionsLabel")}</p>
          ${checks}
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const name = String(html.find('[name="name"]').val() ?? "").trim();
            if (!name) {
              ui.notifications.warn(game.i18n.localize("DWAUTO.Poison.CustomNameRequired"));
              resolve(null);
              return;
            }
            const effect = String(html.find('[name="effect"]').val() ?? "").trim();
            const checkedIndexes = html
              .find('[name="condition"]:checked')
              .map((_, el) => Number(el.value))
              .get();
            const conditions = checkedIndexes.map((i) => game.i18n.localize(ALCHEMIST_CONDITION_KEYS[i]));
            resolve({ name, effect, conditions });
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

function buildInventDescription({ effect, conditions }) {
  const parts = [];
  if (effect) parts.push(effect);
  if (conditions.length > 0) {
    parts.push(`${game.i18n.localize("DWAUTO.Poison.ConditionsPrefix")}: ${conditions.join(", ")}`);
  }
  return parts.join("\n");
}

function renderPoisonTab($body, actor, allowBrew, allowInvent) {
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
      if (current.length === 0 && !allowInvent) {
        ui.notifications.warn(game.i18n.localize("DWAUTO.Poison.BrewNoneWarning"));
        return;
      }

      const choice = await promptBrewChoice(current, allowInvent);
      if (!choice) return;

      if (choice.invent) {
        const invented = await promptInventPoison();
        if (!invented) return;

        const description = buildInventDescription(invented);
        await addUsedPoison(actor, { name: invented.name, tag: "" });
        const total = await createOrIncrementPoisonItem(actor, invented.name, "", 3, description);
        announceActionApplied(
          actor,
          game.i18n.localize("DWAUTO.Poison.InventOption"),
          game.i18n.format("DWAUTO.Poison.Brewed", { name: invented.name, total })
        );
        actor.sheet?.render(false);
        return;
      }

      if (!choice.poison) return;
      const description = DEFAULT_POISONS.find((p) => p.name === choice.poison.name)?.description ?? "";
      const total = await createOrIncrementPoisonItem(actor, choice.poison.name, choice.poison.tag, 3, description);
      announceActionApplied(
        actor,
        game.i18n.localize("DWAUTO.Poison.BrewButton"),
        game.i18n.format("DWAUTO.Poison.Brewed", { name: choice.poison.name, total })
      );
    });
  }
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const brewer = hasBrewer(actor);
  const alchemist = hasAlchemist(actor);
  if (!hasPoisonMaster(actor) && !brewer && !alchemist) return;

  const $body = injectActorTab({
    html,
    actor,
    tabKey: "dwauto-poison",
    navLabel: game.i18n.localize("DWAUTO.Poison.TabLabel")
  });
  $body.addClass("dwauto-tab");
  renderPoisonTab($body, actor, brewer || alchemist, alchemist);
}

export function registerPoisonTrackerAssistant() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
