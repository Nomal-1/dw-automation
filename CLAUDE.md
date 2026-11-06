# CLAUDE.md

이 저장소는 던전월드 Foundry VTT 모듈 **던전월드 자동화 툴킷**(`dw-automation`)입니다.
모듈 전체 목록, 공통 작업 규칙, 릴리즈 절차, Foundry 14 대응 현황은 **`Nomal-1/dw-workspace`
저장소의 `CLAUDE.md`와 `STATUS.md`**가 기준입니다(비공개 저장소 — 접근할 수 있으면 먼저 읽으세요).
아래는 그 저장소를 못 읽을 때를 위한 최소 규칙입니다.

## 작업 규칙

- 채팅(사용자에게 하는 설명)은 **항상 한국어**, 코드와 커밋 메시지는 **영어**. 릴리즈 노트는 한국어.
- 사용자는 코딩 초보입니다. 무엇을 왜 바꿨는지 쉬운 말로 설명하세요.
- 설계가 갈리는 지점은 구현 전에 트레이드오프를 짧게 설명하고 사용자 결정을 기다리세요.
- 푸시·릴리즈 같이 밖으로 나가는 작업은 사용자가 요청했거나 승인한 범위에서만 하세요.
- 번역된 자유 텍스트로 로직을 분기하지 않습니다(자세한 원칙은 `Nomal-1/dw-automation`의 `ARCHITECTURE.md`).
- 이 모듈은 운영 서버(Foundry 12.331) 호환을 유지하면서 Foundry 14로 올라가는 중입니다. 13+에서만
  되는 API를 쓸 때는 12에서도 동작하는 대안(분기, fallback)을 함께 넣으세요.

## 릴리즈 (GitHub에서만)

기본 브랜치 `main`에 푸시한 뒤, GitHub에서 태그 `vX.Y.Z`로 릴리즈를 **게시(publish)** 하면
`.github/workflows/release.yml`이 태그에서 버전을 읽어 `module.json`의 `version`을 맞추고 `module.zip`을 만들어 릴리즈에 올립니다(Actions 탭에서 성공 여부 확인).
릴리즈 노트는 한국어로 씁니다. `compatibility.verified`는 그 Foundry 버전에서 실제로 확인한 뒤에만 올립니다.
