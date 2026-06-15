---
name: e2e-harness-setup
description: >-
  AI 에이전트가 E2E 테스트를 스스로 작성·운영하도록 "테스트 하네스" 4종(AGENTS.md 코드베이스 안내, E2E 운영규칙 SSOT,
  공용 fixture/헬퍼, MCP 서버 배선)을 신규 온보딩처럼 부트스트랩한다. 에이전트는 기본적으로 테스트 전략·도메인 지식·프로젝트
  구조 맥락이 없으므로(인증 함수명, 만료 에러코드, baseURL 결정 방식 등 "우리만 아는 맥락") 이를 명시적으로 적어줘야 한다는
  통찰을 구현한다. 다음 상황에서 반드시 사용한다: "E2E 하네스 구축/세팅", "에이전트가 테스트를 잘 못 짠다 / 맥락을 모른다",
  "Playwright 테스트 자동화 환경 만들기", "AGENTS.md 또는 E2E 규칙 문서 만들기", "테스트용 storageState/fixture
  세팅", "테스트 컨텍스트용 MCP 연결". Trigger on English too: "set up an E2E test harness for AI agents",
  "bootstrap Playwright e2e so Claude can write tests", "agent has no context about our test conventions",
  "create AGENTS.md and a test SSOT doc", "wire MCP for test context". 단순 단발 테스트 실행이 아니라
  하네스(반복 가능한 인프라)를 깔 때 사용. CLI 문법이 필요하면 playwright-cli 스킬을 본다.
---

# E2E 하네스 부트스트랩 (AI 에이전트용)

## 한 줄 목적

에이전트가 E2E 테스트를 **혼자 짜고 굴릴 수 있게** 만드는 4가지 하네스를 신규 입사자 온보딩처럼 깔아준다.

## 왜 필요한가 (이 스킬의 핵심 통찰)

에이전트는 코드는 잘 쓰지만 **"우리 팀만 아는 맥락"이 0** 인 상태로 시작한다. 그래서 사람이라면 1주차에 동료에게 물어봤을 것들을 모른다. 예시:

- 인증은 로그인 폼을 자동화하는 게 아니라 `getServerState()` 류 서버 함수로 세션을 만든다는 사실.
- 테스트가 `code 90` 으로 죽으면 버그가 아니라 **인증 만료** 신호이고, 대응은 setup 프로젝트 재실행이라는 것.
- `baseURL` 은 하드코딩이 아니라 환경변수(`E2E_BASE_URL` 등)로 결정된다는 규칙.
- "이 플로우는 의도적으로 테스트하지 않기로 했다"는 **과거 의사결정**.

이런 맥락이 글로 없으면 에이전트는 매번 그럴듯하지만 틀린 코드를 새로 발명한다. 하네스의 본질은 **암묵지를 명시지로 박제**해서 매 세션 재발명을 없애는 것이다. 이 스킬은 그 박제물 4종을 만든다.

## 산출물 4종 (하네스)

1. **AGENTS.md** — 코드베이스 전체 안내. 서비스가 무엇이고 어떻게 구성되며 핵심 플로우·인증·접근제어가 어떻게 되는지.
2. **E2E 운영·작성 규칙 SSOT** (`e2e/CONVENTIONS.md` 등) — AGENTS.md 와 **별개**. 실행 환경, 인증 시나리오, "무엇을 테스트하고 무엇을 안 하는지"의 의사결정 기록.
3. **공용 fixture/헬퍼** — 인증 상태 초기화(storageState fixture), 테스트 데이터 세팅 등 반복 작업의 공용 코드.
4. **MCP 서버 배선** — 기획서·디자인·이슈·PR 등 사내에서 이전에 논의된 컨텍스트에 에이전트가 직접 접근하도록 연결.

AGENTS.md 와 SSOT 를 **왜 나누는가**: AGENTS.md 는 모든 작업(기능 개발 포함)이 읽는 코드베이스 지도이고, SSOT 는 E2E 만의 운영 규칙·결정 로그다. 섞으면 둘 다 비대해지고 아무도 안 읽는다. 역할을 분리해야 각자 짧고 살아있는 문서로 유지된다.

## 진행 순서

이 순서는 의존성 순서다. 1→2 는 맥락 수집이 코드보다 먼저여야 하기 때문이고, 3 은 1·2 에서 발견한 인증 방식을 코드로 굳히는 단계, 4 는 부가 컨텍스트 연결이라 마지막이다.

```
1. 코드베이스 정찰 → 산출: AGENTS.md          (검증: 인증·핵심 플로우·접근제어가 글로 답해짐)
2. E2E 결정 인터뷰  → 산출: SSOT 문서          (검증: baseURL·인증·만료대응·테스트 제외 항목이 적힘)
3. 공용 fixture 구축 → 산출: storageState 등    (검증: 신규 테스트가 로그인 코드 없이 인증됨)
4. MCP 배선         → 산출: .mcp.json 등        (검증: 에이전트가 이슈/PR/기획 컨텍스트를 읽음)
```

각 단계 끝에서 **"신규 입사자가 이 문서/코드만 보고 첫 E2E 테스트를 통과시킬 수 있나?"** 를 자문한다. 못 한다면 그 단계의 맥락이 아직 부족한 것이다.

### 단계 0: 기존 상태 파악 (재발명 금지)

깔기 전에 이미 있는 것을 찾는다. 이건 surgical change 원칙이자, 기존 규칙과 충돌하는 하네스를 만들지 않기 위함이다.

- `AGENTS.md`, `CLAUDE.md`, `.claude/rules/**` 가 이미 있으면 **덮어쓰지 말고 보강**한다.
- `playwright.config.*`, `e2e/`, `tests/`, `*.spec.ts` 의 기존 패턴(프로젝트 분리, baseURL, storageState 경로)을 읽어 그 컨벤션을 따른다.
- 기존 `.mcp.json` / MCP 설정을 확인한다.

> 큰 모노레포(예: 엔터프라이즈 Next.js)에서는 패키지마다 인증/baseURL 이 다를 수 있다. 단일 SSOT 안에서 패키지별 표로 분기하라.

### 단계 1: AGENTS.md — 코드베이스 안내

목표는 "서비스 지도"다. 에이전트가 테스트 대상의 정체와 경계를 알게 한다. 채워야 할 항목과 그라운딩 방법은 → **[references/agents-md-guide.md](references/agents-md-guide.md)**.

최소 골격:

```markdown
# <서비스명>
## 무엇인가 / 누가 쓰나
## 아키텍처 (앱·패키지·주요 경로)
## 핵심 사용자 플로우 (E2E 가 지켜야 할 것)
## 인증 & 접근제어 (역할, 세션 생성 방식, 만료 동작)
## 로컬 실행 (baseURL 결정 방식, 환경변수)
```

근거 없는 서술 금지. 각 항목은 실제 파일(미들웨어, auth 설정, config)을 읽고 채운다. 모르면 사람에게 묻고, 추정한 부분은 명시한다.

### 단계 2: E2E 운영·작성 규칙 SSOT

이게 가장 큰 가치다. **테스트 전략의 단일 출처**. 운영 규칙뿐 아니라 **결정 로그**(왜 이렇게/왜 안 하기로)를 담는다. 결정 로그가 있어야 에이전트가 "이미 거부된 접근"을 다시 제안하지 않는다.

반드시 답해야 할 질문과 결정 로그 포맷은 → **[references/conventions-ssot-guide.md](references/conventions-ssot-guide.md)**.

특히 빠지면 안 되는 4가지(서두의 "우리만 아는 맥락"):

- **인증 시나리오**: 어떻게 인증하나. (폼 자동화 vs `getServerState()` 류 서버 세션 — 후자가 보통 빠르고 안정적)
- **만료/에러 신호**: 특정 종료 코드/에러가 "버그"인지 "인증 만료, setup 재실행"인지.
- **baseURL/환경**: 환경변수로 결정. 하드코딩 금지.
- **테스트 범위**: 무엇을 테스트하고 **무엇을 의도적으로 안 하는지** + 그 이유.

### 단계 3: 공용 fixture/헬퍼 (반복 제거)

반복되는 셋업을 공용 코드로 뽑는다. 첫 번째이자 가장 중요한 헬퍼는 **인증 상태 분리**다.

핵심 패턴: 로그인을 **setup 프로젝트에서 1회** 수행해 `storageState`(쿠키+로컬스토리지) 파일로 저장하고, 모든 테스트는 그 파일을 로드해 시작한다. 매 테스트가 로그인 UI 를 다시 타지 않으니 빠르고 덜 깨진다.

- storageState 저장/주입의 정확한 명령은 playwright-cli 의 → **[storage-state.md](../playwright-cli/references/storage-state.md)** 를 본다. (여기서 CLI 문법을 복제하지 않는다)
- 역할별 다중 세션(admin/user 등 동시 격리)은 → **[session-management.md](../playwright-cli/references/session-management.md)**.
- fixture 설계·테스트 데이터 시딩·만료 시 재setup 패턴은 → **[references/fixtures-helpers-guide.md](references/fixtures-helpers-guide.md)**.

보안: storageState 파일에는 실제 토큰이 들어간다. **커밋 금지**, `.gitignore` 등록, 자동화 종료 후 삭제.

### 단계 4: MCP 서버 배선 (사내 컨텍스트 연결)

테스트는 기획·디자인·이슈에서 정해진 기대 동작을 검증한다. 그 원천 맥락에 에이전트가 직접 닿게 MCP 를 연결한다(예: 이슈 트래커, 디자인 툴, Git 호스팅). 그래야 "기획서엔 뭐라고 돼 있지?"를 사람에게 안 묻고 스스로 푼다.

무엇을·왜 연결하고 SSOT 에 어떻게 적는지는 → **[references/mcp-wiring-guide.md](references/mcp-wiring-guide.md)**. 실제 MCP 서버 설치는 이 저장소의 `mcp-setup` 스킬을 활용한다.

## 완료 기준

부트스트랩이 끝났다고 말하기 전, 아래가 모두 참이어야 한다:

```
[ ] AGENTS.md 가 인증·핵심 플로우·접근제어·baseURL 결정 방식에 답한다
[ ] SSOT 가 인증 시나리오·만료 대응·환경변수·테스트 제외 항목(+이유)을 담는다
[ ] storageState fixture 가 있고, 새 테스트가 로그인 코드 없이 인증된다
[ ] "우리만 아는 맥락" 4종(인증함수·만료코드·baseURL·범위)이 글로 박제됐다
[ ] MCP 가 연결됐거나, 미연결이면 그 이유가 SSOT 에 적혀 있다
[ ] 기존 AGENTS.md/규칙을 덮어쓰지 않고 보강했다
```

마지막 점검: 이 4종만 새 세션 에이전트에게 주고 "로그인 후 핵심 플로우 1개를 E2E 로 검증해줘"라고 했을 때, 사람에게 추가 질문 없이 통과시킬 수 있어야 한다. 그게 안 되면 어느 하네스가 비었는지 역추적한다.

## 참고 파일

- [references/agents-md-guide.md](references/agents-md-guide.md) — AGENTS.md 항목별 작성·그라운딩.
- [references/conventions-ssot-guide.md](references/conventions-ssot-guide.md) — SSOT 질문 목록 + 결정 로그 포맷.
- [references/fixtures-helpers-guide.md](references/fixtures-helpers-guide.md) — storageState setup 프로젝트·시딩·재인증.
- [references/mcp-wiring-guide.md](references/mcp-wiring-guide.md) — 무엇을 왜 연결하나.
- 인접 스킬: `playwright-cli`(브라우저/CLI 문법·storageState 명령), `mcp-setup`(MCP 서버 설치), `deepinit`(계층형 AGENTS.md 생성).
