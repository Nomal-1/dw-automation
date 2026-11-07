import { MODULE_ID } from "../constants.js";
import { getBackups, restoreBackup } from "../lib/migration-backup.js";

// 마이그레이션 직전에 자동으로 만들어 둔 백업 목록을 보여주고, 하나를 골라 그 시점의
// 설정값과 캐릭터 플래그로 되돌리는 도구창(lib/migration-backup.js 참고).
export class MigrationBackupMenu extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dwauto-migration-backup",
      title: game.i18n.localize("DWAUTO.MigrationBackup.Title"),
      template: `modules/${MODULE_ID}/templates/migration-backup.html`,
      width: 520,
      closeOnSubmit: false
    });
  }

  getData() {
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

  activateListeners(html) {
    super.activateListeners(html);

    html.find('[data-action="restore"]').on("click", async (event) => {
      event.preventDefault();
      const takenAt = Number(event.currentTarget.dataset.takenAt);

      const confirmed = await Dialog.confirm({
        title: game.i18n.localize("DWAUTO.MigrationBackup.ConfirmTitle"),
        content: `<p>${game.i18n.localize("DWAUTO.MigrationBackup.ConfirmContent")}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;

      try {
        const result = await restoreBackup(takenAt);
        ui.notifications.info(
          game.i18n.format("DWAUTO.MigrationBackup.Restored", {
            settings: result.settingsRestored,
            actors: result.actorsRestored
          })
        );
        this.render();
      } catch (err) {
        console.error(`${MODULE_ID} | migration backup restore failed`, err);
        ui.notifications.error(game.i18n.localize("DWAUTO.MigrationBackup.RestoreFailed"));
      }
    });

    html.find('[data-action="close-menu"]').on("click", (event) => {
      event.preventDefault();
      this.close();
    });
  }

  // 저장 폼이 아니라 복원 버튼만 있는 도구창이다.
  async _updateObject() {}
}
