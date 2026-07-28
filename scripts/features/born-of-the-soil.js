import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { injectActorTab } from "../lib/actor-tabs.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// Born of the Soil(대지의 아들/딸)은 다른 메모형 무브(신, 신격, 동물 상대)와
// 달리 원문 설명 안에 "결연된 땅" 선택지 11개가 <ul><li>로 이미 들어있다.
// 그냥 소유만으로 탭을 띄우는 note-moves.js 방식 대신, 실제로 이 무브를
// 발동(채팅 카드로 클릭)했을 때만 그 목록을 그대로 뽑아 드롭다운으로
// 보여주고 땅을 고르게 한다(+ 직접입력). 목록을 하드코딩하지 않고 무브
// 자체의 description에서 파싱하므로 번역 여부와 무관하게 항상 정확하다.
const ACTIVATED_FLAG = "bornOfSoilActivated";
const LAND_FLAG = "bornOfSoilLand";
const NOTES_FLAG = "bornOfSoilNotes";
const CUSTOM_VALUE = "__dwauto_custom__";

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_DRUID_ASSISTANT);
}

function isActivated(actor) {
  return Boolean(actor.getFlag(MODULE_ID, ACTIVATED_FLAG));
}

// 무브 설명 HTML 안의 <li> 목록(원문 기준 11개 땅 이름)을 그대로 뽑아온다.
// 번역되어 있으면 번역된 땅 이름이 그대로 나온다 — 이 프로젝트가 다른
// 곳에서도 쓰는 "번역에 의존하지 말고 구조에서 읽는다" 원칙과 같다.
function extractLandOptions(moveItem) {
  const html = $(`<div>${moveItem.system?.description ?? ""}</div>`);
  return html
    .find("li")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

function promptLandChoice(moveItem) {
  const options = extractLandOptions(moveItem);

  return new Promise((resolve) => {
    const selectOptions = options
      .map((land) => `<option value="${land}">${land}</option>`)
      .concat(`<option value="${CUSTOM_VALUE}">${game.i18n.localize("DWAUTO.BornOfSoil.CustomOption")}</option>`)
      .join("");

    new Dialog({
      title: game.i18n.localize("DWAUTO.BornOfSoil.PromptTitle"),
      content: `
        <form>
          <p>${game.i18n.localize("DWAUTO.BornOfSoil.PromptLabel")}</p>
          <div class="form-group">
            <select name="land">${selectOptions}</select>
          </div>
          <div class="form-group dwauto-bornofsoil-custom" style="display:none;">
            <input type="text" name="customLand" value="">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const value = html.find('[name="land"]').val();
            if (value === CUSTOM_VALUE) {
              resolve((html.find('[name="customLand"]').val() ?? "").trim() || null);
            } else {
              resolve(value);
            }
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve(null)
        }
      },
      default: "ok",
      render: (html) => {
        html.find('[name="land"]').on("change", (event) => {
          html.find(".dwauto-bornofsoil-custom").toggle(event.currentTarget.value === CUSTOM_VALUE);
        });
      },
      close: () => resolve(null)
    }).render(true);
  });
}

async function activate(actor, moveItem) {
  const land = await promptLandChoice(moveItem);
  if (!land) return;

  await actor.setFlag(MODULE_ID, ACTIVATED_FLAG, true);
  await actor.setFlag(MODULE_ID, LAND_FLAG, land);
  announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.BornOfSoil.LandChosen", { land }));
}

// 이 무브는 rollType이 없는 순수 서술형(선택) 무브라 채팅 카드에 성공/부분
// 성공 같은 결과 등급이 없다(result가 null) — 이름만 맞으면 발동으로
// 취급한다.
function onCreateChatMessage(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!isEnabled()) return;
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title } = info;

  const names = splitCommaList(SETTINGS.BORN_OF_THE_SOIL_MOVE_NAMES);
  if (!names.includes(title)) return;
  if (isActivated(actor)) return;

  const moveItem = findMoveItem(actor, title);
  if (!moveItem) return;

  activate(actor, moveItem);
}

async function resetBornOfSoil(actor) {
  await actor.unsetFlag(MODULE_ID, ACTIVATED_FLAG);
  await actor.unsetFlag(MODULE_ID, LAND_FLAG);
  await actor.unsetFlag(MODULE_ID, NOTES_FLAG);
}

function renderTab(actor, moveItem, html) {
  const $body = injectActorTab({
    html,
    actor,
    tabKey: "dwauto-born-of-soil",
    navLabel: moveItem.name,
    onReset: () => resetBornOfSoil(actor)
  });
  $body.addClass("dwauto-tab");

  const land = actor.getFlag(MODULE_ID, LAND_FLAG) ?? "";
  const notes = actor.getFlag(MODULE_ID, NOTES_FLAG) ?? "";

  const $section = $(`
    <div class="cell dwauto-born-of-soil">
      <label class="cell__title">${game.i18n.localize("DWAUTO.BornOfSoil.LandLabel")}</label>
      <a class="tag dwauto-born-of-soil-land">${land}</a>
      <label class="cell__title dwauto-note-move">${game.i18n.localize("DWAUTO.NoteMoves.NotesLabel")}</label>
      <textarea class="dwauto-note-textarea" rows="6">${notes}</textarea>
    </div>
  `);

  $section.find(".dwauto-note-textarea").on("change", async (event) => {
    await actor.setFlag(MODULE_ID, NOTES_FLAG, event.currentTarget.value);
  });

  $body.append($section);
}

function onRenderActorSheet(app, html) {
  if (!isEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;
  if (!isActivated(actor)) return;

  const names = splitCommaList(SETTINGS.BORN_OF_THE_SOIL_MOVE_NAMES);
  const moveItem = actor.items.find((i) => i.type === "move" && names.includes(i.name));
  if (!moveItem) return;

  renderTab(actor, moveItem, html);
}

// 이 설정은 v0.22.0에서 신설된 거라 세계 대부분에서 영문 기본값 그대로일
// 것이다 — 그 상태로는 캐릭터가 실제로 갖고 있는 (번역된) 무브 이름과
// 안 맞아서 클릭해도 아무 반응이 없다. GM이 손댄 적이 없는(정확히 기본값
// 그대로인) 경우에 한해 한 번 자동으로 번역해준다. 이미 손을 댔다면
// 건드리지 않는다.
async function migrateNameToTranslation() {
  if (!game.user.isGM) return;

  const current = game.settings.get(MODULE_ID, SETTINGS.BORN_OF_THE_SOIL_MOVE_NAMES);
  if (current.trim() !== "Born of the Soil") return;

  try {
    const nameMap = await getMoveNameMap();
    const translated = nameMap.get("Born of the Soil");
    if (translated && translated !== current) {
      await game.settings.set(MODULE_ID, SETTINGS.BORN_OF_THE_SOIL_MOVE_NAMES, translated);
      console.log(`${MODULE_ID} | born-of-the-soil: auto-translated move name to "${translated}"`);
    }
  } catch (err) {
    // 실패해도 GM이 "번역 모듈에서 자동 채우기"로 나중에 채울 수 있다.
  }
}

export function registerBornOfTheSoil() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.once("ready", () => {
    migrateNameToTranslation();
  });
}
