import { MODULE_ID, SETTINGS } from "../constants.js";
import { announceActionApplied } from "../lib/announce.js";

// 도적 고급액션 철완의 투척(Strong Arm, True Aim) 원문: "아무 근거리 무기나
// 던져서 사격을 할 수 있습니다. 한 번 던진 근거리 무기는 손을 떠나기
// 때문에, 7~9가 나왔을 때 발수를 소비하는 선택지를 고를 수 없습니다."
//
// 사격(Volley)이 굴려질 때마다 이 무브를 가진 캐릭터에게 "근접무기를
// 던지시겠습니까?"를 물어본다. "예"면 features/attack-assistant.js가 무기
// 선택 목록을 근접 무기로 바꾸고(자연히 화살 소모 확인도 건너뛴다 —
// isRangedWeapon(근접무기)가 항상 false이므로), 7-9 선택지 중 "발수 소비"
// 항목을 제외한다(원문상 던진 무기는 애초에 선택할 수 없는 선택지이므로).
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_STRONG_ARM_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findStrongArmMove(actor) {
  const names = splitCommaList(SETTINGS.STRONG_ARM_MOVE_NAMES);
  return actor.items.find((i) => i.type === "move" && names.includes(i.name)) ?? null;
}

function isRangedTitle(title) {
  return splitCommaList(SETTINGS.RANGED_MOVE_NAMES).includes(title);
}

// features/attack-assistant.js가 사격의 선택지를 보여주기 직전에 호출한다.
// 이 무브가 없거나 지금 굴린 게 사격이 아니면 조용히 통과한다.
export async function promptStrongArmThrow(actor, moveTitle) {
  if (!isEnabled()) return { throwing: false };
  if (!isRangedTitle(moveTitle)) return { throwing: false };

  const moveItem = findStrongArmMove(actor);
  if (!moveItem) return { throwing: false };

  const throwing = await Dialog.confirm({
    title: moveItem.name,
    content: `<p>${game.i18n.localize("DWAUTO.StrongArm.Prompt")}</p>`,
    defaultYes: false
  });
  if (!throwing) return { throwing: false };

  announceActionApplied(actor, moveItem.name, game.i18n.localize("DWAUTO.StrongArm.Applied"));
  return { throwing: true };
}

// 사격 7-9 선택지에서 "발수 소비" 항목(설정한 인덱스, 1부터 시작)을
// 제외한다. 인덱스가 범위를 벗어나면(GM이 컴펜디엄 문구를 크게 바꾼 경우)
// 안전하게 원래 목록을 그대로 돌려준다.
export function removeAmmoChoice(options) {
  const index = Number(game.settings.get(MODULE_ID, SETTINGS.STRONG_ARM_AMMO_CHOICE_INDEX));
  if (!Number.isFinite(index) || index < 1 || index > options.length) return options;
  return options.filter((_, i) => i + 1 !== index);
}

export function registerStrongArmAssistant() {
  // 훅이 따로 필요 없다 — attack-assistant.js가 promptStrongArmThrow/removeAmmoChoice를 직접 불러서 쓴다.
}
