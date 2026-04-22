# Rules Index

## 적용 범위
모든 세션 시작 시 로드되는 **규칙 카탈로그**입니다. 각 규칙 파일의 목적과 스코프를 한눈에 파악할 수 있도록 요약만 제공합니다. 구체적인 규칙 본문은 각 파일을 직접 참조하세요.

> 대규모 프로젝트의 경우 `.claude/rules/` 디렉토리를 사용하여 지침을 여러 파일로 구성할 수 있습니다. (Claude Code 공식 문서)

## 원칙
- 한 파일 = 한 주제. 파일당 200줄 이하 유지.
- 경로 스코프(`paths` frontmatter) 로 불필요한 컨텍스트 주입 최소화.
- "컨텍스트"로서의 규칙일 뿐, 하드 강제가 필요하면 `permissions.deny` 등 settings 로 보완.
- 사용자 개인 선호도는 `~/.claude/rules/` 로 이동 — 이 저장소에는 팀 공유 규칙만 둡니다.

## 규칙 카탈로그

| 파일 | 스코프 | 요약 |
| --- | --- | --- |
| [`architecture.md`](./architecture.md) | 전역 | 단방향 의존, 경로 별칭, thin router, Feature View 패턴. |
| [`typescript.md`](./typescript.md) | `**/*.ts`, `**/*.tsx` | `type` 우선, `\| null` 표현, 명시적 반환 타입, `import type` 강제. |
| [`react-components.md`](./react-components.md) | `**/*.tsx`, `**/types.ts` | 함수 컴포넌트 선언, Props 분리, memo/forwardRef 사용 조건. |
| [`styling-emotion.md`](./styling-emotion.md) | `**/styles.ts`, `**/style.ts`, `**/*.styles.ts` | CSS-in-JS 분리·테마 토큰 강제(스택 중립 + 본 프로젝트 Emotion 가이드). |
| [`state-management.md`](./state-management.md) | `**/store/**/*.ts`, `**/hooks/api/**/*.ts` | 서버/클라이언트 상태 분리(스택 중립 + 본 프로젝트 Zustand + React Query). |
| [`api-infrastructure.md`](./api-infrastructure.md) | `**/infrastructure/**/*.ts` | HTTP 어댑터·DTO·서비스 분리(스택 중립 + 본 프로젝트 axios 가이드). |
| [`naming-conventions.md`](./naming-conventions.md) | 전역 | 폴더/파일/심볼 네이밍 + 단수→복수 마이그레이션 조항. |
| [`testing.md`](./testing.md) | `**/*.test.ts(x)`, `**/*.stories.*` | **상태: 미도입.** 도구 도입 PR 선행, 도입 후 따를 규약. |
| [`workflow-build.md`](./workflow-build.md) | 전역 | `lint → type-check → build` 원칙(스택 중립 + 본 프로젝트 구현). |

## 규칙 번호 프리픽스

기본 포맷은 `<TOPIC>-<NNN>` (예: `ARCH-001`). **외부 공유 또는 모노레포 차용 시 `{PROJECT}-{TOPIC}-{NNN}` 네임스페이스 권장** — 다른 팀 규칙과 ID 충돌을 막습니다.

| 프리픽스 | 주제 | 파일 |
| --- | --- | --- |
| `ARCH` | Architecture | `architecture.md` |
| `TS` | TypeScript | `typescript.md` |
| `COMP` | React Components | `react-components.md` |
| `STYLE` | Styling | `styling-emotion.md` |
| `STATE` | State Management | `state-management.md` |
| `API` | API / Infrastructure | `api-infrastructure.md` |
| `NAME` | Naming | `naming-conventions.md` |
| `TEST` | Testing | `testing.md` |
| `BUILD` | Build / Deploy | `workflow-build.md` |

## 디버깅 팁
- 규칙이 적용되지 않을 때: `/memory` 로 현재 로드된 파일 확인.
- `paths` 가 걸려 있으면 **해당 glob 과 일치하는 파일을 읽을 때만** 로드됩니다.
- 모순이 있으면 Claude 가 임의로 선택하므로, 이 인덱스를 통해 규칙 간 중복/충돌을 정기 점검하세요.
- **CI 자동화 권장**: rules 간 키워드(`any`, `dto.ts`, `staleTime` 등) 충돌 검사 스크립트를 lint 단계에 추가.

## 컨텍스트 비용 (전역 로드)
frontmatter 없는 파일이 매 세션 자동 로드됩니다.

| 파일 | 줄 수(상한) |
| --- | --- |
| `00-index.md` | ~60 |
| `architecture.md` | ≤200 |
| `naming-conventions.md` | ≤200 |
| `workflow-build.md` | ≤200 |
| **합계 (상한)** | **≤860줄 / 약 8K tokens** |

스코프된 5개 파일은 일치하는 파일을 읽을 때만 추가 로드됩니다.