# Skills Store

Codex와 Claude Code 환경에서 재사용할 수 있는 프롬프트 자산(스킬·커맨드·룰)을 모아둔 저장소입니다.

이 저장소는 두 환경의 자산을 나란히 보관합니다.

- `.codex/` — Codex CLI 용 스킬과 응답 규칙(`AGENTS.md`)
- `.claude/` — Claude Code 용 스킬, 슬래시 커맨드, 프로젝트 룰

## 디렉터리 구조

```
.
├── .codex/
│   ├── AGENTS.md           # Codex 응답 규칙
│   └── skills/             # Codex 스킬
├── .claude/
│   ├── commands/           # Claude 슬래시 커맨드
│   ├── rules/              # Claude 프로젝트 룰
│   └── skills/             # Claude 스킬
├── AGENTS.md               # 프로젝트 공통 응답 규칙
├── CLAUDE.md               # Claude 전용 프로젝트 메모
└── LICENSE
```

## Codex 자산

`/.codex/skills`

| Skill | 설명 |
| --- | --- |
| `commit` | 변경 파일을 목적별로 묶어 한국어 Conventional Commit 메시지를 생성 |
| `gpt-55-prompt-architect` | GPT-5.5용 프롬프트 설계·마이그레이션·리뷰 가이드 |
| `install-skill` | GitHub 스킬 폴더 URL로 다른 Codex 스킬을 자동 설치 |
| `kill-process` | 지정한 포트에서 실행 중인 프로세스를 찾아 종료 |
| `playwright-cli` | Playwright CLI/도구로 브라우저 자동화 작업 수행 |

## Claude 자산

### 슬래시 커맨드

`/.claude/commands`

| Command | 설명 |
| --- | --- |
| `commit` | 변경사항을 분석해 그룹화된 커밋 생성 |
| `kill-process` | 포트 기반 프로세스 종료 |

### 스킬

`/.claude/skills`

| Skill | 설명 |
| --- | --- |
| `commands-creator` | Claude 슬래시 커맨드 작성·관리 가이드 |
| `excel-data-analyzer` | 엑셀 파일 데이터 품질 분석 자동화 |
| `frontend-slides` | 단일 HTML 기반 애니메이션 프레젠테이션 생성 |
| `gpt-55-prompt-architect` | GPT-5.5용 프롬프트 설계·마이그레이션·리뷰 가이드 |
| `imagine` | Codex 이미지 모델로 텍스트→이미지·이미지→이미지 생성 |
| `install-skill` | GitHub URL 기반 Claude 스킬 설치 |
| `mcp-builder` | MCP 서버 개발 가이드 |
| `playwright-cli` | Playwright CLI 사용 가이드 |
| `subagents-creator` | Claude 서브에이전트 정의·운용 가이드 |

### 프로젝트 룰

`/.claude/rules/frontend`

세션 시작 시 자동 로드되는 팀 공유 룰입니다. 카탈로그는 `00-index.md` 를 참조하세요.

| Rule | 스코프 | 요약 |
| --- | --- | --- |
| `architecture.md` | 전역 | 5계층 Clean Architecture, 단방향 의존, Feature View 패턴 |
| `typescript.md` | `**/*.ts(x)` | `type` 우선, `import type` 강제, 명시적 반환 타입 |
| `react-components.md` | `**/*.tsx` | 함수 컴포넌트 선언, Props 분리, memo/forwardRef 조건 |
| `styling-emotion.md` | `**/*.styles.ts` | CSS-in-JS 분리, 테마 토큰 강제 |
| `state-management.md` | `store/`, `hooks/api/` | 서버/클라이언트 상태 분리(React Query + Zustand) |
| `api-infrastructure.md` | `infrastructure/` | HTTP 어댑터·DTO·서비스 분리 |
| `naming-conventions.md` | 전역 | 폴더/파일/심볼 네이밍 규칙 |
| `testing.md` | `**/*.test.*` | 테스트 도구 도입 후 따를 규약 |
| `workflow-build.md` | 전역 | `lint → type-check → build` 검증 순서, 배포 원칙 |

## 사용 방법

### Codex 스킬 사용

저장소의 스킬은 `~/.codex/skills/` (전역) 또는 프로젝트의 `.codex/skills/` 에 배치해 사용합니다.

```text
/commit
/kill-process 3000
```

`install-skill` 로 GitHub URL을 지정하면 다른 Codex 스킬을 바로 내려받을 수 있습니다.

```text
/install-skill https://github.com/Mineru98/skills-store/tree/main/.codex/skills/commit
/install-skill https://github.com/Mineru98/skills-store/tree/main/.codex/skills/kill-process --global
```

### Claude 자산 사용

`.claude/commands/` 의 커맨드는 Claude Code 안에서 `/commit`, `/kill-process` 형태로 호출됩니다. `.claude/skills/` 의 스킬은 키워드 자동 감지 또는 `Skill` 도구로 명시 호출됩니다(`/imagine ...`, `/frontend-slides`, `/excel-data-analyzer` 등).

`.claude/rules/frontend/` 는 해당 glob 과 일치하는 파일을 읽을 때 자동 로드되어 프로젝트별 컨벤션을 강제합니다.

## 라이선스

MIT License. 자세한 내용은 [LICENSE](LICENSE) 를 참고하세요.
