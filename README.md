# Skills Store

Claude Code를 위한 Skills, Agents, Commands 모음입니다.

## 설치

### macOS / Linux

```bash
chmod +x install.sh
./install.sh
```

### Windows

```cmd
install.bat
```

설치 스크립트는 `~/.claude` 폴더 아래에 각 컴포넌트를 설치합니다. 기존 폴더가 있어도 내용만 추가/업데이트됩니다.

## 컴포넌트

### Skills

| Skill | 설명 |
|-------|------|
| **conventions** | Python, TypeScript, JavaScript, Go, PHP 코딩 컨벤션 및 Git 커밋 규칙 |
| **explaining-code** | 다이어그램과 비유를 활용한 코드 설명 |
| **frontend-design-patterns** | DDD + FSD 기반 React 아키텍처 패턴 |
| **frontend-master** | Gemini CLI를 활용한 프론트엔드 UI/UX 작업 |
| **logic-master** | Codex CLI를 활용한 로직 최적화 및 이미지 기반 코드 생성 |
| **powershell-utf8-fixer** | PowerShell 스크립트 인코딩 문제 해결 (한글 등 비ASCII 문자) |
| **skill-creator** | 새로운 Skill 생성 가이드 |
| **subagents-creator** | Subagent 정의 및 사용 가이드 |
| **webapp-planner** | 고객 요구사항을 기반으로 웹앱 기획 문서 생성 |

### Agents

| Agent | 설명 |
|-------|------|
| **interviewer** | 모호한 요구사항에서 명확한 요구사항 추출 |
| **ui-sketcher** | ASCII 와이어프레임 생성 |
| **documentation-writer** | UX 철학 기반 기술 명세서 작성 |
| **tech-researcher** | localbase 및 클라이언트 사이드 기술 리서치 |
| **mermaid-designer** | Mermaid.js 기반 플로우차트 및 다이어그램 생성 |
| **interactive-designer** | Tailwind 애니메이션 및 마이크로 인터랙션 설계 |
| **planner** | MoSCoW/RICE 기반 우선순위 및 개발 로드맵 수립 |

### Commands

| Command | 설명 |
|---------|------|
| **/commit** | 기능별 그룹화된 Conventional Commits 생성 (한글) |

## 라이선스

GNU AGPL v3 - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
