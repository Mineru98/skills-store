# 공용 fixture/헬퍼 가이드

> 단계 3 의 깊이 문서. 목표: 매 테스트가 반복하는 셋업을 **한 번 쓰고 공유**하는 코드로 뽑는다. 첫 번째이자 가장 중요한 것은 인증 상태 분리다.

## 왜 fixture 인가

에이전트가 테스트마다 로그인 UI 자동화, 테스트 데이터 생성을 새로 짜면: (1) 느리다, (2) UI 변경에 전부 깨진다, (3) 코드가 중복된다. 공용 fixture 는 이 셋업을 1회로 줄이고 "이 헬퍼를 쓰라"는 단일 진입점을 준다.

## 1. 인증 상태 분리 (storageState) — 최우선

### 패턴

1. **setup 프로젝트**가 로그인을 1회 수행한다(폼 자동화가 필요하면 그때만, 보통은 서버 세션 함수).
2. 그 결과 세션(쿠키 + localStorage)을 `storageState` 파일로 저장한다.
3. 모든 테스트 프로젝트는 그 파일을 로드한 상태에서 시작한다 → 로그인 UI 를 다시 타지 않는다.

### CLI 문법은 복제하지 않는다

storageState 의 저장/주입 실제 명령(`state-save`, `state-load`, 쿠키/스토리지 조작)은 playwright-cli 스킬에 이미 있다. 거기서 본다:

- **[playwright-cli/references/storage-state.md](../../playwright-cli/references/storage-state.md)** — `state-save`/`state-load`, 쿠키/로컬스토리지 저장·복원, "Authentication State Reuse" 패턴, 보안 노트.
- **[playwright-cli/references/session-management.md](../../playwright-cli/references/session-management.md)** — 역할별 다중 세션(admin/user 등)을 `-s` 로 동시에 격리하는 법.

이 스킬에서 결정할 것은 문법이 아니라 **설계**다: 역할이 몇 개인가, 세션을 폼으로 만들 것인가 서버 함수로 만들 것인가, storageState 를 어디에 둘 것인가, 만료되면 어떻게 갱신하는가.

### Playwright 프로젝트 배선 (설계 골격)

```ts
// playwright.config.ts (개념 골격 — 실제 값은 코드베이스에 맞춘다)
projects: [
  { name: 'setup', testMatch: /global\.setup\.ts/ },
  {
    name: 'authed',
    dependencies: ['setup'],          // setup 이 먼저 돌아 storageState 를 만든다
    use: { storageState: '.auth/user.json' },
  },
]
```

```ts
// global.setup.ts (개념 골격)
// 1) 서버 세션 함수가 있으면 그걸로 세션을 만든다 (폼 자동화보다 빠르고 안정적)
//    const state = await getServerState('user')   ← AGENTS.md/SSOT 에 적힌 함수
// 2) 세션을 storageState 파일로 저장한다 → .auth/user.json
// 역할이 여러 개면 .auth/admin.json, .auth/user.json 처럼 파일을 나눈다
```

baseURL 은 **환경변수로** 주입한다. `use.baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'`. 하드코딩 금지(SSOT 규칙과 일치).

### 만료 시 재인증

SSOT 에 적은 만료 신호(예: `code 90`)가 뜨면 대응은 **setup 재실행**으로 storageState 를 새로 굽는 것이다. 테스트 로직을 의심하지 않는다. 이 동작을 fixture 의 주석/문서에 한 줄로 남겨 다음 에이전트가 헤매지 않게 한다.

### 보안 (반복 강조)
- storageState 파일에는 실제 토큰이 들어간다. **커밋 금지.**
- `.gitignore` 에 `.auth/`(또는 `*.auth-state.json`) 추가.
- CI 에서는 시크릿으로 자격을 주입하고, 종료 후 상태 파일을 지운다.

## 2. 테스트 데이터 시딩 헬퍼

반복되는 "이 테스트가 돌려면 X 데이터가 있어야 한다"를 공용 헬퍼로 뺀다.

- **시딩 방식 결정**: API 호출 / 테스트 전용 엔드포인트 / DB 직접. 가장 빠르고 격리되는 걸 고른다.
- **격리**: 테스트끼리 데이터로 간섭하지 않게 한다(고유 식별자 prefix, 테스트별 계정/네임스페이스).
- **정리**: 만든 데이터는 정리하거나, 정리 비용이 크면 "왜 안 정리하는지"를 SSOT 에 기록.

```ts
// 개념 골격: 고정 데이터가 아니라 헬퍼로 생성
async function seedOrder(opts) { /* API/엔드포인트로 주문 1건 생성, id 반환 */ }
```

데이터 격리·정리는 테스트 독립성과 직결된다. 깊은 견고화(플레이키 제거, 격리 강화)는 별도 단계이며 이 저장소의 **`e2e-test-hardener`** 스킬이 담당한다 — fixture 는 그 기반만 깐다.

## 3. 그 밖의 반복 헬퍼 후보

- 공통 네비게이션("로그인된 상태로 대시보드까지")
- 자주 쓰는 단언 묶음(토스트 확인, URL 패턴 확인)
- 네트워크 mock 토글(외부 의존성 차단) — 실제 라우트 mock 문법은 playwright-cli 의 request-mocking 참조.

## 어디까지가 이 스킬인가

이 스킬은 **fixture/헬퍼의 골격과 인증 분리 설계**까지 책임진다. 실제 스펙 코드 대량 작성은 `e2e-test-generator`, 견고화는 `e2e-test-hardener`, 실패 치유는 `e2e-test-healer` 가 이어받는다. 하네스는 그들이 딛고 설 바닥이다.
