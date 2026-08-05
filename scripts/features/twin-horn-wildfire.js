import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo } from "../lib/move-card.js";
import { announceInfo } from "../lib/announce.js";

// 소각술사 고급액션(6레벨 이후) 쌍각의 들불 지침: "생각의 발신 액션을
// 사용해서 실패하지 않았으면 채팅창에 [쌍각의 들불 적용 가능]이라고
// 메시지만 띄워줘." 상태를 저장하거나 뭔가를 자동으로 바꾸지 않는, 순수
// 안내용 자동화다 — 실제로 쌍각의 들불을 어떻게 적용할지는 마스터/플레이어가
// 그 자리에서 서술로 처리한다.
//
// "생각의 발신"/"쌍각의 들불" 둘 다 공식 던전월드 컴펜디엄에서 확인되지
// 않는 이름이라(이 세계관 자체의 확장 컨텐츠로 보인다), 다른 무브들과 달리
// 번역 모듈 자동 채우기 대상에는 넣지 않았다 — 설정값 기본값 자체를 이미
// 한국어 원문으로 둔다.
function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_TWIN_HORN_WILDFIRE_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, result } = info;
    if (actor.type !== "character") return;
    if (!result || result === "failure") return;

    const sendThoughtsNames = splitCommaList(SETTINGS.SEND_THOUGHTS_MOVE_NAMES);
    if (!sendThoughtsNames.includes(title)) return;

    const wildfireNames = splitCommaList(SETTINGS.TWIN_HORN_WILDFIRE_MOVE_NAMES);
    const wildfireItem = actor.items.find((i) => i.type === "move" && wildfireNames.includes(i.name));
    if (!wildfireItem) return;

    // 실제 효과 문구는 이 무브 자체가 컴펜디엄에 없어서 우리가 알 방법이
    // 없다 — 대신 액터가 갖고 있는 그 무브 아이템에 이미 적혀 있는 설명을
    // 그대로 안내 메시지에 같이 보여준다(GM이 시트에 직접 적어둔 효과 문구).
    const description = wildfireItem.system?.description ?? "";
    announceInfo(
      actor,
      `${game.i18n.localize("DWAUTO.TwinHornWildfire.Available")}${description ? `<br>${description}` : ""}`
    );
  } catch (err) {
    console.error(`${MODULE_ID} | twin-horn-wildfire: onCreateChatMessage failed`, err);
  }
}

export function registerTwinHornWildfireAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
