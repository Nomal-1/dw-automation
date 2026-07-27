// Cast a Spell류 무브를 실제로 굴리기 *직전에* 활성 지속주문 페널티를 끼워넣는다.
//
// 저희 모듈의 다른 모든 기능은 굴림이 끝난 뒤 채팅 메시지를 보고 반응하는
// 구조인데, 이번엔 주사위가 굴러가기 전에 -1을 반영해야 해서 그 방식이 안 통한다.
// 던전월드 시스템의 무브 굴림은 game.dungeonworld.ItemDw.prototype.roll()을 거쳐
// DwRolls.rollMove()를 호출하는데, DwRolls 자체는 전역에 노출되어 있지 않지만
// ItemDw는 game.dungeonworld.ItemDw로 노출되어 있어 libWrapper로 감쌀 수 있다.
//
// rollMove는 move 타입 아이템의 경우 item.system.rollMod를 그대로 읽어서
// 최종 수식(2d6+능력치+rollMod)에 반영하므로, 실제 굴림 직전에 rollMod를
// 일시적으로(저장하지 않고 메모리에서만) 조정했다가 굴림 후 원복하면 된다.
//
// lib-wrapper는 module.json에 필수 모듈로 등록해뒀으므로 여기서는 항상
// 존재한다고 가정한다.
import { MODULE_ID, SETTINGS } from "../constants.js";
import { computeCastPenalty } from "./ongoing-spells-state.js";

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isCastSpellMove(item) {
  if (item.type !== "move") return false;
  return splitCommaList(SETTINGS.CAST_SPELL_MOVE_NAMES).includes(item.name);
}

async function wrappedRoll(wrapped, ...args) {
  const shouldCheck =
    game.settings.get(MODULE_ID, SETTINGS.ENABLE_SPELLCASTING_ASSISTANT) &&
    this.actor &&
    isCastSpellMove(this);

  if (!shouldCheck) return wrapped(...args);

  const { blocked, amount } = computeCastPenalty(this.actor);

  if (blocked) {
    ui.notifications.warn(game.i18n.format("DWAUTO.Spell.CastBlocked", { name: this.actor.name }));
    return undefined;
  }

  if (amount > 0) {
    const original = this.system.rollMod;
    this.system.rollMod = (Number(original) || 0) - amount;
    try {
      return await wrapped(...args);
    } finally {
      this.system.rollMod = original;
    }
  }

  return wrapped(...args);
}

export function registerSpellcastingWrapper() {
  libWrapper.register(MODULE_ID, "game.dungeonworld.ItemDw.prototype.roll", wrappedRoll, "MIXED");
}
