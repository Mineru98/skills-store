---
name: e2e-test-healer
description: >-
  실패한 Playwright E2E 테스트를 trace 기반으로 진단해 근본 원인을 찾고, 통과할 때까지 수정·재실행하는 자동 치유 루프(Healer). Use
  whenever an E2E / Playwright / browser test is failing, flaky, red, or timing out and the user
  wants it diagnosed and fixed — including phrasings like "E2E 테스트가 깨졌어/실패해/빨개", "테스트 통과시켜줘",
  "trace 좀 봐줘", "왜 떨어지는지 찾아줘", "flaky 테스트 고쳐줘", "fix the failing playwright spec", "this e2e keeps
  timing out", "heal the broken test", "debug this trace". Triggers even when the user only pastes
  a failing test name, a stack trace, or a trace.zip path. Drives the full loop run → debug →
  root-cause → fix → verify → repeat, and crucially decides whether the TEST is wrong or the
  PRODUCT code is broken instead of forcing the test green. ▷ 경계: 아직 실패하지 않은 테스트의 머지 전 선제 deflake는
  e2e-test-hardener, 시작점이 CI 실패라 원격 아티팩트(trace.zip)부터 받아야 하면 e2e-ci-trace-debug 이다. 이 스킬은 "이미 로컬에서
  실패가 재현되는 테스트를 진단·수정"하는 자리다.
---
# E2E Test Healer

실패한 E2E 테스트를 받아서 **통과할 때까지 스스로 고치는 치유 루프**를 운영한다. 단순히 빨간 테스트를 초록으로 만드는 게 아니라, **trace 안에 남은 증거로 근본 원인을 찾아** "테스트가 틀린 건지 / 제품 코드가 깨진 건지" 판단하고 올바른 쪽을 고친다.

이 스킬은 Playwright 사용법 튜토리얼이 아니다. 브라우저 구동·trace 탐색 같은 기계적 작업은 이미 있는 `playwright-cli` 스킬에 위임하고, 여기서는 **무엇을·왜·언제 봐야 하는가** 라는 진단 판단에 집중한다.

## 핵심 통찰: trace = 그때 일어난 모든 것

Playwright는 테스트를 실행하면 trace(zip)를 남긴다. 그 안에는 진행 중 일어난 모든 것이 통째로 들어있다.

- 각 단계의 동작(click/fill/goto …)과 실행 순서
- 단계별 화면 스냅샷(DOM + 스크린샷)
- 모든 네트워크 요청/응답(헤더·바디·상태코드·타이밍)
- 콘솔 로그와 에러 스택

핵심은 이것을 **한꺼번에 다 읽지 않는다**는 점이다. 개발자가 브라우저 devtools에서 필요할 때 콘솔 탭을, 필요할 때 네트워크 탭을 열어보듯, 에이전트도 **가설을 세운 뒤 그 가설을 확인할 정보만** trace에서 꺼내 본다. trace는 "사건 현장 전체"이고, 진단은 현장에서 단서를 좁혀가는 일이다.

trace를 여는 구체적 명령(`tracing-start/stop`, trace zip 탐색)은 직접 외우지 말고 **`playwright-cli`의 `references/tracing.md`** 를 그 시점에 읽어서 쓴다.

## 치유 루프 (run → debug → root-cause → fix → verify → repeat)

아래 순서를 한 사이클로 돌리고, **green이 될 때까지** 반복한다. 단, "통과"가 곧 "해결"은 아니다 — 5단계의 판단을 건너뛰지 말 것.

### 1. Run — 실패를 재현한다

먼저 실패가 진짜이고 재현 가능한지 확인한다. 재현 안 되는 실패를 고칠 수는 없다.

- 지목된 스펙만 trace를 켜고 돌린다. 전체 스위트를 다 돌리지 말 것(느리고 신호가 묻힌다).
- 실패 메시지·종료 코드·trace 산출물 경로를 확보한다.
- 한 번에 통과하면 **flaky 신호**다. 같은 스펙을 몇 번 반복해 재현율을 본다(예: `--repeat-each`). flaky 진단은 `references/diagnosis-playbook.md`.

명령 레시피(프로젝트 스크립트 탐색 포함)는 `references/loop-recipes.md`.

### 2. Debug — trace에서 단서를 좁힌다

스택 트레이스만 보고 추측하지 말고 trace를 연다. **증상에 따라 보는 탭이 다르다** — devtools를 쓰듯 가설 기반으로 좁힌다.

- 어디서 멈췄나 → 실패 직전 **단계 스냅샷/스크린샷**. 기대한 화면이 떠 있었나?
- 액션 자체 실패(locator timeout 등) → 그 시점 **DOM 스냅샷**. 요소가 없었나, 가려졌나, 아직 안 떴나?
- 데이터/상태가 이상 → **네트워크 탭**. 그 API가 4xx/5xx였나, 응답 바디가 기대와 다른가, 호출 자체가 안 됐나?
- JS 예외/하얀 화면 → **콘솔 로그·에러 스택**.

증상→trace-탭 매핑 표는 `references/diagnosis-playbook.md`에 있다. 막히면 거기부터 읽는다.

### 3. Root-cause — 세 가지를 나란히 놓고 본다

가장 중요한 단계다. trace의 증상만으로 결론 내지 말고, 세 소스를 **삼각측량**한다.

1. **테스트 코드** — 셀렉터·단언·대기·가정이 실제 UI와 맞는가?
2. **실제(제품) 코드** — 테스트가 부르는 컴포넌트/페이지/API 핸들러가 실제로 무슨 일을 하는가?
3. **git diff** — 직전 변경이 뭘 건드렸나? 깨짐이 코드 변경 때문인지, 테스트 변경 때문인지 시점으로 좁힌다.

여기서 **반드시 분기를 판정한다**:

```
근본 원인이 어느 쪽인가?
├─ 제품 코드가 깨졌다(회귀)        → 제품 코드를 고친다. 테스트는 건드리지 않는다.
├─ 테스트가 낡았다/틀렸다           → 테스트(셀렉터/단언/대기/픽스처)를 고친다.
└─ 둘 다 / 모호하다                → 멈추고 증거와 함께 사람에게 확인받는다.
```

판정의 디테일(어느 쪽인지 가르는 신호들)은 `references/decision-test-vs-code.md`를 읽는다.

> 절대 하지 말 것: 원인을 모른 채 단언을 느슨하게 바꾸거나, `expect`를 지우거나, 무한 `waitForTimeout`을 끼워 넣어 **그냥 초록으로 만드는 것**. 그건 회귀를 테스트로 덮어 숨기는 일이다. 테스트의 존재 이유는 깨짐을 잡는 것이다.

### 4. Fix — 판정한 쪽만 최소한으로 고친다

- 3단계에서 정한 한쪽만 수정한다. 원인과 무관한 코드는 건드리지 않는다(surgical).
- 테스트 쪽이면: 안정적인 셀렉터(역할/라벨 기반), 명시적 대기(임의 sleep 금지), 결정적 픽스처로 고친다.
- 제품 코드 쪽이면: 회귀를 만든 변경을 수정한다. 가능하면 이 버그를 고정하는 단언을 테스트에 강화한다.
- 수정 이유를 한 줄로 남긴다(왜 이게 근본 원인인지). 나중 검증·리뷰의 근거가 된다.

### 5. Verify — 같은 trace 루프로 되돌아간다

수정 후 **같은 스펙을 다시 trace와 함께** 돌린다.

- 여전히 빨갛다 → 2단계로 돌아간다. 새 trace는 새 증상을 보여준다. 가설을 갱신하고 다시 좁힌다.
- 초록이다 → 진짜 초록인지 검증한다:
  - flaky였다면 반복 실행으로 안정성 확인(한 번 통과 ≠ 해결).
  - 단언이 실제로 의미 있는 걸 보고 있는지(통과시키려 약화시키지 않았는지) 재확인.
- 안정적으로 초록이면 **마지막 게이트**: 변경 파일에 대해 `lint`와 `type-check`(본 저장소 기준 `yarn lint` / `yarn type-check`, RULE-BUILD-002)를 돌려 회귀가 없는지 확인한다.

### 반복 종료 조건

다음 중 하나면 멈춘다:

- 스펙이 **안정적으로 green** + lint/type 통과 → 완료. 무엇이 원인이었고 어디를 고쳤는지 한 줄 요약.
- 원인이 **테스트인지 코드인지 모호** → 멈추고 증거(trace에서 본 것, diff, 후보 원인)와 함께 사람에게 묻는다.
- 같은 가설로 **두세 번 고쳐도 진전이 없음** → 루프를 더 돌리지 말고 막힌 지점·시도한 것·trace 증거를 정리해 보고한다. 무한 루프로 테스트를 망가뜨리지 말 것.

## 안티패턴 (이걸 하고 있으면 멈춰라)

- trace를 안 열고 스택 트레이스만 보고 추측해 고친다.
- 원인 불명인데 단언을 약화/삭제하거나 sleep을 늘려 초록을 만든다.
- 제품 코드가 깨졌는데 테스트를 비틀어 회귀를 숨긴다.
- 한 사이클에 테스트와 제품 코드를 동시에 마구 바꿔 무엇이 원인이었는지 모르게 만든다.
- 통과를 확인하지 않고(특히 flaky를) "고쳤다"고 보고한다.
- 끝에 lint/type을 안 돌려 새 깨짐을 흘려보낸다.

## 대규모 Next.js 저장소에서 (실전 메모)

- 스위트 전체 대신 **단일 스펙/프로젝트**만 trace로 돌려 피드백 루프를 짧게 유지한다.
- 테스트 코드와 제품 코드의 경계를 의식한다: 이 저장소는 5계층 Clean Architecture다. 제품 측 회귀는 보통 `presentation/features/*View`, `application/hooks/*`, `infrastructure/api/*`에서 난다(프로젝트의 AGENTS.md 또는 `.codex/rules/**`의 아키텍처 규칙).
- 네트워크 단서가 무엇을 가리키는지: trace의 실패 요청 → `infrastructure/api/{domain}/services.ts`의 호출과 대조한다.
- 검증 게이트는 본 저장소 명령에 맞춘다: `yarn lint`, `yarn type-check`(RULE-BUILD-002). 테스트 러너 스크립트는 `package.json`에서 확인한다.

## 참고 파일 (필요할 때 읽기)

- `references/diagnosis-playbook.md` — 증상 → 어떤 trace 탭/정보를 볼지 매핑, flaky 진단.
- `references/decision-test-vs-code.md` — "테스트가 틀림 vs 제품 코드가 깨짐"을 가르는 신호와 사례.
- `references/loop-recipes.md` — 실행/재현/검증 명령 레시피, 프로젝트 스크립트 탐색, lint/type 게이트.
- (외부 빌딩블록) `playwright-cli` 스킬 — 브라우저 구동·`tracing-start/stop`·trace zip 탐색은 그 스킬의 `references/tracing.md`를 따른다. 여기서 중복 설명하지 않는다.
