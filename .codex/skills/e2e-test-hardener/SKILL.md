---
name: e2e-test-hardener
description: >-
  생성·작성된 Playwright E2E 테스트를 독립적이고 플래키(flaky) 없는 견고한 테스트로 다듬는다. 네이버페이/네이버파이낸셜식 "AI 에이전트용 E2E 테스트
  하네스" 발표의 3원칙(테스트 독립성·외부 의존성 모킹·플래키 예방)을 적용한다. 다음 같은 요청·상황에서 적극적으로 사용한다 — "E2E 테스트 견고하게", "테스트
  플래키 잡아줘", "플래키 테스트", "테스트 독립적으로 만들어", "테스트 격리", "waitForTimeout 없애줘", "셀렉터 깨지는 거", "외부 의존성 모킹",
  "약관동의/휴대폰인증부터 다시 타는 테스트", "테스트 번인", "burn-in", "harden e2e tests", "make playwright tests
  reliable", "fix flaky test", "stabilize generated test", "deflake". Playwright 테스트를 새로 짜거나
  codegen/AI로 생성한 직후, 머지 전 선제 견고화 단계에서 이 스킬을 쓴다. ▷ 경계: 지금 빨갛게 실패 중인 테스트를 trace로 진단·수정하는 건
  e2e-test-healer, CI(PR/Actions)에서 실패해 원격 아티팩트부터 받아야 하면 e2e-ci-trace-debug 이다. 이 스킬은 "아직 실패하지
  않았거나 머지 전 예방" 자리다. (브라우저 구동 CLI 문법 자체는 playwright-cli 스킬을 참조; 이 스킬은 "무엇을·왜·언제" 결정한다.)
---
# E2E Test Hardener

생성·작성된 Playwright E2E 테스트를 머지 가능한 견고한 테스트로 만든다. 핵심은 CLI 문법이 아니라 **하네스 사고**다: 무엇을 테스트하고, 무엇을 모킹하고, 언제 안정성을 검증하는가.

이 스킬은 네이버파이낸셜 발표 "AI 에이전트용 Playwright E2E 테스트 하네스"가 "다른 팀도 참고할 만한 결정"으로 공유한 3가지 설계 결정을 코드에 적용한다.

## 전제: 이건 Playwright 튜토리얼이 아니다

브라우저 구동, `page.route`, storage state 저장/복원, 셀렉터 문법 등 **CLI/API 메커니즘은 `playwright-cli` 스킬에 이미 있다.** 중복 설명하지 말고 그쪽을 참조한다:

- 네트워크 모킹(`page.route`, 조건부 응답, 응답 변조): `.codex/skills/playwright-cli/references/request-mocking.md`
- 인증/세션 상태 저장·복원(storage state): `.codex/skills/playwright-cli/references/storage-state.md`
- 시멘틱 셀렉터가 codegen으로 어떻게 나오는지: `.codex/skills/playwright-cli/references/test-generation.md`

이 스킬이 더하는 가치는 **그 도구들을 언제·왜 쓰는지에 대한 판단**이다.

## 언제 쓰나

- codegen이나 AI 에이전트가 E2E 테스트를 막 생성했고, 머지 전에 견고하게 다듬어야 할 때
- 테스트가 "가끔" 실패할 때(플래키). 머지 후 추적보다 작성 직후 잡는 비용이 압도적으로 싸다
- 모든 테스트가 약관동의·로그인 같은 공통 앞부분을 매번 다시 타서 느리고 연쇄 실패할 때
- 네이버 인증서/홈택스/전자증명서/외부앱 연동 등 통제 불가능한 외부 호출이 테스트에 섞여 있을 때

**안 쓰는 경우:** 순수 단위 테스트(Jest/Vitest), 브라우저 자동화 일회성 스크립트(데이터 추출·스크린샷만), 외부 시스템 자체를 진짜로 검증하는 계약 테스트.

## 3원칙 한눈에

```
A. 테스트 독립성   — 검증할 갈래의 '시작점'에서 출발. 공통 앞부분은 테스트용 API로 미리 세팅.
B. 외부 의존성 모킹 — '통제할 수 있는 것만 테스트'. 호출 위치에 따라 모킹 지점이 갈린다.
C. 플래키 예방      — 작성 단계에서, 머지 전에 잡는다. 하드 대기·취약 셀렉터 제거 + 번인.
```

세 원칙은 순서가 있다. **A로 테스트가 무엇을 책임지는지 좁히고 → B로 통제 불가능한 입력을 고정하고 → C로 남은 비결정성을 제거**한다. C만 단독으로 하면 거대한 테스트의 플래키를 영원히 쫓게 된다.

## 워크플로

대상 테스트(들)를 받으면 세 원칙을 순서대로 통과시킨다. 각 단계는 "찾기 → 고치기 → 근거" 형태다.

### 1단계 — 테스트 독립성 (A)

**목표:** 각 테스트가 자기가 검증할 갈래의 *시작점*에서 출발한다. 공통 앞부분(약관동의·휴대폰인증·로그인)을 매 테스트가 UI로 다시 타지 않는다.

찾기 — 다음 신호를 스캔한다:
- 여러 테스트가 같은 로그인/약관/인증 UI 단계를 복붙으로 반복
- 테스트들이 실행 순서에 의존(앞 테스트가 만든 데이터를 뒷 테스트가 사용)
- 하나의 거대한 `test()` 안에서 5단계 이상을 한 번에 검증
- `beforeEach`가 매번 UI로 로그인 폼을 클릭

고치기 — 공통 앞부분을 **테스트용 셋업으로 외부화**한다. 우선순위:
1. **테스트 전용 셋업 API**가 있으면 그것으로 상태를 미리 만든다(약관동의·인증 완료 계정 발급 등). 그다음 갈래부터 UI로 검증.
2. 인증 상태는 storage state로 1회 만들어 재사용한다 → playwright-cli의 `.codex/skills/playwright-cli/references/storage-state.md`(state-save/state-load) 패턴.
3. 테스트끼리는 서로 독립이어야 한다. 공유 상태·실행 순서 의존을 끊는다.

근거 — 공통 앞부분 반복은 (1) 실행시간이 누적되고 (2) 앞부분이 깨지면 모든 갈래가 연쇄 실패해 진짜 원인이 묻힌다. Playwright 공식 권고도 "각 테스트는 서로 완전히 독립"이다. 깊은 판단(어디까지 API로 세팅하고 어디부터 UI로 검증할지의 경계)은 `references/independence.md`.

### 2단계 — 외부 의존성 모킹 (B)

**목표:** '통제할 수 있는 것만 테스트'. 우리 코드의 분기는 진짜로 돌리되, 통제 불가능한 외부(네이버 인증서/홈택스/전자증명서/네이버앱 연동, 결제 PG, 외부 OAuth 등)는 고정된 응답으로 대체한다.

**핵심 판단 — 외부 호출이 어디서 일어나는가:**

```
브라우저(클라이언트)에서 호출  →  Playwright page.route 로 응답 가로채기
                                  (references: playwright-cli/request-mocking.md)

서버에서 호출                   →  page.route로 못 잡는다.
(Next SSR / BFF / route handler)   E2E 전용 환경변수로 고정 응답 반환하도록 분기
                                  (references: external-mocking.md)
```

이 분기를 틀리면 모킹이 "동작하는 것처럼 보이지만" 실제로는 진짜 외부를 때린다(느리고, 외부 변경에 우리 테스트가 깨진다). Next.js 엔터프라이즈 앱에서는 같은 데이터가 SSR/BFF로도, 클라이언트 fetch로도 올 수 있으니 **호출 스택을 먼저 확인**한다. 판단 기준·환경변수 게이팅 패턴·"진짜로 모킹돼야 할 외부" 체크리스트는 `references/external-mocking.md`.

근거 — 외부를 그대로 호출하면 테스트가 느려지고, 우리가 바꾸지 않은 외부 시스템의 변경 때문에 우리 테스트가 빨갛게 된다. 테스트는 *우리가 통제하는 동작*만 검증해야 신호가 깨끗하다.

### 3단계 — 플래키 예방 (C)

**목표:** 비결정성을 작성 단계에서 제거하고, 머지 전 번인으로 확인한다. 세 가지를 본다.

**C-1. 하드 대기 제거.** `waitForTimeout`, `sleep`, 고정 `setTimeout` 대기를 금지한다. 조건 기반 web-first 대기로 바꾼다(필요한 만큼만):

```ts
// 나쁜 예 — 시간에 베팅. 느린 CI에서 터지고, 빠를 땐 시간 낭비
await page.waitForTimeout(3000);
await expect(page.getByText('완료')).toBeVisible();

// 좋은 예 — 조건이 만족되면 즉시 진행, 아니면 타임아웃까지 자동 재시도
await expect(page.getByText('완료')).toBeVisible();
```

**C-2. 시멘틱 셀렉터.** CSS 클래스명·DOM 구조·nth-child 대신 role+name(접근성 트리)으로 찾는다. 클래스명은 리팩터링·스타일 변경으로 조용히 바뀌지만 역할/이름은 사용자가 보는 의미라 안정적이다:

```ts
// 나쁜 예 — 구조/클래스에 결합. 마크업 바뀌면 깨짐
await page.locator('.btn-primary.submit-btn').click();
await page.locator('div > form > button:nth-child(2)').click();

// 좋은 예 — 사용자가 인지하는 역할+이름
await page.getByRole('button', { name: '다음' }).click();
```

**C-3. 번인(burn-in).** 작성 직후 `--repeat-each`로 반복 실행한다. 한 번이라도 실패하면 플래키로 간주하고 머지하지 않는다:

```bash
# 새로 만지거나 추가한 테스트만 골라 10회 반복
npx playwright test path/to/changed.spec.ts --repeat-each=10

# 워커 1개로 돌리면 순서 의존/공유 상태 결함이 더 잘 드러난다
npx playwright test path/to/changed.spec.ts --repeat-each=20 --workers=1
```

근거 — 머지 후에 추적되는 플래키는 누가, 언제, 왜 깨졌는지 찾기 어렵고 CI 신뢰를 갉아먹는다. 작성자가 컨텍스트를 다 쥔 작성 직후에 잡는 비용이 압도적으로 싸다. 안티패턴 전체 목록과 web-first 대기 매핑·번인 회차 가이드는 `references/flaky-prevention.md`.

## 마무리 체크리스트

테스트를 다듬은 뒤, 다음을 통과해야 "견고해졌다"고 말할 수 있다. 항목별 근거·세부는 `references/hardening-checklist.md`.

```
[A] 각 테스트가 검증 갈래의 시작점에서 출발한다 (공통 앞부분 UI 반복 없음)
[A] 테스트끼리 실행 순서·공유 상태에 의존하지 않는다
[B] 통제 불가능한 외부 호출이 모두 모킹/고정됐다
[B] 모킹 지점이 호출 위치(클라이언트 page.route vs 서버 env)에 맞다
[C] waitForTimeout/sleep 등 하드 대기가 0건이다
[C] 셀렉터가 role+name 등 시멘틱이다 (CSS 클래스/구조 결합 없음)
[C] 변경 테스트 번인(--repeat-each) 통과, 단 한 번도 실패 없음
```

체크리스트가 다 통과하면, 무엇을 어떻게 고쳤는지(원칙 A/B/C별)와 번인 결과를 사용자에게 간결히 보고한다.

## 참고 파일 (필요할 때만 읽기)

- `references/independence.md` — A: API 셋업 vs UI 검증 경계, storage state 재사용 패턴, 순서 의존 제거 레시피
- `references/external-mocking.md` — B: 클라이언트 vs 서버 호출 판별, E2E 전용 환경변수 게이팅, 모킹 대상 체크리스트
- `references/flaky-prevention.md` — C: 하드 대기→web-first 대기 매핑표, 취약 셀렉터→시멘틱 전환, 번인 회차/워커 가이드
- `references/hardening-checklist.md` — 머지 전 최종 점검표(근거 포함)와 사용자 보고 양식
