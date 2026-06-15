# 품질 게이트 = 완료 정의

이 스킬에서 "완료"는 코드를 쓴 게 아니라 **세 게이트가 모두 초록**인 상태다. 발표의 완료 기준이 그렇다: 타입/lint 통과 + 실제 테스트 실행이 green.

순서가 중요하다. 싼 검사부터 돌려 빨리 실패시킨다.

## 게이트 1: 타입 체크

```bash
yarn type-check          # 프로젝트 스크립트가 있으면 우선
# 없으면:
npx tsc --noEmit
```

- 타입 에러는 보통 셀렉터 핸들 오용, 픽스처 import 경로, async/await 누락에서 난다.
- 새 spec 만 빠르게 보고 싶으면 `npx tsc --noEmit -p tsconfig.json` 후 출력에서 해당 파일 라인만 확인.

## 게이트 2: 린트

```bash
yarn lint                # 프로젝트 전체 규칙 적용
# 또는 새 파일만:
npx eslint <new-spec-path>
```

- 본 저장소처럼 lint 규칙이 강하면(`.codex/rules/` 의 네이밍·import 규칙 포함) 새 테스트 파일도 그 규칙을 통과해야 한다.
- 흔한 지적: 미사용 import(codegen 잔재), `await` 누락, 파일/심볼 네이밍.

## 게이트 3: 실제 실행 (green)

```bash
npx playwright test <new-spec-path>
# 디버깅이 필요하면(헤드풀/UI):
npx playwright test <new-spec-path> --headed
npx playwright test <new-spec-path> --ui
```

- 이게 본질이다. **타입과 lint 가 통과해도 실행이 빨간불이면 완료가 아니다.**
- setup 프로젝트가 있으면 자동으로 먼저 돈다. 인증 storageState 가 만들어지는지 확인.

### 빨간불일 때: 테스트 버그인가 앱 버그인가

실행 실패를 두 갈래로 나눈다. 섞으면 잘못된 수정을 한다.

1. **테스트 문제** — 셀렉터가 페이지와 안 맞음, 타이밍(요소가 아직 안 뜸), 잘못된 기대값.
   - 셀렉터: 실제 페이지에서 `run-code` 로 확인해 교정(`playwright-cli/references/running-code.md`).
   - 타이밍: 고정 `waitForTimeout` 대신 `expect(locator).toBeVisible()` 같은 자동 재시도 단언, 또는 `waitForLoadState`.
   - 기대값: 계획서를 다시 읽고 expect 를 맞춘다.

2. **앱 문제** — 계획서대로 동작해야 하는데 앱이 실제로 안 됨.
   - 이때 **테스트를 통과시키려고 assertion 을 약화/삭제하지 않는다.** 그러면 테스트가 거짓말을 한다.
   - 재현 단계와 함께 "이건 앱 버그로 보인다"고 보고한다. 테스트는 버그를 드러내는 게 정상이다.

## 불안정(flaky) 테스트 처리

같은 테스트가 돌릴 때마다 결과가 갈리면 신뢰할 수 없다.

- 원인은 대개 고정 대기, 경쟁 상태, 정리 안 된 상태(이전 테스트 잔재).
- 해법: 자동 재시도 단언으로 대기 표현, 테스트 간 상태 격리(픽스처에서 초기화), 네트워크 응답 대기를 명시.
- 임시방편으로 `test.retry` 를 거는 건 원인을 가린다 — 마지막 수단으로만.

## 완료 보고

세 게이트를 통과하면, 그 **증거**로 완료를 보고한다. "아마 될 것"이 아니라 명령 출력 요약을 첨부한다.

```
type-check: PASS (tsc --noEmit, 0 errors)
lint:       PASS (eslint <file>, 0 problems)
test:       PASS (playwright test <file>, N passed)
```

하나라도 빨간불이면 완료가 아니다 — 워크플로 4·5단계로 돌아간다.
