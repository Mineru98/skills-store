# Skills Store

Codex와 Claude Code에서 재사용하는 프롬프트 자산 저장소입니다.

이 저장소는 두 환경의 자산을 같은 구조로 정리합니다.

- `.claude/` - Claude Code용 명령, 스킬, 프로젝트 룰
- `.codex/` - Codex CLI용 스킬, 에이전트 설정, 규칙
- `AGENTS.md` - 이 저장소에서 따르는 공통 실행 규칙
- `CLAUDE.md` - Claude Code용 저장소 메모
- `LICENSE` - 저장소 라이선스
- `scripts/` - 설치 및 보조 스크립트

## 디렉터리 구조

```text
.
├── AGENTS.md
├── CLAUDE.md
├── LICENSE
├── README.md
├── scripts/
│   └── frontend-setup.sh
├── .claude/
│   ├── commands/
│   ├── rules/
│   │   └── frontend/
│   └── skills/
└── .codex/
    ├── agents/
    ├── config.toml
    ├── rules/
    │   └── frontend/
    └── skills/
```

## Claude Code 자산

### 슬래시 커맨드

`/.claude/commands`

- `commit` - 변경사항을 분석해 커밋 메시지를 생성
- `kill-process` - 포트 기반 프로세스 종료

### 스킬

`/.claude/skills`

- `commands-creator`
- `complete-html-output`
- `[redacted]-validator`
- `excel-data-analyzer`
- `frontend-design`
- `frontend-slides`
- `gpt-55-prompt-architect`
- `imagine`
- `install-skill`
- `landing-page-builder`
- `landing-page-upgrader`
- `make-[redacted]`
- `mcp-builder`
- `playwright-cli`
- `premium-korean-aesthetic`
- `subagents-creator`
- `ui-text-audit`

### 프로젝트 룰

`/.claude/rules/frontend`

세션 시작 시 자동 로드되는 규칙 카탈로그입니다.
`00-index.md` 에 규칙 목록과 각 파일의 스코프가 정리되어 있습니다.

## Codex 자산

### 에이전트

`/.codex/agents`

- `docs-researcher.toml` - OpenAI 문서 MCP를 사용하는 문서 전용 에이전트

### 규칙

`/.codex/rules/frontend`

Claude 룰을 Codex 실행 정책으로 다시 쓴 폴더입니다.
`project-dev-workflow.rules`, `project-safety.rules`, `project-coding-conventions.md` 로 구성됩니다.

### 스킬

`/.codex/skills`

- `commit`
- `complete-html-output`
- `[redacted]-validator`
- `excel-data-analyzer`
- `frontend-design`
- `frontend-slides`
- `gpt-55-prompt-architect`
- `install-skill`
- `kill-process`
- `landing-page-builder`
- `landing-page-upgrader`
- `make-[redacted]`
- `playwright-cli`
- `premium-korean-aesthetic`
- `web-advisor`

## 사용 방법

### Codex 스킬

프로젝트의 `.codex/skills/` 또는 전역 `~/.codex/skills/` 에 둔 스킬을 사용할 수 있습니다.

```text
/commit
/kill-process 3000
```

`install-skill` 로 GitHub URL을 지정하면 다른 Codex 스킬을 내려받을 수 있습니다.

```text
/install-skill https://github.com/Mineru98/skills-store/tree/main/.codex/skills/commit
/install-skill https://github.com/Mineru98/skills-store/tree/main/.codex/skills/kill-process --global
```

### Claude Code 자산

`.claude/commands/` 의 커맨드는 Claude Code에서 `/commit`, `/kill-process` 로 호출됩니다.
`.claude/skills/` 의 스킬은 키워드 자동 감지 또는 Skill 도구로 호출됩니다.

`.claude/rules/frontend/` 는 스코프에 맞는 파일을 읽을 때 자동 로드됩니다.

## 라이선스

MIT License. 자세한 내용은 [LICENSE](LICENSE) 를 참고하세요.
