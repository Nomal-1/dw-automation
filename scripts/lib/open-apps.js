// 지금 열려 있는 창(Application) 목록.
//
// V12까지는 ui.windows(AppV1)에 모든 창이 들어 있었지만, V13부터 설정 화면
// 같은 코어 창이 AppV2로 바뀌면서 foundry.applications.instances에 따로
// 담긴다. 던전월드 시스템의 시트는 아직 AppV1이라 ui.windows에 남아 있으므로
// 둘을 합쳐서 돌려준다. 어느 쪽 저장소가 없는 버전이어도 그쪽은 건너뛴다.
export function listOpenApps() {
  const apps = [];

  try {
    apps.push(...Object.values(ui.windows ?? {}));
  } catch (_error) {
    // ui.windows가 사라진 버전에서는 AppV2 목록만 쓴다.
  }

  const v2Instances = foundry.applications?.instances;
  if (v2Instances) apps.push(...v2Instances.values());

  return apps;
}

// 설정 화면 클래스. V13+에서는 foundry.applications.settings 아래로 옮겨졌고,
// 그 이전 버전에서는 전역 SettingsConfig를 쓴다.
export function getSettingsConfigClass() {
  return foundry.applications?.settings?.SettingsConfig ?? globalThis.SettingsConfig ?? null;
}
