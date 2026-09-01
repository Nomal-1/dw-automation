import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied, announceInfo } from "../lib/announce.js";
import { getMoveNameMap, MOVE_PACK_FILES } from "../lib/translation-import.js";
import { DEFAULT_CLASS_GRANT_MOVES } from "../data/class-grant-moves.js";

// 팔라딘 Divine Favor/레인저 God Amidst The Wastes처럼 "발동하면 다른 직업의
// 특정 무브(들)를 그대로 얻는다" 무브. features/note-moves.js와 별개의 독립된
// 기능이다 — 같은 무브가 동시에 메모형 무브(신을 짓는 서사적 선택)이면서
// 이 기능의 대상(실제로 클레릭 무브를 부여받음)일 수 있으며, 둘 다 같은
// createChatMessage 이벤트에서 각자의 설정 표를 보고 독립적으로 반응한다.
// { [moveId]: string[] } — 실제로 이 무브가 부여한 이름 목록(고정 모드는
// 설정된 전체 목록, 자유 선택 모드는 실제로 고른 것). v0.35.x 이전에는 그냥
// true였는데, 다시 발동했을 때 "무엇을 얻었는지" 다시 보여줄 수 있게
// 이름까지 남기도록 바뀌었다 — 예전 데이터(boolean true)와도 호환되게
// isGranted/getGrantedNames가 둘 다 처리한다.
const GRANTED_FLAG = "classGrantGranted";
const MOVE_PACK_IDS = MOVE_PACK_FILES.map((file) => file.replace(/\.json$/, ""));
let cachedMoveDocs = null;

// 바바리안 Appetite For Destruction/Kill 'Em All 원문("You may not take
// multiclass moves from those classes")이 가리키는 대상 — 던전월드 컴펜디엄
// 전체에서 "멀티클래스 무브"에 해당하는 건 이 둘뿐이다(각 기본 직업의
// 고급 무브로 하나씩 존재).
const MULTICLASS_MOVE_NAMES = ["Multiclass Dabbler", "Multiclass Initiate"];

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_CLASS_GRANT_ASSISTANT);
}

function getRows() {
  return game.settings.get(MODULE_ID, SETTINGS.CLASS_GRANT_MOVES);
}

function isGranted(actor, moveId) {
  return Boolean(actor.getFlag(MODULE_ID, GRANTED_FLAG)?.[moveId]);
}

// 예전 데이터(boolean true)는 이름을 몰라서 빈 배열을 돌려준다 — 호출부가
// 그 경우 row.grantedMoveNames 등 다른 근거로 대체한다.
function getGrantedNames(actor, moveId) {
  const value = actor.getFlag(MODULE_ID, GRANTED_FLAG)?.[moveId];
  return Array.isArray(value) ? value : [];
}

async function setGranted(actor, moveId, moveNames) {
  const current = actor.getFlag(MODULE_ID, GRANTED_FLAG) ?? {};
  await actor.setFlag(MODULE_ID, GRANTED_FLAG, { ...current, [moveId]: moveNames });
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

// 룰북 원문: "다중직업을 따질 때에 한하여, 직업의 핵심 액션들 중 서로
// 의존하는 것들은 합해서 하나의 액션으로 칩니다. 예를 들어 마법사의 주문
// 시전, 주문서, 주문 준비는 합해서 하나로 칩니다." — 클레릭(예배+주문 시전)과
// 위저드(주문 시전+주문서+주문 준비)가 여기 해당한다. 골라올 수 있는 목록에는
// 이 묶음을 낱개가 아니라 하나의 선택지로 보여주고, 고르면 묶음 전체를
// 한꺼번에 부여한다.
const MULTICLASS_BUNDLES = {
  "dungeonworld.the-cleric-moves": ["Commune", "Cast A Spell"],
  "dungeonworld.the-wizard-moves": ["Cast a Spell", "Spellbook", "Prepare Spells"]
};

function getActorLevel(actor) {
  return Number(actor.system?.attributes?.level?.value) || 1;
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

// 룰북 원문: "자기 레벨보다 하나 이상 낮은 레벨의 액션이면 아무 것이나 골라도
// 됩니다." — 이 제한은 Multiclass Dabbler/Initiate에만 실제로 적혀있는
// 문구라, 그 두 행만 (actorLevel-1) 이하로 추려낸다. Hunter's Brother/
// Appetite For Destruction 등 noLevelCap 행은 이 제한 없이 그 직업의 무브
// 전체를 보여준다(data/class-grant-moves.js 상단 주석 참고). 어느 쪽이든
// 서로 의존하는 핵심 액션 묶음은 하나의 선택지로 합치고, 고를 게 하나도
// 없는 직업(이론상 없음 — 모든 직업이 레벨 0 시작 무브를 갖고 있다)은
// 목록에서 아예 뺀다.
// 무브 자체의 requiresLevel(0=핵심, 2=고급 하급 티어, 6=고급 상급 티어)을
// 그대로 선택지 이름 뒤에 붙여서, 지금 뜨는 목록이 정말 레벨에 맞는 고급
// 무브까지 포함하고 있는지 눈으로 바로 확인할 수 있게 한다.
function tierSuffix(reqLevel) {
  if (reqLevel >= 6) return game.i18n.localize("DWAUTO.ClassGrant.TierAdvanced6");
  if (reqLevel >= 2) return game.i18n.localize("DWAUTO.ClassGrant.TierAdvanced2");
  return game.i18n.localize("DWAUTO.ClassGrant.TierCore");
}

function buildEligiblePicks(classGroups, actorLevel, excludeNames = null, noLevelCap = false) {
  const maxLevel = noLevelCap ? Infinity : actorLevel - 1;
  const result = new Map(); // packId -> { label, picks: [{ key, label, docs }] }

  for (const [packId, { label, docs }] of classGroups) {
    const bundleNames = MULTICLASS_BUNDLES[packId];
    const picks = [];
    const bundleDocs = [];
    let bundleLevel = 0;

    for (const doc of docs) {
      if (doc.type !== "move") continue;
      if (excludeNames?.has(doc.name)) continue;
      const reqLevel = Number(doc.system?.requiresLevel) || 0;
      if (reqLevel > maxLevel) continue;

      if (bundleNames?.includes(doc.name)) {
        bundleDocs.push(doc);
        bundleLevel = Math.max(bundleLevel, reqLevel);
        continue;
      }
      picks.push({ key: doc.id, label: `${doc.name} (${tierSuffix(reqLevel)})`, docs: [doc] });
    }

    if (bundleDocs.length > 0) {
      picks.unshift({
        key: `bundle:${packId}`,
        label: `${bundleDocs.map((d) => d.name).join(" + ")} (${tierSuffix(bundleLevel)})`,
        docs: bundleDocs
      });
    }

    if (picks.length > 0) result.set(packId, { label, picks });
  }

  console.log(
    `${MODULE_ID} | class-grant: eligible picks at level ${actorLevel} (max requiresLevel ${maxLevel}):`,
    Object.fromEntries(Array.from(result, ([packId, g]) => [packId, g.picks.map((p) => p.label)]))
  );

  return result;
}

// row.restrictToClassKeys("fighter,bard,thief" 등)로 제한된 경우, 팩 id가
// dungeonworld.the-<key>-moves 형태인 그 직업들만 남긴다. 팩 id는 번역
// 여부와 무관하게 항상 영문 고정값이라 이 매칭은 언어 설정에 안전하다.
function restrictClassGroups(classGroups, restrictToClassKeys) {
  if (!restrictToClassKeys) return classGroups;
  const keys = restrictToClassKeys
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (keys.length === 0) return classGroups;

  return new Map(Array.from(classGroups).filter(([packId]) => keys.some((key) => packId === `dungeonworld.the-${key}-moves`)));
}

// 직업을 먼저 고르고, 그 직업의 (레벨 자격을 만족하는) 무브 목록에서 하나를
// 고르는 대화상자. 직업 선택이 바뀌면 무브 목록도 그에 맞게 다시 채운다.
// 취소하면 null.
function promptChoiceGrant(moveItem, eligibleGroups) {
  const packIds = Array.from(eligibleGroups.keys());
  if (packIds.length === 0) return Promise.resolve(null);

  const buildMoveOptions = (packId) =>
    eligibleGroups
      .get(packId)
      .picks.map((pick) => `<option value="${pick.key}">${pick.label}</option>`)
      .join("");

  const classOptionsHtml = packIds.map((packId) => `<option value="${packId}">${eligibleGroups.get(packId).label}</option>`).join("");

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
            <select name="moveKey">${buildMoveOptions(packIds[0])}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const packId = html.find('[name="classPack"]').val();
            const key = html.find('[name="moveKey"]').val();
            const pick = eligibleGroups.get(packId)?.picks.find((p) => p.key === key);
            resolve(pick ?? null);
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
          html.find('[name="moveKey"]').html(buildMoveOptions(event.currentTarget.value));
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

    if (isGranted(actor, moveItem.id)) {
      // 이미 처리된 무브를 다시 발동한 것 — 새로 뭘 주지 않고, 그때 무엇을
      // 얻었는지만 다시 알려준다. 예전 데이터(boolean true)라 이름을 모르면
      // 고정 모드는 설정된 전체 목록으로 대체하고, 자유 선택 모드는 어떤
      // 이름인지 알 수 없다는 안내로 대체한다.
      let names = getGrantedNames(actor, moveItem.id);
      if (names.length === 0 && row.mode !== "choice") {
        names = row.grantedMoveNames
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      announceInfo(
        actor,
        names.length > 0
          ? game.i18n.format("DWAUTO.ClassGrant.AlreadyGranted", { move: moveItem.name, moves: names.join(", ") })
          : game.i18n.format("DWAUTO.ClassGrant.AlreadyGrantedUnknown", { move: moveItem.name })
      );
      return;
    }

    if (row.mode === "choice") {
      const classGroups = restrictClassGroups(await getMovesGroupedByClassPack(), row.restrictToClassKeys);
      const excludeNames = row.excludeMulticlassMoves ? new Set(MULTICLASS_MOVE_NAMES) : null;
      const eligibleGroups = buildEligiblePicks(classGroups, getActorLevel(actor), excludeNames, row.noLevelCap);
      const chosenPick = await promptChoiceGrant(moveItem, eligibleGroups);
      if (!chosenPick) return; // 취소 — 다음에 다시 발동하면 다시 물어본다.

      await setGranted(actor, moveItem.id, chosenPick.docs.map((d) => d.name));
      const toCreate = chosenPick.docs.filter((d) => !actor.items.some((i) => i.type === "move" && i.name === d.name));
      if (toCreate.length > 0) {
        await actor.createEmbeddedDocuments(
          "Item",
          toCreate.map((d) => d.toObject())
        );
      }
      announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.ClassGrant.Granted", { moves: chosenPick.label }));
      return;
    }

    const grantedNames = await grantMoves(actor, row);
    const fullNames = row.grantedMoveNames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await setGranted(actor, moveItem.id, fullNames);

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

// v0.33.x 전수조사로 바바리안 Appetite For Destruction/Kill 'Em All을 새로
// 찾아 DEFAULT_CLASS_GRANT_MOVES에 추가했다. 이미 세계를 설정해둔 GM에게는
// 코드 기본값을 바꾸는 것만으로 반영되지 않으므로(game.settings 기본값은
// 한 번도 저장된 적 없는 세계에만 적용된다), 이미 저장된 표에 없는 이름만
// 골라 한 번 추가해준다 — features/underdog.js의 migrateAddSurveyedDefaults와
// 같은 패턴.
async function migrateAddSurveyedDefaults() {
  if (!game.user.isGM) return;

  const rows = getRows();
  const existingNames = new Set(rows.map((r) => r.name));

  let nameMap = null;
  try {
    nameMap = await getMoveNameMap();
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 이름으로는 추가한다.
  }

  const toAdd = [];
  for (const row of DEFAULT_CLASS_GRANT_MOVES) {
    if (existingNames.has(row.name)) continue;

    const translatedName = nameMap?.get(row.name);
    if (translatedName && existingNames.has(translatedName)) continue;

    toAdd.push(translatedName ? { ...row, name: translatedName } : row);
  }

  if (toAdd.length === 0) return;

  await game.settings.set(MODULE_ID, SETTINGS.CLASS_GRANT_MOVES, [...rows, ...toAdd]);
  console.log(
    `${MODULE_ID} | class-grant: added ${toAdd.length} newly-surveyed default(s)`,
    toAdd.map((r) => r.name)
  );
}

// v0.106.0에서 noLevelCap 필드를 5개 행(Appetite For Destruction/Kill 'Em
// All/Hunter's Brother/Stalker's Sister/Special Trick)에 추가했다. 이미
// 이 표를 저장해둔 GM은 새 필드가 자동으로 반영되지 않으므로(game.settings
// 기본값은 한 번도 저장된 적 없는 세계에만 적용된다), 저장된 행 중 이름이
// (원문이든 번역이든) 일치하는 것만 찾아 그 자리에서 필드를 채워 넣는다.
async function migrateAddNoLevelCapFlag() {
  if (!game.user.isGM) return;

  const noLevelCapDefaults = DEFAULT_CLASS_GRANT_MOVES.filter((r) => r.noLevelCap);
  if (noLevelCapDefaults.length === 0) return;

  let nameMap = null;
  try {
    nameMap = await getMoveNameMap();
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 이름으로는 맞춰본다.
  }

  const targetNames = new Set();
  for (const row of noLevelCapDefaults) {
    targetNames.add(row.name);
    const translated = nameMap?.get(row.name);
    if (translated) targetNames.add(translated);
  }

  const rows = getRows();
  let changed = false;
  const next = rows.map((row) => {
    if (row.noLevelCap || !targetNames.has(row.name)) return row;
    changed = true;
    return { ...row, noLevelCap: true };
  });

  if (!changed) return;

  await game.settings.set(MODULE_ID, SETTINGS.CLASS_GRANT_MOVES, next);
  console.log(`${MODULE_ID} | class-grant: backfilled noLevelCap on existing rows`);
}

export function registerClassGrantAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
  Hooks.once("ready", () => {
    migrateAddSurveyedDefaults().then(() => migrateAddNoLevelCapFlag());
  });
}
