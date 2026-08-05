import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, findMoveItem } from "../lib/move-card.js";
import { getMoveChoiceData, promptChoiceSelection } from "../lib/move-choices.js";
import { announceActionApplied } from "../lib/announce.js";
import { getMoveNameMap } from "../lib/translation-import.js";

// 소각술사 핵심 액션 불타는 낙인(Burning Brand) 원문: "roll+CON으로 순수한
// 불꽃의 무기를 소환한다. 이 무기의 공격에는 근력/민첩 대신 지혜를 써도
// 된다. 이 무기는 항상 fiery, touch, dangerous, 3 uses 태그를 갖고
// 시작한다. 이 무기로 공격할 때마다 사용 횟수를 1 소모한다." 부분성공이면
// 추가 태그 하나, 성공이면 추가 태그 둘을 아래 목록에서 고른다: hand /
// thrown, near / +1 damage / dangerous 태그 제거.
//
// 발동하면 결과 등급에 따라 고를 개수를 정하고(공식 컴펜디엄 데이터에
// "success" 결과 텍스트가 "sucess"로 오타 나 있어 실제로는 비어 있으므로,
// lib/move-choices.js의 자동 개수 추정에 기대지 않고 여기서 직접 2/1/0으로
// 고정한다), 선택지 인덱스를 기본 태그에 반영해서 무기 아이템을 인벤토리에
// 만들어준다. 선택지 문구는 번역될 수 있어 텍스트로 매칭하지 않고, 항상
// 같은 순서(hand/thrown,near/+1damage/remove dangerous)라는 전제로 "몇 번째를
// 골랐는지"(인덱스)만 본다 — 이 모듈의 다른 인덱스 기반 표들과 같은 이유다.
// "touch" 태그는 근접 무기 판정 태그 기본값(설정)에도 추가해뒀다(무기 태그
// 자동 반영 설정 참고) — 근접 자동화가 이 무기를 근접으로 인식하게 하기
// 위함이다. "N uses" 태그 소모는 features/attack-assistant.js가 공격
// 데미지를 굴릴 때마다(근접/사격 구분 없이) 처리한다.
const BASE_TAGS = ["fiery", "touch", "dangerous", "3 uses"];
const CHOICE_EFFECTS = [{ addTag: "hand" }, { addTag: "thrown, near" }, { addTag: "+1 damage" }, { removeTag: "dangerous" }];

// 소각술사 고급액션 죽어주는 불꽃(This Killing Fire) 원문: "Add the following
// tags to your options for Burning Brand: messy, forceful, reach, near, far."
// — 이 무브를 가진 채로 불타는 낙인을 쓰면 고를 수 있는 선택지에 이 5개가
// 추가된다(원래 4개 선택지에 이어붙인다). 태그 값 자체는 다른 무기 태그와
// 마찬가지로 영문 그대로 쓴다(근접/사격 태그 자동 인식 설정 등이 영문
// 태그와 비교하기 때문). 표시용 문구만 한국어로 직접 적어둔다(불타는
// 낙인의 기본 4개와 달리 컴펜디엄의 choices 목록에서 자동으로 안 딸려오므로).
const THIS_KILLING_FIRE_EXTRA_EFFECTS = [
  { addTag: "messy", labelKey: "DWAUTO.BurningBrand.ThisKillingFireMessy" },
  { addTag: "forceful", labelKey: "DWAUTO.BurningBrand.ThisKillingFireForceful" },
  { addTag: "reach", labelKey: "DWAUTO.BurningBrand.ThisKillingFireReach" },
  { addTag: "near", labelKey: "DWAUTO.BurningBrand.ThisKillingFireNear" },
  { addTag: "far", labelKey: "DWAUTO.BurningBrand.ThisKillingFireFar" }
];

const USES_TAG_PATTERN = /^(\d+)\s*uses?$/i;

function parseTagsArray(item) {
  try {
    const raw = item.system?.tags;
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function tagsArrayToString(tagsArray) {
  return tagsArray.map((t) => t?.value ?? "").join(", ");
}

// features/hit-trigger.js(불에는 불)가 재사용한다. 이 액터가 지금 갖고
// 있는 불타는 낙인 무기(이 파일이 만든 이름이 같고, "N uses" 태그를 가진
// 장비)를 찾는다 — 원문의 "if active"를 판정하는 데 쓴다. 없으면 null.
export function findBurningBrandWeapon(actor) {
  const weaponName = game.i18n.localize("DWAUTO.BurningBrand.WeaponName");
  return (
    actor.items.find((i) => {
      if (i.type !== "equipment" || i.name !== weaponName) return false;
      return parseTagsArray(i).some((t) => USES_TAG_PATTERN.test((t?.value ?? "").trim()));
    }) ?? null
  );
}

// features/hit-trigger.js가 재사용한다. 불타는 낙인 무기의 "N uses" 태그에
// amount를 더한다(공격 소모는 attack-assistant.js의 consumeWeaponUses가
// 반대로 깎는다). 상한은 두지 않는다 — 화살 등 다른 소모품 태그도 이
// 모듈이 별도 상한을 두지 않는 것과 같다.
export async function addBurningBrandUses(weapon, amount) {
  const tags = parseTagsArray(weapon);
  const idx = tags.findIndex((t) => USES_TAG_PATTERN.test((t?.value ?? "").trim()));
  if (idx === -1) return;

  const match = USES_TAG_PATTERN.exec(tags[idx].value.trim());
  const current = Number(match[1]) || 0;
  const nextTags = [...tags];
  nextTags[idx] = { value: `${current + amount} uses` };

  await weapon.update({
    "system.tags": JSON.stringify(nextTags),
    "system.tagsString": tagsArrayToString(nextTags)
  });
}

function isEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_BURNING_BRAND_ASSISTANT);
}

function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function matchesConfiguredName(title) {
  const configured = splitCommaList(SETTINGS.BURNING_BRAND_MOVE_NAMES);
  if (configured.includes(title)) return true;

  try {
    const nameMap = await getMoveNameMap();
    if (nameMap.get("Burning Brand") === title) return true;
  } catch (err) {
    // 번역 데이터를 못 읽으면 설정값 직접 비교만으로 판단한다.
  }
  return false;
}

function hasThisKillingFire(actor) {
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLE_THIS_KILLING_FIRE_ASSISTANT)) return false;
  const names = splitCommaList(SETTINGS.THIS_KILLING_FIRE_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

async function createBrandWeapon(actor, moveItem, chosenIndexes, effectsList = CHOICE_EFFECTS) {
  let tags = [...BASE_TAGS];
  for (const idx of chosenIndexes) {
    const effect = effectsList[idx - 1];
    if (!effect) continue;
    if (effect.removeTag) tags = tags.filter((t) => t !== effect.removeTag);
    else if (effect.addTag) tags.push(effect.addTag);
  }

  const tagsArray = tags.map((value) => ({ value }));
  const tagsString = tags.join(", ");

  await actor.createEmbeddedDocuments("Item", [
    {
      name: game.i18n.localize("DWAUTO.BurningBrand.WeaponName"),
      type: "equipment",
      img: moveItem.img,
      system: {
        description: game.i18n.localize("DWAUTO.BurningBrand.WeaponDescription"),
        quantity: 1,
        weight: 0,
        uses: 0,
        tags: JSON.stringify(tagsArray),
        tagsString,
        magic: true,
        itemType: "weapon"
      }
    }
  ]);

  announceActionApplied(actor, moveItem.name, game.i18n.format("DWAUTO.BurningBrand.Created", { tags: tagsString }));
}

async function onCreateChatMessage(message, options, userId) {
  try {
    if (game.system.id !== "dungeonworld") return;
    if (!isEnabled()) return;
    if (userId !== game.user.id) return;

    const info = getMoveCardInfo(message);
    if (!info) return;
    const { actor, title, result } = info;
    if (actor.type !== "character") return;
    if (!result) return;

    if (!(await matchesConfiguredName(title))) return;

    const moveItem = findMoveItem(actor, title);
    if (!moveItem) return;

    const count = result === "success" ? 2 : result === "partial" ? 1 : 0;
    const { options: baseChoiceOptions } = getMoveChoiceData(moveItem, result);

    let choiceOptions = baseChoiceOptions;
    let effectsList = CHOICE_EFFECTS;
    if (hasThisKillingFire(actor)) {
      choiceOptions = [...baseChoiceOptions, ...THIS_KILLING_FIRE_EXTRA_EFFECTS.map((e) => game.i18n.localize(e.labelKey))];
      effectsList = [...CHOICE_EFFECTS, ...THIS_KILLING_FIRE_EXTRA_EFFECTS];
    }

    let indexes = [];
    if (count > 0 && choiceOptions.length > 0) {
      indexes = await new Promise((resolve) => {
        promptChoiceSelection({
          title: moveItem.name,
          options: choiceOptions,
          count,
          onConfirm: (_selected, selectedIndexes) => resolve(selectedIndexes),
          onCancel: () => resolve([])
        });
      });
    }

    await createBrandWeapon(actor, moveItem, indexes, effectsList);
  } catch (err) {
    console.error(`${MODULE_ID} | burning-brand: onCreateChatMessage failed`, err);
  }
}

export function registerBurningBrandAssistant() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
