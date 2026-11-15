import { MODULE_ID } from "../constants.js";
import { getBackups, restoreBackup } from "../lib/migration-backup.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// 마이그레이션 직전에 자동으로 만들어 둔 백업 목록을 보여주고, 하나를 골라 그 시점의
// 설정값과 캐릭터 플래그로 되돌리는 도구창(ApplicationV2, lib/migration-backup.js 참고).
export class MigrationBackupMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dwauto-migration-backup",
    window: { title: "DWAUTO.MigrationBackup.Title" },
    position: { width: 520 },
    actions: {
      restore: MigrationBackupMenu.#onRestore,
      "close-menu": MigrationBackupMenu.#onCloseMenu
    }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/migration-backup.html` } };

  async _prepareContext() {
    const backups = getBackups()
      .map((b) => ({
        takenAt: b.takenAt,
        date: new Date(b.takenAt).toLocaleString(game.i18n.lang),
        fromVersion: b.fromVersion,
        toVersion: b.toVersion,
        label: b.label,
        settingCount: Object.keys(b.settings ?? {}).length,
        actorCount: Object.keys(b.actorFlags ?? {}).length
      }))
      .reverse();
    return {
      hint: game.i18n.localize("DWAUTO.MigrationBackup.Hint"),
      empty: backups.length === 0,
      emptyText: game.i18n.localize("DWAUTO.MigrationBackup.Empty"),
      backups
    };
  }

  static async #onRestore(event, button) {
    event.preventDefault();
    const takenAt = Number(button.dataset.takenAt);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "DWAUTO.MigrationBackup.ConfirmTitle" },
      content: `<p>${game.i18n.localize("DWAUTO.MigrationBackup.ConfirmContent")}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;
    try {
      const result = await restoreBackup(takenAt);
      ui.notifications.info(
        game.i18n.format("DWAUTO.MigrationBackup.Restored", { settings: result.settingsRestored, actors: result.actorsRestored })
      );
      this.render();
    } catch (err) {
      console.error(`${MODULE_ID} | migration backup restore failed`, err);
      ui.notifications.error(game.i18n.localize("DWAUTO.MigrationBackup.RestoreFailed"));
    }
  }

  static #onCloseMenu(event) {
    event.preventDefault();
    this.close();
  }
}
