import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { getOpenDebilities, getDebilityLabel, hasAllDebilities } from "../lib/debilities.js";

// 바바리안 "죽기 좋은 날(A Good Day To Die)" 원문: "현재 HP가 자신의 CON
// 미만(또는 1, 둘 중 더 큰 쪽)인 동안 모든 판정에 +1 ongoing을 받는다."
// Formcrafter의 능력치 보정(druid.js의 getFormcrafterRollModifier)과 같은
// 이유로 매 판정마다 lib/roll-wrapper.js가 이 함수를 불러 실시간으로 계산한다
// — HP/CON은 액터 데이터에서 바로 읽을 수 있어 "지금 조건이 맞는지"를
// 수동 토글 없이 완전히 자동으로 판정할 수 있다. ongoing 보정이라 채팅에
// 따로 알리지 않는다(Formcrafter도 조용히 rollMod에만 반영하는 것과 동일한
// 이유 — 매 판정마다 메시지가 뜨면 시끄럽다).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_BARBARIAN_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasGoodDayToDie(actor) {
  const names = splitCommaList(SETTINGS.GOOD_DAY_TO_DIE_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

// lib/roll-wrapper.js가 매 판정마다 호출한다.
export function getGoodDayToDieBonus(actor) {
  if (!isEnabled()) return 0;
  if (!hasGoodDayToDie(actor)) return 0;

  const hp = Number(actor.system.attributes?.hp?.value) || 0;
  const con = Number(actor.system.abilities?.con?.value) || 0;
  const threshold = Math.max(con, 1);
  return hp < threshold ? 1 : 0;
}

// 바바리안 삼손(Samson) 원문: "약화를 하나 받고 즉시 신체적/정신적 구속에서
// 벗어난다." 판정이 없는 자기 발동형 액션이라(rollType 없음) 무브를
// 실제로 클릭했을 때(features/well-trained.js 등과 같은 방식) 약화 선택
// 대화상자를 띄운다. 이미 6개 약화를 전부 가지고 있으면(lib/debilities.js의
// hasAllDebilities) 고를 게 없으므로 안내만 하고 끝낸다.
async function matchesSamson(title) {
  const configured = splitCommaList(SETTINGS.SAMSON_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Samson") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function promptSamsonDebilityChoice(moveItem, open) {
  const options = open.map((key) => `<option value="${key}">${getDebilityLabel(key)}</option>`).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <p>${game.i18n.localize("DWAUTO.Barbarian.SamsonInstruction")}</p>
          <div class="form-group">
            <select name="debility">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => resolve(html.find('[name="debility"]').val())
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve(null)
        }
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

    if (!(await matchesSamson(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    if (hasAllDebilities(actor)) {
      ui.notifications.warn(game.i18n.format("DWAUTO.Barbarian.SamsonNoDebilitiesLeft", { name: actor.name }));
      return;
    }

    const key = await promptSamsonDebilityChoice(moveItem, getOpenDebilities(actor));
    if (!key) return;

    await actor.update({ [`system.abilities.${key}.debility`]: true });
    announceActionApplied(
      actor,
      moveItem.name,
      game.i18n.format("DWAUTO.Barbarian.SamsonApplied", { debility: getDebilityLabel(key) })
    );
  } catch (err) {
    console.error(`${MODULE_ID} | barbarian: onCreateChatMessage failed`, err);
  }
}

export function registerBarbarianAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
