import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";
import { DEFAULT_MOVE_UPGRADES } from "../data/move-upgrades.js";
import { getMoveNameMap } from "../lib/translation-import.js";

function getUpgradeRow(name) {
  const table = game.settings.get(MODULE_ID, SETTINGS.MOVE_UPGRADES);
  return table.find((row) => row.upgradeName === name) ?? null;
}

// 새로 추가된 무브 아이템이 상급 버전(예: 치료사의 모범)이면, 같은 액터가
// 갖고 있는 그 이전 단계 무브(치료사)를 자동으로 삭제한다. createItem은
// 이 갱신을 실제로 수행한 클라이언트뿐 아니라 접속한 모든 클라이언트에서
// 실행되므로, userId를 확인해 한 번만 처리한다(그렇지 않으면 여러 클라이언트가
// 동시에 삭제를 시도해 오류가 난다).
function onCreateItem(item, options, userId) {
  if (options.dwautoSkipMoveUpgrade) return;
  if (game.system.id !== "dungeonworld") return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_MOVE_UPGRADE_ASSISTANT)) return;
  if (item.type !== "move") return;

  const actor = item.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "character") return;
  if (userId !== game.user.id) return;

  const row = getUpgradeRow(item.name);
  if (!row) return;
  if (row.deletesPrevious === false) return; // "필요" 관계 — 이전 무브는 그대로 둔다.

  const oldItem = actor.items.find((i) => i.type === "move" && i.name === row.replacesName);
  if (!oldItem) return;

  oldItem.delete();
  announceActionApplied(
    actor,
    item.name,
    game.i18n.format("DWAUTO.MoveUpgrade.Replaced", { old: oldItem.name })
  );
}

// v0.33.x 전수조사로 바바리안/이몰레이터(시스템에 같이 딸려오는 추가 두 직업)
// 컴펜디엄에서 새로 찾은 3쌍(Kill 'Em All, Burns Half As Long, Fanning The
// Flames)은 이미 세계를 설정해둔 GM에게는 코드 기본값을 바꾸는 것만으로
// 반영되지 않는다(game.settings 기본값은 한 번도 저장된 적 없는 세계에만
// 적용된다). 이미 저장된 표에 없는 쌍만 골라 한 번 추가해준다 — 이름은
// 번역 데이터가 있으면 번역된 이름 기준으로 저장해서, 이미 번역된 세계에서도
// 즉시 매칭된다. features/underdog.js의 migrateAddSurveyedDefaults와 같은 패턴.
async function migrateAddSurveyedDefaults() {
  if (!game.user.isGM) return;

  const rows = game.settings.get(MODULE_ID, SETTINGS.MOVE_UPGRADES);
  const rowKey = (r) => `${r.upgradeName}|${r.replacesName}`;
  const existingKeys = new Set(rows.map(rowKey));

  let nameMap = null;
  try {
    nameMap = await getMoveNameMap();
  } catch (err) {
    // 번역 데이터를 못 읽어도 최소한 영문 이름으로는 추가한다.
  }

  const toAdd = [];
  for (const row of DEFAULT_MOVE_UPGRADES) {
    if (existingKeys.has(rowKey(row))) continue;

    const translatedUpgrade = nameMap?.get(row.upgradeName);
    const translatedReplaces = nameMap?.get(row.replacesName);
    const translatedKey = `${translatedUpgrade ?? row.upgradeName}|${translatedReplaces ?? row.replacesName}`;
    if (existingKeys.has(translatedKey)) continue;

    toAdd.push({
      ...row,
      upgradeName: translatedUpgrade ?? row.upgradeName,
      replacesName: translatedReplaces ?? row.replacesName
    });
  }

  if (toAdd.length === 0) return;

  await game.settings.set(MODULE_ID, SETTINGS.MOVE_UPGRADES, [...rows, ...toAdd]);
  console.log(
    `${MODULE_ID} | move-upgrades: added ${toAdd.length} newly-surveyed default(s)`,
    toAdd.map((r) => `${r.upgradeName} <- ${r.replacesName}`)
  );
}

export function registerMoveUpgradeAssistant() {
  Hooks.on("createItem", onCreateItem);
  Hooks.once("ready", () => {
    migrateAddSurveyedDefaults();
  });
}
