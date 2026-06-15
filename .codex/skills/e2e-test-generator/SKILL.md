---
name: e2e-test-generator
description: >-
  검토가 끝난 E2E 테스트 계획서(시나리오·단계)를 받아 Playwright 테스트 코드로 구현하고, 실제 브라우저에서 단계별로 돌려보며 동작을 확인한 뒤
  lint·type-check·테스트 green 까지 검증하는 Generator. "테스트 계획서 코드로 만들어줘", "이 시나리오 Playwright 코드로 구현",
  "E2E 테스트 코드 생성/작성", "테스트 케이스 작성해줘", "codegen 결과 우리 컨벤션에 맞게 정리", "generate the e2e test from this
  plan", "implement this test scenario in Playwright", "turn this test plan into spec code",
  "write a playwright test for this flow" 처럼 이미 정해진 시나리오/계획을 처음부터 실행 가능한 Playwright(.spec.ts) 로
  바꿔야 할 때 적극적으로 사용. 경계: 무엇을 테스트할지 아직 안 정해졌으면 먼저 e2e-flow-planner(계획 수립)가 필요하다고 알린다. 이미 존재하는 테스트가
  깨졌거나 flaky 해서 고치는 일은 e2e-test-healer/e2e-test-hardener 영역이므로 이 스킬을 끌어오지 않는다(이 스킬은 신규 생성 전용). 단순
  브라우저 조작·스크린샷·스크래핑만 필요하면 playwright-cli 를 직접 쓴다.
---
# E2E Test Generator (Playwright)

## 역할 한 줄

검토된 테스트 계획서를 입력으로 받아, 프로젝트 기존 테스트 컨벤션에 맞는 Playwright 코드로 **구현**하고 실제 실행으로 검증하는 Generator 다.

## 왜 계획과 구현을 분리하나

LLM 하나에게 "무엇을 테스트할지 + 어떻게 코드를 짤지 + 컨벤션까지" 한 번에 맡기면 셋 다 어중간해진다. 이 스킬은 **구현 한 가지에만** 집중한다.

전제: 무엇을 어떤 순서로 검증할지는 이미 결정되어 들어온다. 그 결정을 **돌아가는 코드**로 옮기고, 동작과 품질 게이트를 책임지는 게 Generator 의 일이다.

계획서가 없으면 멈추고 알린다. 추측으로 시나리오를 지어내지 않는다 — 그건 Planner 의 몫이고, 여기서 섞으면 분리한 의미가 사라진다.

## 이 스킬의 새로운 가치

브라우저 드라이버 사용법이 아니라 **하니스 사고(harness thinking)** 다. 즉,

- codegen 산출물을 *출발점*으로만 쓰고 그대로 커밋하지 않는다 — 무엇을 다듬고 무엇을 버릴지 판단한다.
- 계획서의 각 단계를 **실제 브라우저에서 실행해 확인**하며 코드를 만든다. 가정만으로 셀렉터를 적지 않는다.
- 기존 테스트 코드·가이드 문서를 먼저 **학습**해서 새 코드가 그 안에 자연스럽게 녹아들게 한다.
- 완료를 "코드를 썼다"가 아니라 **"type/lint 통과 + 실제 실행 green"** 으로 정의한다.

브라우저 명령 문법(클릭·입력·codegen·storageState 저장·코드 실행)은 `playwright-cli` 스킬이 이미 다룬다. 여기서 다시 적지 않는다. 필요할 때 아래를 연다:

- **codegen 으로 동작 기록 → TS 코드 뽑기**: `.codex/skills/playwright-cli/references/test-generation.md`
- **storageState 저장/복원(인증 분리)**: `.codex/skills/playwright-cli/references/storage-state.md`
- **임의 Playwright 코드 실행(`run-code`)·대기 전략·다운로드**: `.codex/skills/playwright-cli/references/running-code.md`
- 그 밖의 명령 색인은 `playwright-cli/SKILL.md`.

## 입력으로 무엇을 받나

검토가 끝난 테스트 계획서. 보통 다음을 담는다.

- 시나리오 제목과 목적
- 단계(step) 목록 — 사용자 관점 행동 순서
- 단계별 기대 결과(assertion 후보)
- 대상 URL/경로, 필요한 로그인 상태, 테스트 데이터

계획서가 표·자유 텍스트 등 어떤 형태든, 코드를 짜기 전에 위 항목을 머릿속에서 정리한다. 빠진 게 있으면 추측 대신 계획 단계의 공백으로 표시하고 사용자에게 물어본다.

## 워크플로

> 각 단계를 끝낼 때마다 검증 기준(verify) 으로 자가 점검한다. 게이트(5단계)가 빨간불이면 멈추지 말고 원인을 고쳐 다시 돈다.

### 1. 컨벤션 학습 (코드를 짜기 전에 반드시)

새 테스트가 기존 코드와 **이질적이면** 리뷰에서 막히고 유지보수도 깨진다. 먼저 프로젝트가 어떻게 테스트를 쓰는지 읽는다.

찾을 것:

- 기존 `*.spec.ts` / `*.test.ts` 의 구조 — `test.describe` 묶음, `test.step` 사용 여부, 스텝명 언어(한글/영문).
- `playwright.config.ts` — `testDir`, `baseURL`, `projects`, `storageState`, `globalSetup`.
- 인증 처리 방식 — 로그인 setup 프로젝트, storageState 픽스처, 공용 fixture(`test.extend`).
- 셀렉터 관례 — `getByRole`/`getByTestId`/`data-testid` 중 무엇을 쓰는지.
- 테스트 데이터·헬퍼 — 픽스처, 팩토리, 시드 스크립트.
- 테스트 작성 가이드 문서가 있으면(`docs/`, `CONTRIBUTING`, `.codex/rules/`) 읽고 따른다.

검증: 새 파일이 따라야 할 패턴을 한 문장으로 요약할 수 있다(예: "auth 는 storageState 픽스처, 스텝은 한글 `test.step`, 셀렉터는 `getByRole` 우선").

세부 체크리스트: `references/convention-discovery.md`.

### 2. codegen 으로 초안 뽑기 (출발점)

계획서의 흐름을 실제 브라우저에서 한 번 통과시키며 동작 코드를 *기록*한다. 이게 손으로 셀렉터를 상상하는 것보다 빠르고 정확하다.

- 명령 사용법은 `playwright-cli/references/test-generation.md`.
- 각 행동 뒤 `snapshot` 으로 페이지 상태를 확인하고 의도한 변화가 일어났는지 본다.
- 출력된 TS 라인을 모은다. **이건 초안이다.** 그대로 쓰지 않는다.

검증: 계획서의 주요 행동마다 대응하는 생성 코드 라인이 있다.

### 3. 컨벤션에 맞게 재구조화 (codegen ≠ 최종)

codegen 산출물은 평평한 액션 나열일 뿐 구조·인증·검증이 빠져 있다. 1단계에서 배운 패턴으로 다듬는다.

- **인증을 본문에서 분리.** 로그인 단계를 매 테스트에 인라인하지 말고 storageState 픽스처/ setup 프로젝트로 옮긴다. 근거와 패턴: `references/storage-state.md` + `references/auth-fixture.md`.
- **`test.step` 으로 단계 구분.** 계획서의 각 단계를 하나의 `test.step` 으로 감싸 실패 위치가 리포트에 드러나게 한다.
- **스텝명은 프로젝트 언어를 따른다.** 본 프로젝트 발표 결과물 기준은 **한글 스텝명**(예: `await test.step('로그인 후 대시보드 진입', ...)`).
- **셀렉터 승격.** codegen 의 깨지기 쉬운 셀렉터를 프로젝트 관례(role/testid)로 바꾼다.
- **초기화 로직 추가.** 로그인·시드 데이터·기능 플래그 등 계획서가 전제하는 선행 상태를 setup 으로 명시한다.
- **assertion 추가.** codegen 은 행동만 잡는다. 계획서의 기대 결과를 `expect` 로 옮긴다.

목표 골격과 before/after 예시: `references/test-structure.md`.

검증: 파일이 1단계 요약 패턴과 일치하고, 모든 계획 단계가 `test.step` + `expect` 로 표현됐다.

### 4. 단계별 실행 검증

작성하면서(또는 직후) 단계가 실제로 통과하는지 브라우저에서 확인한다. "코드가 그럴듯하다"는 통과의 증거가 아니다.

- 시나리오를 끝까지 한 번 돌려 흐름이 막히지 않는지 본다.
- 막히면 그 단계만 분리해 `run-code` 로 검사한다(`references/running-code.md`).
- 셀렉터 미스·타이밍 이슈는 여기서 잡는다. 불안정하면 명시적 대기/`expect` 자동 재시도로 고친다.

검증: 시나리오가 처음부터 끝까지 사람 개입 없이 통과한다.

### 5. 품질 게이트 (완료 정의)

아래가 **모두** 초록일 때만 완료다. 하나라도 빨간불이면 고쳐서 다시 돈다.

```bash
# 1) 타입
yarn type-check        # 없으면: npx tsc --noEmit

# 2) 린트 (새 파일 경로 지정)
yarn lint              # 또는: npx eslint <new-spec-path>

# 3) 실제 테스트 실행 — green 이어야 함
npx playwright test <new-spec-path>
```

- type-check / lint 는 프로젝트 스크립트를 우선 쓰고, 없으면 위 fallback.
- 테스트 실행이 빨간불이면 **테스트가 진실을 말하는 것**일 수 있다(앱 버그) 아니면 셀렉터/대기 문제다. 구분해서 처리하고, 앱 버그로 의심되면 코드를 억지로 통과시키지 말고 보고한다.
- 게이트 운용 세부: `references/quality-gates.md`.

검증: 세 명령이 모두 통과하고, 그 출력으로 완료를 증명한다.

## 출력

- 프로젝트 컨벤션을 따르는 `*.spec.ts` 파일(들).
- 필요 시 storageState/auth 픽스처 또는 setup 프로젝트.
- 게이트 3종 통과 증거(명령 출력 요약).

## 파이프라인에서의 위치

이 Generator 는 E2E 파이프라인의 한 단계다. 앞뒤 단계는 다른 스킬이 맡는다.

- **앞(계획)**: `e2e-flow-planner` 가 무엇을·왜 테스트할지 정한 계획서를 만든다 → 이 스킬이 그 산출을 입력으로 받는다.
- **뒤(강화)**: 생성된 테스트의 플래키 제거·독립성·모킹 강화는 `e2e-test-hardener`.
- **뒤(치유)**: 이미 있던 테스트가 깨졌을 때 trace 로 진단·수정하는 건 `e2e-test-healer`.

들어온 요청이 사실 옆 단계면(계획이 없다 / 기존 테스트를 고쳐달라) 그쪽을 가리키고, 이 스킬의 신규 생성 워크플로를 억지로 적용하지 않는다.

## 하지 말 것

- 계획에 없는 시나리오를 임의로 추가하지 않는다(스코프 크리프, Planner 영역 침범).
- codegen 출력을 구조·검증 없이 그대로 커밋하지 않는다.
- 통과를 위해 assertion 을 약화하거나 삭제하지 않는다 — 그러면 테스트가 거짓말을 한다.
- 인증 비밀값을 코드에 하드코딩하거나 storageState 파일을 커밋하지 않는다.
- 단순 브라우저 조작/스크린샷만 필요한 요청에 이 워크플로를 끌어오지 않는다 — `playwright-cli` 로 충분하다.
