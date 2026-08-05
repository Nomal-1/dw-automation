import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 소각술사 고급액션 사그라지는 인연(Burning Bridges) 원문: "황천길을 맞아야
// 할 때, 대신 인연을 하나 지울 수 있다. 영구적이고, 그만큼 이후로 가질 수
// 있는 인연의 최대 개수도 영영 줄어든다. 그러면 살아나고 HP는 1d6이 된다.
// 더 지울 인연이 없으면 평소대로 황천길을 겪는다."
//
// 황천길(Last Breath)은 유대(BOND) 판정이라 원조/방해·구인처럼 이 시스템이
// rollMod를 읽지 않는다 — 그래서 판정 값을 조정하는 방식으로는 자동화할
// 수 없고, 아예 판정 자체가 시작되기 전에 가로채서(system.dungeonworld의
// 자체 판정 다이얼로그가 뜨기도 전에) "사그라지는 인연을 쓸지" 먼저 물어야
// 한다. 쓰기로 하면 실제 시스템 판정은 아예 취소하고(lib/roll-wrapper.js가
// promptIAmTheLawPreRoll의 cancel과 같은 방식으로 처리) 우리가 직접 인연을
// 지우고 1d6을 굴려 체력을 그 값으로 맞춘다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_BURNING_BRIDGES_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function hasBurningBridges(actor) {
  const configured = splitCommaList(SETTINGS.BURNING_BRIDGES_MOVE_NAMES);
  if (actor.items.some((i) => i.type === "move" && configured.includes(i.name))) return true;

  try {
    const nameMap = await getMoveNameMap();
    const translated = nameMap.get("Burning Bridges");
    if (translated) return actor.items.some((i) => i.type === "move" && i.name === translated);
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function promptSelectBond(bonds) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const optionsHtml = bonds.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");

    new Dialog({
      title: game.i18n.localize("DWAUTO.BurningBridges.SelectBondTitle"),
      content: `
        <form>
          <p>${game.i18n.localize("DWAUTO.BurningBridges.SelectBondContent")}</p>
          <div class="form-group">
            <select name="bond">${optionsHtml}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const id = html.find('[name="bond"]').val();
            finish(bonds.find((b) => b.id === id) ?? null);
          }
        },
        cancel: { label: game.i18n.localize("DWAUTO.Cancel"), callback: () => finish(null) }
      },
      default: "ok",
      close: () => finish(null)
    }).render(true);
  });
}

// lib/roll-wrapper.js가 액터가 굴리는 모든 판정 "직전"에 호출한다. 지금
// 굴리려는 게 황천길이 아니거나, 이 액터가 사그라지는 인연을 갖고 있지
// 않으면 즉시 통과한다. 사용하기로 하고 인연이 하나라도 있으면 그 판정
// 자체를 취소시킨다(cancel: true) — 원문 그대로 인연이 하나도 없으면 평소
// 대로 황천길을 겪도록 통과시킨다.
export async function promptBurningBridgesPreRoll(item) {
  if (!isEnabled()) return { cancel: false };

  const actor = item.actor;
  if (!actor || actor.type !== "character") return { cancel: false };

  const lastBreathNames = splitCommaList(SETTINGS.LAST_BREATH_MOVE_NAMES);
  if (!lastBreathNames.includes(item.name)) return { cancel: false };

  if (!(await hasBurningBridges(actor))) return { cancel: false };

  const wantsToUse = await Dialog.confirm({
    title: game.i18n.localize("DWAUTO.BurningBridges.PromptTitle"),
    content: `<p>${game.i18n.localize("DWAUTO.BurningBridges.PromptContent")}</p>`,
    defaultYes: false
  });
  if (!wantsToUse) return { cancel: false };

  const bonds = actor.items.filter((i) => i.type === "bond");
  if (bonds.length === 0) {
    ui.notifications.info(game.i18n.localize("DWAUTO.BurningBridges.NoBondsLeft"));
    return { cancel: false };
  }

  const chosenBond = await promptSelectBond(bonds);
  if (!chosenBond) return { cancel: false };

  const bondName = chosenBond.name;
  await chosenBond.delete();

  const roll = new Roll("1d6");
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game.i18n.localize("DWAUTO.BurningBridges.RollFlavor")
  });

  await actor.update({ "system.attributes.hp.value": roll.total });

  announceActionApplied(
    actor,
    game.i18n.localize("DWAUTO.BurningBridges.MoveLabel"),
    game.i18n.format("DWAUTO.BurningBridges.Applied", { bond: bondName, hp: roll.total })
  );

  return { cancel: true };
}

export function registerBurningBridgesAssistant() {
  // 순수하게 roll-wrapper.js에서 호출되는 pre-roll 함수 하나로만 동작한다 —
  // 이 파일 자체가 등록할 훅은 없다.
}
