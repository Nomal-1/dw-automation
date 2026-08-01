import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";
import { setPendingRollBonus } from "../lib/roll-bonus-state.js";
import { DEFAULT_SELF_FORWARD_MOVES } from "../data/self-forward-moves.js";

// Reaper(클레릭)/Quick Study(위저드)/An Ear For Magic(바드)/My Love For You Is
// Like A Truck(바바리안)처럼 "따로 판정 없이, 특정 상황이 벌어지면 자기
// 자신에게 +1 forward를 받는다"는 동일한 구조의 무브들을 이름 목록(테이블)
// 하나로 처리한다. rollType이 아예 없는 무브라 클릭해도 성공/부분성공/실패
// 구분이 없다 — getMoveCardInfo가 title/actor만 뽑아주면 충분하다.
//
// restrictToMoveNames가 있는 행(예: "협상 판정에만 +1")은 lib/
// roll-bonus-state.js의 restrictToMoveNames로 그대로 넘긴다 — roll-wrapper.js가
// 그 이름과 일치하는 판정을 만날 때만 소모한다. Unforgettable Face(바드)/
// Usurper(바바리안)처럼 +1이 "특정 NPC(의 부하)에 대한 판정"에만 적용되는
// 경우는, 지금 굴리는 판정이 그 NPC를 대상으로 하는지 자동으로 판별할
// 방법이 없어서 자동화 대상에서 제외했다(GM 요청).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_SELF_FORWARD_ASSISTANT);
}

function getRows() {
  return game.settings.get(MODULE_ID, SETTINGS.SELF_FORWARD_MOVES);
}

// 설정("자기 자신 forward 무브")에 등록된 이름과 채팅 카드 제목을 비교한다.
// features/class-grant.js와 같은 방식으로, 설정값이 아직 번역 전이어도
// 지금 시점의 번역 데이터로 다시 한번 확인한다.
async function matchesConfiguredRow(title) {
  const rows = getRows();
  const direct = rows.find((r) => r.name === title);
  if (direct) return direct;

  try {
    const nameMap = await getMoveNameMap();
    for (const defaultRow of DEFAULT_SELF_FORWARD_MOVES) {
      if (nameMap.get(defaultRow.name) === title) {
        return rows.find((r) => r.name === defaultRow.name) ?? defaultRow;
      }
    }
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return null;
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

    const restrictToMoveNames = row.restrictToMoveNames
      ? row.restrictToMoveNames
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    await setPendingRollBonus(actor, 1, moveItem.name, restrictToMoveNames);

    announceActionApplied(
      actor,
      moveItem.name,
      restrictToMoveNames
        ? game.i18n.format("DWAUTO.SelfForward.AppliedRestricted", { moves: restrictToMoveNames.join(", ") })
        : game.i18n.localize("DWAUTO.SelfForward.Applied")
    );
  } catch (err) {
    console.error(`${MODULE_ID} | self-forward: onCreateChatMessage failed`, err);
  }
}

export function registerSelfForwardAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
