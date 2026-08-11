// 치유(healing.js), 원조/방해(aid-or-interfere.js)처럼 "이 씬에 있는 다른
// 액터 중 하나를 대상으로 고르는" 공용 드롭다운. 캔버스에서 타겟팅해둔
// 토큰이 있으면 그걸 기본 선택값으로 띄운다(던전월드 데미지 버튼과는 무관한
// 별도의 타겟팅이라 서로 간섭하지 않는다). GM이 아닌 사용자에게는 최소
// 관찰(Observer) 권한이 있는 액터만 후보로 보여준다 — 권한이 없는 대상은
// 적인지 아군인지 애매한 정체가 새어나갈 수 있으므로 이름조차 노출하지 않는다.
export function getCandidateActors(self, { excludeSelf = false, filter = null } = {}) {
  const sceneActors = canvas.tokens?.placeables?.map((t) => t.actor).filter(Boolean) ?? [];
  const visible = sceneActors.filter((a) => game.user.isGM || a.testUserPermission(game.user, "OBSERVER"));
  let unique = Array.from(new Map(visible.map((a) => [a.id, a])).values());
  if (filter) unique = unique.filter(filter);

  if (excludeSelf) return unique.filter((a) => a.id !== self.id);
  if (!unique.some((a) => a.id === self.id)) unique.unshift(self);
  return unique;
}

// excludeSelf: 자기 자신은 후보에서 뺀다(원조/방해처럼 "다른 사람"이어야
// 말이 되는 경우). selfLabel: 자기 자신 항목 옆에 붙일 안내문구(예: "자신").
// filter: 후보를 더 좁히는 선택적 조건(예: 위저드 Know-It-All의 "다른
// 플레이어의 캐릭터"처럼 actor.type === "character"만 보여줘야 하는 경우).
// 후보가 하나도 없으면(관찰 권한이 있는 다른 액터가 씬에 없음) 다이얼로그를
// 띄우지 않고 바로 null을 돌려준다.
export function promptActorTarget(self, { title, label, excludeSelf = false, selfLabel = null, filter = null } = {}) {
  const candidates = getCandidateActors(self, { excludeSelf, filter });
  if (candidates.length === 0) return Promise.resolve(null);

  // 우선순위: 캔버스에서 타겟팅해둔 대상 > 자기 자신(후보에 있다면) > 목록
  // 맨 앞. 자기 자신의 토큰이 씬에 이미 있으면 unique 배열 안에서의 위치가
  // 맨 앞이라는 보장이 없으므로, "후보에 있다면"을 인덱스가 아니라 id로
  // 직접 확인한다.
  const targeted = Array.from(game.user.targets ?? [])[0]?.actor;
  let defaultId;
  if (targeted && candidates.some((a) => a.id === targeted.id)) {
    defaultId = targeted.id;
  } else if (!excludeSelf && candidates.some((a) => a.id === self.id)) {
    defaultId = self.id;
  } else {
    defaultId = candidates[0].id;
  }

  const options = candidates
    .map((a) => {
      const optionLabel = a.id === self.id && selfLabel ? `${a.name} (${selfLabel})` : a.name;
      return `<option value="${a.id}" ${a.id === defaultId ? "selected" : ""}>${optionLabel}</option>`;
    })
    .join("");

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title,
      content: `
        <form>
          <div class="form-group">
            <label>${label}</label>
            <select name="target">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const id = html.find('[name="target"]').val();
            finish(candidates.find((a) => a.id === id) ?? null);
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => finish(null)
        }
      },
      default: "ok",
      close: () => finish(null)
    }).render(true);
  });
}

// promptActorTarget과 같은 후보 목록(씬에 있는 토큰의 액터)을 쓰되, 하나가
// 아니라 원하는 만큼(0개 포함) 체크박스로 고르게 한다. 대도적(Heist)의
// "필드 위 아군 토큰을 임의의 수만큼 선택"처럼 다중 대상이 필요한 경우를
// 위한 것 — 후보가 하나도 없으면 다이얼로그 없이 바로 빈 배열을 돌려준다.
export function promptActorMultiTarget(self, { title, label, excludeSelf = false, filter = null } = {}) {
  const candidates = getCandidateActors(self, { excludeSelf, filter });
  if (candidates.length === 0) return Promise.resolve([]);

  const optionsHtml = candidates
    .map(
      (a) => `
        <div class="form-group dwauto-choice-option">
          <label><input type="checkbox" name="dwautoMultiTarget" value="${a.id}"> ${a.name}</label>
        </div>
      `
    )
    .join("");

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title,
      content: `<form><p>${label}</p>${optionsHtml}</form>`,
      buttons: {
        ok: {
          label: game.i18n.localize("DWAUTO.Confirm"),
          callback: (html) => {
            const ids = html
              .find('[name="dwautoMultiTarget"]:checked')
              .map((_, el) => el.value)
              .get();
            finish(candidates.filter((a) => ids.includes(a.id)));
          }
        },
        cancel: {
          label: game.i18n.localize("DWAUTO.Cancel"),
          callback: () => finish([])
        }
      },
      default: "ok",
      close: () => finish([])
    }).render(true);
  });
}
