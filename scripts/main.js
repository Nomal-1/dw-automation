import { registerSettings } from "./settings.js";
import { registerNpcGenerator } from "./features/npc-generator.js";
import { registerMonsterGenerator } from "./features/monster-generator.js";
import { registerAttackAssistant } from "./features/attack-assistant.js";
import { registerSpellcastingAssistant } from "./features/spellcasting.js";
import { registerRollWrapper } from "./lib/roll-wrapper.js";
import { registerHitTriggerAssistant } from "./features/hit-trigger.js";
import { registerHealingAssistant } from "./features/healing.js";
import { registerMoveUpgradeAssistant } from "./features/move-upgrades.js";
import { registerDruidAssistant } from "./features/druid.js";
import { registerClassInfoTab } from "./features/class-info-tab.js";
import { registerNoteMoves } from "./features/note-moves.js";
import { registerArmorAssistant } from "./features/armor-assistant.js";
import { registerUnderdogAssistant } from "./features/underdog.js";
import { registerLevelUpInfo } from "./features/level-up-info.js";
import { registerClassGrantAssistant } from "./features/class-grant.js";
import { registerSpellPreparationAssistant } from "./features/spell-preparation.js";

Hooks.once("init", () => {
  registerSettings();
});

// game.dungeonworld.ItemDw(및 다른 시스템/모듈이 등록해두는 전역들)가 전부
// 준비된 뒤에 감싸야 안전하므로 ready에서 등록한다.
Hooks.once("ready", () => {
  registerRollWrapper();
});

registerNpcGenerator();
registerMonsterGenerator();
registerAttackAssistant();
registerSpellcastingAssistant();
registerHitTriggerAssistant();
registerHealingAssistant();
registerMoveUpgradeAssistant();
registerDruidAssistant();
registerClassInfoTab();
registerNoteMoves();
registerArmorAssistant();
registerUnderdogAssistant();
registerLevelUpInfo();
registerClassGrantAssistant();
registerSpellPreparationAssistant();
