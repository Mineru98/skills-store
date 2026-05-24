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
- `visual-companion`

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
- `visual-companion`

## 사용 방법

### visual-companion

`visual-companion` 은 Claude나 Codex와 기획 문서를 작성하는 과정에서 시각적인 선택지를 브라우저로 보여주고, 사용자의 선택이나 짧은 입력을 세션으로 다시 전달하는 스킬입니다.

필요한 이유는 Claude나 Codex와 기획 문서를 작성할 때 글로 설명하는 일이 잦기 때문입니다. 문제는 말로만 설명하는 과정에서 서로 어떤 의미인지 정확히 이해하지 못하는 경우가 생긴다는 점입니다. 이 스킬은 그런 상황에서 화면, 레이아웃, 다이어그램, 비교안 같은 시각 자료를 기반으로 의사결정을 할 수 있도록 돕습니다. Superpowers의 특정 시각 선택 기능만 따로 분리해 만든 도구입니다.

독립적으로 이 스킬만 사용할 수도 있고, [ouroboros](https://github.com/Q00/ouroboros)의 interview 와 함께 사용할 수도 있습니다. 또한 [omx](https://github.com/Yeachan-Heo/oh-my-codex), [omc](https://github.com/Yeachan-Heo/oh-my-claudecode)의 deep-interview 흐름과 같이 사용하면 텍스트 질문으로 애매한 선택지를 시각적으로 확인하면서 요구사항을 좁힐 수 있습니다.

기본 사용 흐름은 다음과 같습니다.

1. `visual-companion` 서버를 실행합니다.
2. 에이전트가 선택지, 와이어프레임, 다이어그램, 비교안을 HTML 화면으로 작성합니다.
3. 사용자가 브라우저에서 카드를 클릭하거나 입력을 제출합니다.
4. `wait-for-event.cjs` 가 브라우저 이벤트를 받아 Claude/Codex 세션으로 전달합니다.
5. 에이전트는 받은 선택을 바탕으로 다음 질문, 인터뷰, 기획 문서, 구현 계획을 이어갑니다.

```bash
node .codex/skills/visual-companion/scripts/wait-for-event.cjs "$STATE_DIR" --clear --timeout-ms 600000
node .claude/skills/visual-companion/scripts/wait-for-event.cjs "$STATE_DIR" --clear --timeout-ms 600000
```

이 방식은 사용자가 브라우저에서 선택한 내용을 다시 터미널에 입력하지 않아도 되도록 하기 위한 브리지입니다. Codex나 Claude의 비공개 UI에 메시지를 직접 주입하는 방식이 아니라, 스킬 서버가 기록한 브라우저 이벤트를 에이전트가 제어하는 shell/tool 채널로 읽어오는 방식입니다.

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
