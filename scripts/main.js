import { registerSettings } from "./settings.js";
import { registerNpcGenerator } from "./features/npc-generator.js";
import { registerMonsterGenerator } from "./features/monster-generator.js";
import { registerAttackAssistant } from "./features/attack-assistant.js";

Hooks.once("init", () => {
  registerSettings();
});

registerNpcGenerator();
registerMonsterGenerator();
registerAttackAssistant();
