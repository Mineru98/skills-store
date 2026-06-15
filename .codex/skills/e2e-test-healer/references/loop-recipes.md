# Loop Recipes — 실행 / 재현 / 검증 명령

치유 루프를 돌릴 때 쓰는 명령 레시피. 브라우저 구동·trace 탐색의 **개별 CLI 문법은 `playwright-cli` 스킬**(특히 `references/tracing.md`)을 따른다. 이 파일은 "치유 루프에서 그것들을 어떻게 엮는가"만 다룬다.

## 0. 먼저 프로젝트의 테스트 실행 방식을 확인한다

명령을 짐작하지 말고 저장소에서 실제 스크립트를 찾는다.

- `package.json`의 `scripts`에서 e2e/playwright 관련 항목을 본다(예: `test:e2e`, `e2e`, `playwright test`).
- Playwright 설정(`playwright.config.*`)에서 `projects`, `testDir`, `use.trace` 기본값을 확인한다.
- 본 저장소 검증 게이트는 `yarn lint` / `yarn type-check`(RULE-BUILD-002, 프로젝트의 AGENTS.md 또는 `.codex/rules/**`의 빌드 규칙).

테스트 러너가 `yarn`인지 `npm`/`pnpm`인지도 락파일·스크립트로 확인한다. 아래 예시는 일반형이며 실제 프로젝트 스크립트로 치환한다.

## 1. Run — 지목된 스펙만 trace와 함께

전체 스위트를 돌리지 않는다. 피드백 루프를 짧게 유지하는 게 진단 속도를 좌우한다.

```bash
# 단일 스펙만, trace 켜고
npx playwright test e2e/checkout.spec.ts --trace on

# 한 테스트만 더 좁히기 (title grep)
npx playwright test e2e/checkout.spec.ts -g "주문 생성" --trace on

# 특정 프로젝트(브라우저)만
npx playwright test e2e/checkout.spec.ts --project=chromium --trace on
```

- 실패 시 trace는 보통 `test-results/<...>/trace.zip`에 떨어진다(설정에 따라 다름).
- `--trace on`은 통과해도 trace를 남긴다. 진단 중에는 통과/실패 모두 증거가 필요하니 `on`이 편하다.

`playwright-cli`로 인터랙티브하게 재현·관찰하려면 그 스킬의 `tracing-start`/`tracing-stop` 흐름을 쓴다.

## 2. Debug — trace 열기

trace zip을 여는 표준 방법:

```bash
npx playwright show-trace test-results/<path>/trace.zip
```

trace 뷰어/zip 안에서 무엇을 볼지는 `diagnosis-playbook.md`(증상→단서)와 `playwright-cli`의 `references/tracing.md`(액션 로그·DOM 스냅샷·네트워크·콘솔이 어디 담기는지)를 함께 본다.

## 3. Root-cause — 코드와 diff 대조

```bash
# 최근 변경 확인 (깨짐 시점 좁히기)
git log --oneline -15
git diff HEAD~1            # 직전 커밋이 뭘 건드렸나
git diff main...HEAD       # 브랜치가 건드린 전체

# 테스트가 부르는 제품 코드 찾기 (셀렉터/엔드포인트로 역추적)
# 예: 실패한 네트워크 요청 경로로 서비스 함수 찾기
```

판정은 `decision-test-vs-code.md`를 따른다.

## 4. Verify — 같은 스펙 재실행

```bash
# 수정 후 같은 스펙 다시 (여전히 trace 켜고)
npx playwright test e2e/checkout.spec.ts -g "주문 생성" --trace on
```

### flaky였다면 반복 실행으로 안정성 확인

한 번 통과 = 해결이 아니다. 반복해서 재현율을 본다.

```bash
# 같은 테스트를 N회 반복
npx playwright test e2e/checkout.spec.ts -g "주문 생성" --repeat-each=5

# 워커 1로 고정해 경합 요인 분리 (격리 디버깅용)
npx playwright test e2e/checkout.spec.ts --repeat-each=10 --workers=1
```

- 수정 전후 재현율을 비교한다(예: 수정 전 5/10 실패 → 수정 후 0/20 실패).
- 여전히 가끔 깨지면 아직 근본 원인이 아니다. `diagnosis-playbook.md`의 flaky 섹션으로 돌아간다.

## 5. 마지막 게이트 — lint / type

green을 확인했으면 변경이 새 깨짐을 만들지 않았는지 본다(RULE-BUILD-002 순서: lint → type-check).

```bash
yarn lint
yarn type-check     # 스크립트 없으면 npx tsc --noEmit
```

- 테스트 파일만 고쳤어도 타입/린트는 돌린다(셀렉터 타입, 미사용 import 등).
- 제품 코드를 고쳤다면 더더욱 필수 — 회귀 수정이 다른 곳을 깨지 않았는지.

## 루프를 엮는 한 줄 요약

```
run(단일 스펙, --trace on)
  → show-trace 로 실패 단계·단서 확인 (diagnosis-playbook)
  → git diff + 코드 대조로 원인 판정 (decision-test-vs-code)
  → 판정한 한쪽만 최소 수정
  → 같은 스펙 재실행 (+flaky면 --repeat-each)
  → green & 안정적이면 yarn lint / type-check
  → 빨가면 다시 trace 로. 모호하면 멈추고 질문.
```
