import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getOrCreateTagsContainer } from "../lib/sheet-badges.js";
import {
  getBolsterReserve,
  setBolsterReserve,
  isBolsterAskEnabled,
  setBolsterAskEnabled
} from "../lib/bolster-state.js";

// 던전월드 기본 무브 수련(Bolster) 원문: "여가 시간을 수행/명상/맹훈련에
// 쓰면 예비를 얻는다. 1~2주면 예비 1점, 한 달 이상이면 예비 3점. 나중에
// 그 수행이 결실을 맺을 때 예비 1점을 써서 아무 판정에나 +1을 받는다.
// 판정당 예비는 한 번만 쓸 수 있다."
//
// 예비는 온/오프가 아니라 숫자 카운터라 액터당 값 하나(bolster-state.js)로
// 관리한다. 발동하면 "몇 점 쌓았는지"(최대 3점) 물어 누적하고, 시트의
// 무브 옆에는 두 배지가 뜬다: 현재 예비 점수(GM이 클릭하면 값을 직접
// 고칠 수 있음)와 "매 판정마다 물어볼지" 토글(플레이어/GM 둘 다 조작
// 가능). 토글이 켜져 있는 동안만, 예비가 있는 채로 무슨 판정을 하든
// "예비를 쓰겠습니까?"를 물어보고 "예"면 그 판정에 +1을 얹고 예비를 1
// 소모한다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_BOLSTER_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findMoveByConfiguredNames(actor) {
  const names = splitCommaList(SETTINGS.BOLSTER_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.BOLSTER_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Bolster") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function promptGainAmount(moveItem) {
  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Bolster.GainPromptLabel")}</label>
            <input type="number" name="amount" value="1" min="0" max="3">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const raw = Number(html.find('[name="amount"]').val()) || 0;
            resolve(Math.min(3, Math.max(0, raw)));
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

function promptSetReserve(current) {
  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("DWAUTO.Bolster.AdjustTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.Bolster.AdjustLabel")}</label>
            <input type="number" name="amount" value="${current}" min="0">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => resolve(Math.max(0, Number(html.find('[name="amount"]').val()) || 0))
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
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

    const amount = await promptGainAmount(moveItem);
    if (!amount) return;

    const total = getBolsterReserve(actor) + amount;
    await setBolsterReserve(actor, total);
    announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.Bolster.Gained", { amount, total }));
  } catch (err) {
    console.error(`${MODULE_ID} | bolster: onCreateChatMessage failed`, err);
  }
}

// lib/roll-wrapper.js가 판정 "직전"에 호출한다. 예비가 없거나 "묻기" 토글이
// 꺼져있으면(또는 지금 굴리는 게 수련 자신이면 — 예비를 쌓는 발동 자체는
// 판정이 아니다) 즉시 통과한다. 예비가 있고 물어보는 상태면 "쓰겠습니까?"를
// 물어서, "예"면 이번 판정에 +1을 얹고 예비를 1 소모한다.
export async function promptBolsterPreRoll(item) {
  if (!isEnabled()) return { bonus: 0 };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { bonus: 0 };

  const names = splitCommaList(SETTINGS.BOLSTER_MOVE_NAMES);
  if (names.includes(item.name)) return { bonus: 0 };

  const reserve = getBolsterReserve(actor);
  if (reserve <= 0) return { bonus: 0 };
  if (!isBolsterAskEnabled(actor)) return { bonus: 0 };

  const moveItem = findMoveByConfiguredNames(actor);
  const useIt = await Dialog.confirm({
    title: moveItem?.name ?? item.name,
    content: `<p>${game.i18n.format("DWAUTO.Bolster.UsePrompt", { reserve })}</p>`,
    defaultYes: false
  });
  if (!useIt) return { bonus: 0 };

  const remaining = reserve - 1;
  await setBolsterReserve(actor, remaining);
  announceActionApplied(actor, moveItem?.name ?? item.name, game.i18n.format("DWAUTO.Bolster.Consumed", { remaining }));
  return { bonus: 1 };
}

// 무브 옆에 배지 두 개를 붙인다: 현재 예비 점수(GM만 클릭해서 값을 직접
// 고칠 수 있음)와 "매 판정마다 물어볼지" 토글(플레이어/GM 둘 다 클릭
// 가능). Know-It-All과 같은 이유로 매번 지우고 다시 그린다 — "이미 있으면
// 건너뛴다" 가드를 쓰면 재렌더링 시점에 따라 갱신이 누락될 수 있다.
function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;

  const moveItem = findMoveByConfiguredNames(actor);
  if (!moveItem) return;

  const $item = html.find(`.item[data-item-id="${moveItem.id}"]`);
  if (!$item.length) return;

  const $tags = getOrCreateTagsContainer($item);
  $tags.find(".dwauto-bolster-badge").remove();

  const reserve = getBolsterReserve(actor);
  const $reserveBadge = $(
    `<a class="tag dwauto-bolster-badge dwauto-bolster-reserve-badge${reserve > 0 ? " dwauto-bolster-on" : ""}" title="${game.i18n.localize("DWAUTO.Bolster.ReserveBadgeTitle")}">${game.i18n.format("DWAUTO.Bolster.ReserveLabel", { reserve })}</a>`
  );
  $tags.append($reserveBadge);
  if (game.user.isGM) {
    $reserveBadge.on("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = await promptSetReserve(reserve);
      if (next !== null) await setBolsterReserve(actor, next);
    });
  }

  const askEnabled = isBolsterAskEnabled(actor);
  const $askBadge = $(
    `<a class="tag dwauto-bolster-badge dwauto-bolster-ask-badge${askEnabled ? " dwauto-bolster-on" : ""}" title="${game.i18n.localize("DWAUTO.Bolster.AskBadgeTitle")}">${game.i18n.localize(askEnabled ? "DWAUTO.Bolster.AskOn" : "DWAUTO.Bolster.AskOff")}</a>`
  );
  $tags.append($askBadge);
  $askBadge.on("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setBolsterAskEnabled(actor, !askEnabled);
  });
}

export function registerBolsterAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
}
