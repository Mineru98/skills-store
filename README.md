# Skills Store

![Skills Store overview](assets/images/skills-store-overview.png)

Codex와 Claude Code에서 사용하는 스킬, 에이전트, 명령을 모아 둔 저장소입니다.

## 빠른 사용

- `visual-companion`: 브라우저 기반 시각 자료와 인터랙티브 목업을 만듭니다.
- `install-skill`: GitHub 저장소의 스킬을 설치합니다.
- `irasutoya-search`: 이라스토야 이미지를 검색하고 미리 봅니다.
- `herdr`: Herdr 터미널 멀티플렉서의 pane, tab, workspace를 조회하고 제어합니다.
- `kill-process`: 지정한 포트의 프로세스를 종료합니다.
- `loop` / `schedule`: 프롬프트를 반복 실행하거나 예약합니다.
- `commit`: 요청한 범위의 변경 사항을 목적별 커밋으로 나눕니다.

Claude Code에는 `commands-creator`도 제공합니다. Codex와 Claude Code 공용 스킬은 각 flavor 디렉터리에 맞춰 관리합니다.

## 저장소 구조

```text
.
├── AGENTS.md
├── LICENSE
├── README.md
├── assets/images/
├── .claude/
│   ├── agents/                 # 현재는 songcopy 에이전트
│   ├── commands/
│   └── skills/                 # Claude Code용 일반 스킬
└── .codex/
    ├── agents/                 # 현재는 songcopy 에이전트
    ├── config.toml
    └── skills/                 # Codex용 일반 스킬
```

## 설치와 동기화

`install-skill`로 GitHub 스킬 폴더 URL에서 필요한 항목을 설치합니다.

```text
https://github.com/Mineru98/skills-store/tree/main/.claude/skills/visual-companion 스킬을 설치해 주세요.
```

설치할 때는 `SKILL.md`만 복사하지 말고 해당 스킬 폴더의 references, scripts, flavor별 메타데이터를 함께 유지하세요.

## 개발 환경

- Git
- Node.js 18 이상
- 스킬별 추가 요구사항은 각 `SKILL.md`에 기록합니다.

새 스킬을 추가할 때는 대상 flavor의 디렉터리 구조와 기존 설명 형식을 맞추고, README의 빠른 사용 목록도 함께 갱신합니다.
