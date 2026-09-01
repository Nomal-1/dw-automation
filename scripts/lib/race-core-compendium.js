import { RACE_CORE_MOVES } from "../data/race-core-moves.js";

// GM이 설정 메뉴 버튼(apps/race-core-compendium-menu.js)을 눌렀을 때만
// 실행된다 — 자동으로 실행되지 않는다. 진짜 Foundry 컴펜디엄을 만드는
// 이유는 캐릭터 생성 시점과 무관하게 아무 캐릭터(새 캐릭터든 이미 만들어둔
// 캐릭터든)에게나 드래그해서 넣을 수 있게 하기 위함 — GM이 매번 손으로
// 아이템을 만들 필요가 없다. LevelDB로 미리 컴파일해서 모듈 zip에 담는
// 공식 방식(Foundry CLI, Node.js 필요)이 아니라, 이미 켜져 있는 GM의
// Foundry 서버가 직접 그 자리에서(런타임에) 만드는 방식이라 별도 빌드
// 도구가 필요 없다.
const PACK_NAME = "race-core-moves";
const ICON = "icons/sundries/books/book-symbol-tree-silver-green.webp";

async function getOrCreatePack() {
  const existing = game.packs.get(`world.${PACK_NAME}`);
  if (existing) return existing;

  return CompendiumCollection.createCompendium({
    type: "Item",
    label: game.i18n.localize("DWAUTO.RaceCoreCompendium.PackLabel"),
    name: PACK_NAME,
    system: game.system.id
  });
}

async function getOrCreateFolder(pack, folderName) {
  const existing = pack.folders.find((f) => f.name === folderName);
  if (existing) return existing;

  return Folder.create({ name: folderName, type: "Item", parent: null }, { pack: pack.collection });
}

function buildMoveData(race, officialClassName, folderId) {
  return {
    name: race.name,
    type: "move",
    img: ICON,
    folder: folderId,
    system: {
      name: "",
      description: race.description,
      choices: "",
      moveType: "starting",
      rollFormula: "",
      moveResults: { failure: { value: "" }, partial: { value: "" }, success: { value: "" } },
      class: officialClassName,
      rollType: "",
      rollMod: 0,
      requiresLevel: 0,
      requiresMove: "",
      moveGroup: ""
    }
  };
}

// 이미 있는 폴더/아이템은 건드리지 않고 없는 것만 채워 넣는다 — GM이
// 이름이나 내용을 고쳐놓은 뒤에 이 버튼을 다시 눌러도 덮어써지지 않는다.
export async function createOrUpdateRaceCoreCompendium() {
  const pack = await getOrCreatePack();
  await pack.getIndex();

  let created = 0;
  let skipped = 0;

  for (const classEntry of Object.values(RACE_CORE_MOVES)) {
    const folder = await getOrCreateFolder(pack, classEntry.className);

    for (const race of classEntry.races) {
      if (pack.index.some((e) => e.name === race.name)) {
        skipped++;
        continue;
      }

      await Item.create(buildMoveData(race, classEntry.officialClassName, folder.id), { pack: pack.collection });
      created++;
    }
  }

  return { pack, created, skipped };
}
