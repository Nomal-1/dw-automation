import { MODULE_ID } from "../constants.js";
import { BASE_OPTIONS, RANGE_OPTIONS, ENHANCEMENT_OPTIONS, LOOK_OPTIONS } from "../data/signature-weapon-tables.js";
import { computeSignatureWeapon } from "../lib/signature-weapon-builder.js";
import { announceActionApplied } from "../lib/announce.js";

const ITEM_ID_FLAG = "signatureWeaponItemId";
// features/improved-weapon.js가 재사용한다 — 무기 강화를 발동했을 때
// "이미 고른 강화가 뭔지"를 알아야 나머지 중에서만 다시 고르게 할 수
// 있다(플래그 이름을 두 곳에서 따로 관리하면 어긋날 위험이 있어 여기서만
// 정의해 그대로 export한다).
export const ENHANCEMENTS_FLAG = "signatureWeaponEnhancements"; // string[] (ENHANCEMENT_OPTIONS의 value들)

function mapRadioOptions(options, current) {
  return options.map((o) => ({ ...o, checked: o.value === current }));
}

function mapCheckOptions(options, currentMap) {
  return options.map((o) => ({ ...o, checked: Boolean(currentMap?.[o.value]) }));
}

// 전사 핵심액션 고유병기(Signature Weapon) 절차를 그대로 옮긴 폼(기본
// 형태/사정거리/강화 2개/외양을 고르고 이름을 짓는다). 제출하면
// lib/signature-weapon-builder.js가 계산하고, 이 파일이 무기 아이템을
// 만들어서 액터에게 준다. features/signature-weapon.js가 "이미 고유병기가
// 있는지" 확인한 뒤에만 이 창을 연다 — 여기서는 항상 새로 만든다.
export class SignatureWeaponBuilderApp extends FormApplication {
  constructor(actor, moveItem, options = {}) {
    super(actor, options);
    this.moveItem = moveItem;
  }

  get actor() {
    return this.object;
  }

  get title() {
    return game.i18n.format("DWAUTO.SignatureWeapon.Title", { name: this.actor.name });
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-signature-weapon-builder",
      template: `modules/${MODULE_ID}/templates/signature-weapon-builder.html`,
      width: 560,
      height: "auto",
      closeOnSubmit: true,
      resizable: true
    });
  }

  getData() {
    return {
      baseOptions: mapRadioOptions(BASE_OPTIONS, "Sword"),
      rangeOptions: mapRadioOptions(RANGE_OPTIONS, "hand"),
      enhancementOptions: mapCheckOptions(ENHANCEMENT_OPTIONS, {}),
      extraRangeOptions: RANGE_OPTIONS,
      lookOptions: mapRadioOptions(LOOK_OPTIONS, "ancient")
    };
  }

  async _updateObject(event, formData) {
    const data = foundry.utils.expandObject(formData);
    const result = computeSignatureWeapon(data);

    const name = result.name || game.i18n.localize("DWAUTO.SignatureWeapon.DefaultName");
    const tagsArray = result.tags.map((value) => ({ value }));
    const tagsString = result.tags.join(", ");

    const [created] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name,
        type: "equipment",
        img: this.moveItem.img,
        system: {
          description: result.description,
          quantity: 1,
          weight: result.weight,
          uses: 0,
          tags: JSON.stringify(tagsArray),
          tagsString,
          magic: false,
          itemType: "weapon"
        }
      }
    ]);

    const chosenEnhancements = ENHANCEMENT_OPTIONS.filter((o) => data.enhancements?.[o.value]).map((o) => o.value);

    await this.actor.setFlag(MODULE_ID, ITEM_ID_FLAG, created.id);
    await this.actor.setFlag(MODULE_ID, ENHANCEMENTS_FLAG, chosenEnhancements);

    announceActionApplied(
      this.actor,
      this.moveItem.name,
      game.i18n.format("DWAUTO.SignatureWeapon.Created", { name, tags: tagsString, weight: result.weight })
    );
  }
}
