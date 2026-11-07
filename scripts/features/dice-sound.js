import { MODULE_ID, SETTINGS } from "../constants.js";

// 던전월드 시스템 1.10.0(Foundry 14용)은 굴림 채팅 메시지를 만들 때 예전에
// 넣던 `chatData.sound = CONFIG.sounds.dice`를 뺐고, Foundry 14는 ChatMessage의
// sound 필드를 더 이상 쓰지 않는다. 그래서 14에서는 무브 굴림(시스템)과 이
// 모듈이 만드는 데미지 굴림 모두 주사위 소리가 나지 않는다.
//
// 이 훅이 그 자리를 메운다. 굴림 결과(.dice-roll/.dice-total)가 들어 있는 새
// 던전월드 채팅 카드를 보면 코어의 주사위 소리를 로컬에서 재생한다.
// - message.sound가 있으면(sound 필드를 처리하는 12/13) 코어가 이미 소리를
//   내므로 건너뛴다 — 중복 재생 방지.
// - Dice So Nice가 있으면 그 모듈이 자기 소리를 내므로 건너뛴다.
// createChatMessage는 모든 클라이언트에서 각자 실행되므로, 예전 sound 필드와
// 같이 접속한 모두의 화면에서 소리가 난다(push는 켜지 않는다).
const RECENT_MS = 5000;

function isEnabled() {
  return game.settings.get(MODULE_ID, SETTINGS.ENABLE_DICE_SOUND_FALLBACK);
}

function onCreateChatMessage(message) {
  if (!isEnabled()) return;
  if (game.dice3d) return;
  if (message.sound) return;
  if (Date.now() - message.timestamp > RECENT_MS) return;
  if (message.visible === false) return;

  const src = CONFIG.sounds?.dice;
  if (!src) return;

  const $content = $("<div>").html(message.content);
  if ($content.find(".dice-roll, .dice-total").length === 0) return;

  const AudioHelperClass = foundry.audio?.AudioHelper ?? AudioHelper;
  AudioHelperClass.play({ src, volume: 1, autoplay: true, loop: false, context: game.audio?.interface }, false);
}

export function registerDiceSoundFallback() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
