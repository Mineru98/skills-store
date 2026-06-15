---
name: e2e-ci-trace-debug
description: >-
  CI에서 실패한 E2E 테스트를 PR 또는 GitHub Actions 실행 링크에서부터 끝까지 추적해 고치는 워크플로우. PR 머지가 E2E 실패로 막혔거나,
  Actions에 trace/Playwright report 아티팩트가 올라온 실패가 있거나, "CI에서 e2e가 깨졌다 / PR 체크가 빨갛다 / trace 받아서 원인 좀
  봐줘 / failing e2e on this PR / playwright trace 분석 / e2e-debug" 같은 요청이 나오면 사용한다. gh로 trace.zip을
  받아 로컬에서 분석하고 원인을 찾은 뒤, 픽스를 같은 PR에 반영해 검증 루프를 닫는 것까지가 이 스킬의 범위다. 단순히 새 테스트를 작성하거나 로컬에서 브라우저를 돌려보는
  요청과는 다르다 — 시작점이 "CI 실패"라면 이 스킬을 먼저 적용한다. ▷ 경계: 이미 로컬에 trace/실패가 재현돼 있으면 e2e-test-healer, 아직 실패하지
  않은 테스트의 머지 전 선제 견고화는 e2e-test-hardener 이다(이 스킬은 "원격 CI 아티팩트부터 받아와야 하는" 진입점 전용).
---
# CI E2E 실패 → trace 분석 → 픽스 루프 (e2e-debug)

에이전트가 PR을 올리면 CI가 E2E로 검증하고, 실패하면 머지를 막고 PR에 코멘트를 남기며 **trace를 아티팩트로 업로드**한다. 이 스킬은 그 실패 지점에서 출발해 사람 개발자가 하던 흐름 — *CI 로그 본다 → trace로 원인 찾는다 → 고쳐서 다시 올린다* — 을 에이전트가 그대로 수행하게 해서, "작업하고 테스트로 검증하는 자가 개선 루프"를 닫는다.

이 스킬은 **워크플로우와 판단**을 다룬다. Playwright/브라우저 CLI 문법 자체는 `playwright-cli` 스킬이 이미 다루므로 여기서 반복하지 않고 **참조**한다. 새로운 가치는 "무엇을 / 왜 / 언제"이지 명령어 사전이 아니다.

## 언제 멈추고 다른 길로 갈지 (먼저 판단)

- 시작점이 **CI 실패(빨간 PR 체크 / 실패한 Actions run)** 이면 → 이 스킬. 계속 진행.
- 시작점이 "새 시나리오를 테스트로 써줘" 면 → 이 스킬 아님. 계획은 `e2e-flow-planner`, 코드 생성은 `e2e-test-generator`로.
- 이미 **로컬 trace.zip / 실패 스펙 이름**을 손에 들고 있고 CI 좌표 잡기가 필요 없다면 → 곧바로 `e2e-test-healer`로. 이 스킬의 가치는 "CI 실패를 로컬 trace까지 가져오고 PR 루프를 닫는" 앞·뒤 절반이다.
- 실패 원인이 **테스트가 아니라 제품 코드 회귀**로 드러나면 → 테스트를 억지로 통과시키지 말고 그 사실을 명확히 보고. 테스트는 신호다; 신호를 죽이지 않는다(이 판단의 본체는 Healer가 다룬다).
- 로그가 곧바로 원인을 말해주는 사소한 실패(오타 import, 명백한 셀렉터 변경)면 → trace까지 안 받아도 된다. 4단계로 점프.

## 워크플로우 (한 번에 엮어주는 4단계)

핵심 가치는 이 네 단계를 **끊김 없이** 잇는 데 있다. 각 단계는 다음 단계로 넘어갈 **증거**를 만든다.

```
1. 실패 식별   → 어떤 run·job·테스트가 왜 빨간지 확정       (증거: run-id, 실패 테스트명, 실패 단계 로그)
2. trace 수거  → 그 run의 아티팩트를 로컬로 다운로드          (증거: 로컬 trace.zip 경로)
3. 원인 분석   → trace를 열어 실패 순간의 DOM·네트워크·타이밍 확인 (증거: 한 줄 근본 원인 + 깨진 위치)
4. 픽스 & 재검증 → 테스트(또는 코드)를 고쳐 같은 PR에 push → CI 재실행 관찰 (증거: 초록 체크)
```

### 1. 실패 식별 — 무엇이 왜 빨간지 확정

입력은 보통 둘 중 하나다: **PR 번호/URL** 또는 **실패한 Actions run URL**. 먼저 좌표를 잡는다.

```bash
# PR에서 출발: 어떤 체크가 깨졌는지 + 실패한 체크의 run 링크
gh pr checks <PR-번호 또는 URL>
# run URL에서 출발: .../actions/runs/<RUN_ID> 의 RUN_ID 를 기억

# 실패한 단계만 골라 로그 확인 (전체 로그 말고 실패 부분만)
gh run view <RUN_ID> --log-failed
```

확정해야 할 것: **run-id**, **실패한 테스트 spec 이름**, **실패가 assertion인지 timeout인지 setup 단계인지**. 이걸 모르면 trace를 받아도 어디를 볼지 모른다.

깊은 진단 명령 모음은 [references/ci-diagnosis.md](references/ci-diagnosis.md) 참고 — monorepo에서 어떤 워크플로우/잡이 E2E인지 못 찾을 때, attempt가 여러 번인 재실행 run을 다룰 때 등.

### 2. trace 수거 — 아티팩트를 로컬로

Playwright는 CI에서 실패 케이스의 trace를 zip 아티팩트로 올린다(흔한 이름: `playwright-trace`, `playwright-report`, `trace`, `test-results`). 이름을 모르면 먼저 나열한다.

```bash
# run의 아티팩트 목록 확인 (이름 모를 때)
gh api repos/{owner}/{repo}/actions/runs/<RUN_ID>/artifacts --jq '.artifacts[].name'

# 이름을 알면 그 아티팩트만 받아 작업 폴더에 푼다
gh run download <RUN_ID> -n playwright-report -D /tmp/e2e-trace/<RUN_ID>
```

`-D`로 **격리된 폴더**에 받는다. 레포 작업 트리를 trace 파일로 오염시키지 않기 위함이다. 다운로드된 트리에서 `*.zip` 또는 `trace.zip`을 찾으면 그게 3단계 입력이다.

### 3. 원인 분석 — trace를 열어 실패 순간을 본다

trace는 단순 로그가 아니라 **실패 직전·직후의 DOM 스냅샷 + 스크린샷 + 네트워크 + 콘솔 + 타이밍**을 담는다. 그래서 "왜 빨간가"를 추측이 아니라 관찰로 답할 수 있다. 이게 이 워크플로우의 심장이다.

```bash
# 받은 trace.zip 을 Playwright trace viewer 로 연다
npx playwright show-trace /tmp/e2e-trace/<RUN_ID>/**/trace.zip
```

trace 도구의 기능·읽는 법은 `playwright-cli`의 [tracing 레퍼런스](../playwright-cli/references/tracing.md)가 다룬다(액션 로그, 네트워크 워터폴, 단계별 DOM). 이 스킬에서의 분석은 **다음 단계로 넘길 만큼만 좁히는 분류(triage)** 다 — 가설을 세워 trace에서 그 가설을 확인할 정보만 꺼내 본다:

- 실패한 액션에서 **DOM 스냅샷의 셀렉터가 실제로 존재하는가** → 없으면 UI 변경/셀렉터 깨짐.
- 실패가 **timeout**이면, 네트워크 탭에서 **펜딩/실패한 요청**이나 느린 응답을 본다 → 대기 조건 부족 or 백엔드 회귀.
- 스크린샷이 **로그인/에러 페이지**를 보이면 → 인증·시드 데이터·환경 문제(테스트 로직 아님).
- 로컬에선 되는데 CI만 깨지면 → 타이밍·환경차. 같은 셀렉터를 **로컬에서 `playwright-cli`로 재현**해 격차를 좁힌다.

triage 체크리스트와 실패 유형별 분기는 [references/trace-triage.md](references/trace-triage.md)에 정리. **근본 원인을 끝까지 파고 통과할 때까지 고치는 본격 진단 루프는 `e2e-test-healer`의 책임**이므로, 분류가 끝나면 trace 경로와 실패 스펙명을 들고 그쪽으로 넘긴다(4단계).

이 단계의 산출물은 **로컬 trace.zip 경로 + 한 줄 가설**이다. 예: "`#submit` 버튼이 `data-testid='submit'`로 바뀌어 셀렉터가 매칭 실패(테스트 낡음)" / "결제 API가 500을 반환해 성공 토스트가 안 떠 assertion timeout(제품 회귀 의심)".

### 4. 픽스 & 재검증 — 고쳐서 같은 PR에 반영하고 CI를 다시 본다

**고치는 행위 자체는 `e2e-test-healer`에 위임**한다. Healer는 로컬 trace.zip(3단계 산출물)을 입력으로 받아 `run → debug → root-cause → fix → verify`를 돌리고, "테스트가 낡은 것 / 제품 코드가 회귀한 것"을 판단해 올바른 쪽을 고친 뒤 **로컬에서 green**을 확인한다. 새 셀렉터가 필요하면 Healer가 `playwright-cli`의 role 기반 안정 셀렉터([test-generation](../playwright-cli/references/test-generation.md))를 쓴다. 같은 일을 여기서 다시 적지 않는다.

이 스킬이 추가로 책임지는 것은 Healer가 다루지 않는 **CI 레벨의 루프 닫기**다 — 로컬 green ≠ CI green이기 때문이다:

```bash
# 고친 변경을 같은 브랜치/PR에 push → CI가 자동 재실행
git add -A && git commit -m "fix(e2e): <한 줄 원인 요약>" && git push
gh pr checks <PR-번호> --watch   # PR 체크가 다시 초록이 될 때까지 관찰
```

**루프를 닫는 게 목적**이다: push만 하고 끝내지 않는다. PR의 CI 재실행이 실제로 통과하는 것을 확인해야 "에이전트가 작업 → 테스트로 검증"하는 자가 개선 사이클이 닫힌다. 다시 실패하면 새 run의 trace로 **2단계부터 반복**한다(같은 원인의 무한 push를 피하려고, 매 사이클 trace로 원인을 다시 확인한다).

## 큰 Next.js 엔터프라이즈 레포에서의 현실 팁

- E2E 잡 이름·아티팩트 이름은 레포마다 다르다. **추측 말고 나열**(1·2단계의 list 명령). 한 번 확인했으면 `.omc/` 메모나 PR 코멘트에 적어 다음 번 비용을 줄인다.
- monorepo면 여러 워크플로우가 돈다. 실패한 **그** run-id에 고정해 작업한다(다른 초록 run의 아티팩트를 받지 않도록).
- trace 다운로드는 항상 `/tmp` 등 작업 트리 밖으로. 큰 레포에서 trace/resources가 git status를 더럽히면 리뷰가 망가진다.
- 비밀값을 trace 스크린샷/네트워크 바디에서 읽어 코드/코멘트에 옮기지 않는다. 인증 실패로 보이면 자격 증명을 추측해 넣지 말고 환경 문제로 보고한다.

## 참조 파일 (필요할 때만 연다)

- [references/ci-diagnosis.md](references/ci-diagnosis.md) — gh로 run·job·아티팩트를 찾는 명령 레시피, 재실행/attempt 처리. **1·2단계가 막힐 때.**
- [references/trace-triage.md](references/trace-triage.md) — 실패 유형(셀렉터/타임아웃/환경/플레이키)별 분기와 trace triage 체크리스트. **3단계 분류 때.**
- `e2e-test-healer` 스킬 — 로컬 trace에서 근본 원인을 끝까지 파고 통과까지 고치는 치유 루프. **4단계에서 실제 수정은 이쪽에 위임한다.**
- `playwright-cli` 스킬 — 브라우저/trace CLI 문법의 단일 출처. 이 스킬은 거기에 *얹어서* 동작하며 명령어를 복제하지 않는다.

## E2E 하네스 파이프라인에서의 위치

`e2e-flow-planner`(무엇을) → `e2e-test-generator`(코드로) → `e2e-test-hardener`(견고하게) → CI가 PR에서 실행 → **이 스킬(CI 실패를 trace로 가져와 PR 루프를 닫음)** → `e2e-test-healer`(로컬에서 실제 치유). 이 스킬은 "CI 실패"라는 진입점과 "PR 초록"이라는 종료점 사이를 잇는 다리다.
