# Skills Store

Codex와 Claude 환경에서 재사용할 수 있는 프롬프트 자산을 모아둔 저장소입니다.

현재 기준으로 이 저장소는 `Codex`용 스킬을 주 관리 대상으로 두고 있고, 기존 `Claude`용 커맨드와 스킬도 함께 보관합니다.

## 구성

### Codex 자산

`/.codex/skills`

현재 포함된 스킬:

| Skill | 설명 |
| --- | --- |
| `commit` | 변경 파일을 목적별로 묶어 한국어 Conventional Commit을 생성 |
| `inst-skill` | GitHub 스킬 폴더 URL로 Codex 스킬을 설치 |
| `kill-process` | 지정한 포트에서 실행 중인 프로세스를 찾아 종료 |
| `playwright-cli` | 브라우저 자동화 작업에서 Playwright 도구 또는 CLI 사용 가이드 제공 |

### Claude 자산

`/.claude/commands`

현재 포함된 커맨드:

| Command | 설명 |
| --- | --- |
| `commit` | 변경사항을 분석해 커밋 생성 |
| `kill-process` | 포트 기반 프로세스 종료 |

`/.claude/skills`

현재 포함된 스킬:

| Skill | 설명 |
| --- | --- |
| `commands-creator` | Claude 커맨드 작성 가이드 |
| `conventions` | 언어별 코딩/커밋 규칙 모음 |
| `excel-data-analyzer` | 엑셀 데이터 분석 자동화 |
| `inst-skill` | GitHub URL 기반 스킬 설치 |
| `mcp-builder` | MCP 서버 개발 가이드 |
| `playwright-cli` | Playwright CLI 사용 가이드 |
| `subagents-creator` | 서브에이전트 정의와 운용 가이드 |

## 사용 방법

### Codex에서 스킬 사용

이 저장소의 스킬은 일반적으로 `~/.codex/skills/` 또는 프로젝트의 `.codex/skills/` 아래에 배치해 사용합니다.

예시:

```text
$commit
$kill-process 3000
```

`inst-skill` 스킬을 사용하면 GitHub의 스킬 폴더 URL로 다른 Codex 스킬을 바로 내려받을 수 있습니다.

예시:

```text
/inst-skill https://github.com/Mineru98/skills-store/tree/main/.codex/skills/commit
/inst-skill https://github.com/Mineru98/skills-store/tree/main/.codex/skills/kill-process --global
```

### Claude 자산 사용

기존 Claude용 자산은 `.claude/commands/`, `.claude/skills/` 구조를 유지한 채 보관되어 있습니다. Codex용 자산과 별개로 참고하거나 마이그레이션 용도로 사용할 수 있습니다.

## 참고 사항

- 루트에는 별도 설치 스크립트(`install.sh`, `install.bat`)가 없습니다.
- 일부 오래된 Claude 자산 파일은 현재 인코딩 상태가 고르지 않을 수 있습니다.
- 최근 변경사항은 `.codex/skills` 기준으로 관리되고 있습니다.

## 라이선스

GNU AGPL v3. 자세한 내용은 [LICENSE](LICENSE)를 참고하세요.
