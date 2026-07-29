import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap, MOVE_PACK_FILES } from "../lib/translation-import.js";
import { DEFAULT_CLASS_GRANT_MOVES } from "../data/class-grant-moves.js";

// 팔라딘 Divine Favor/레인저 God Amidst The Wastes처럼 "발동하면 다른 직업의
// 특정 무브(들)를 그대로 얻는다" 무브. features/note-moves.js와 별개의 독립된
// 기능이다 — 같은 무브가 동시에 메모형 무브(신을 짓는 서사적 선택)이면서
// 이 기능의 대상(실제로 클레릭 무브를 부여받음)일 수 있으며, 둘 다 같은
// createChatMessage 이벤트에서 각자의 설정 표를 보고 독립적으로 반응한다.
const GRANTED_FLAG = "classGrantGranted"; // { [moveId]: true }
const MOVE_PACK_IDS = MOVE_PACK_FILES.map((file) => file.replace(/\.json$/, ""));
let cachedMoveDocs = null;

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_CLASS_GRANT_ASSISTANT);
}

function getRows() {
  return game.settings.get(MODULE_ID, SETTINGS.CLASS_GRANT_MOVES);
}

function isGranted(actor, moveId) {
  return Boolean(actor.getFlag(MODULE_ID, GRANTED_FLAG)?.[moveId]);
}

async function setGranted(actor, moveId) {
  const current = actor.getFlag(MODULE_ID, GRANTED_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, GRANTED_FLAG, { ...current, [moveId]: true });
}

// features/level-up-info.js의 getAllMoveDocuments와 같은 방식(전체 목록을
// 한 번 캐시)이다 — 8개 기본 직업 무브 컴펜디엄 전체에서 이름으로 찾는다.
async function getAllMoveDocuments() {
  if (cachedMoveDocs) return cachedMoveDocs;
  const lists = await Promise.all(
    MOVE_PACK_IDS.map(async (packId) => {
      const pack = game.packs.get(packId);
      if (!pack) return [];
      try {
        return await pack.getDocuments();
      } catch (err) {
        console.warn(`${MODULE_ID} | class-grant: failed to load pack ${packId}`, err);
        return [];
      }
    })
  );
  cachedMoveDocs = lists.flat();
  return cachedMoveDocs;
}

async function findMoveDocumentByName(name) {
  const docs = await getAllMoveDocuments();
  return docs.find((d) => d.name === name) ?? null;
}

// Multiclass Dabbler/Initiate("다른 직업 무브 하나 습득") 전용: 직업 무브 팩별로
// (basic-moves 제외) 묶어서 돌려준다. 팩의 label(예: "The Fighter")을 직업
// 이름 대신 그대로 쓴다 — 시스템 자체가 등록한 이름이라 시스템/모듈 언어
// 설정에 따라 이미 적절히 표시된다.
async function getMovesGroupedByClassPack() {
  const groups = new Map(); // packId -> { label, docs }
  await Promise.all(
    MOVE_PACK_IDS.filter((packId) => !packId.endsWith("basic-moves")).map(async (packId) => {
      const pack = game.packs.get(packId);
      if (!pack) return;
      try {
        const docs = await pack.getDocuments();
        groups.set(packId, { label: pack.metadata.label, docs });
      } catch (err) {
        console.warn(`${MODULE_ID} | class-grant: failed to load pack ${packId}`, err);
      }
    })
  );
  return groups;
}

// 직업을 먼저 고르고, 그 직업의 무브 목록에서 하나를 고르는 대화상자.
// 직업 선택이 바뀌면 무브 목록도 그에 맞게 다시 채운다. 취소하면 null.
function promptChoiceGrant(moveItem, classGroups) {
  const packIds = Array.from(classGroups.keys());
  if (packIds.length === 0) return Promise.resolve(null);

  const buildMoveOptions = (packId) =>
    classGroups
      .get(packId)
      .docs.map((doc) => `<option value="${doc.id}">${doc.name}</option>`)
      .join("");

  const classOptionsHtml = packIds.map((packId) => `<option value="${packId}">${classGroups.get(packId).label}</option>`).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: moveItem.name,
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.ClassGrant.ChoiceClassLabel")}</label>
            <select name="classPack">${classOptionsHtml}</select>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize("DWAUTO.ClassGrant.ChoiceMoveLabel")}</label>
            <select name="moveId">${buildMoveOptions(packIds[0])}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const packId = html.find('[name="classPack"]').val();
            const moveId = html.find('[name="moveId"]').val();
            const doc = classGroups.get(packId)?.docs.find((d) => d.id === moveId);
            resolve(doc ?? null);
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => resolve(null)
        }
      },
      default: "ok",
      width: 420,
      render: (html) => {
        html.find('[name="classPack"]').on("change", (event) => {
          html.find('[name="moveId"]').html(buildMoveOptions(event.currentTarget.value));
        });
      },
      close: () => resolve(null)
    }).render(true);
  });
}

// 설정("클래스 부여 무브")에 등록된 이름과 채팅 카드 제목을 비교한다. 설정값이
// 아직 번역 전(영문 기본값)이어도, 지금 이 시점의 번역 데이터로 다시 한번
// 확인한다(features/note-moves.js와 같은 방식).
async function matchesConfiguredRow(title) {
  const rows = getRows();
  const direct = rows.find((r) => r.name === title);
  if (direct) return direct;

  try {
    const nameMap = await getMoveNameMap();
    for (const defaultRow of DEFAULT_CLASS_GRANT_MOVES) {
      if (nameMap.get(defaultRow.name) === title) {
        return rows.find((r) => r.name === defaultRow.name) ?? defaultRow;
      }
    }
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return null;
}

async function grantMoves(actor, row) {
  const names = row.grantedMoveNames
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const toCreate = [];
  const grantedNames = [];

  for (const name of names) {
    if (actor.items.some((i) => i.type === "move" && i.name === name)) continue;

    const doc = await findMoveDocumentByName(name);
    if (!doc) {
      console.warn(`${MODULE_ID} | class-grant: couldn't find a move named "${name}" in any move compendium`);
      continue;
    }

    toCreate.push(doc.toObject());
    grantedNames.push(name);
  }

  if (toCreate.length > 0) {
    await actor.createEmbeddedDocuments("Item", toCreate);
  }

  return grantedNames;
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

    const row = await matchesConfiguredRow(title);
    if (!row) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;
    if (isGranted(actor, moveItem.id)) return;

    if (row.mode === "choice") {
      const classGroups = await getMovesGroupedByClassPack();
      const chosenDoc = await promptChoiceGrant(moveItem, classGroups);
      if (!chosenDoc) return; // 취소 — 다음에 다시 발동하면 다시 물어본다.

      await setGranted(actor, moveItem.id);
      if (!actor.items.some((i) => i.type === "move" && i.name === chosenDoc.name)) {
        await actor.createEmbeddedDocuments("Item", [chosenDoc.toObject()]);
      }
      announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.ClassGrant.Granted", { moves: chosenDoc.name }));
      return;
    }

    const grantedNames = await grantMoves(actor, row);
    await setGranted(actor, moveItem.id);

    if (grantedNames.length > 0) {
      announceActionApplied(
        actor,
        moveItem.name,
        game.i18n.format("DWAUTO.ClassGrant.Granted", { moves: grantedNames.join(", ") })
      );
    }
  } catch (err) {
    console.error(`${MODULE_ID} | class-grant: onCreateChatMessage failed`, err);
  }
}

export function registerClassGrantAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
