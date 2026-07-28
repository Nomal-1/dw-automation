import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";

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

export function registerMoveUpgradeAssistant() {
  Hooks.on("createItem", onCreateItem);
}
