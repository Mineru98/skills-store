# CI 진단 레시피 (gh)

SKILL.md 1·2단계에서 **run/job/아티팩트를 못 찾거나, 재실행 run을 다뤄야 할 때** 연다. 모든 명령은 `gh` CLI 기준이며 레포 루트에서 실행한다. `gh auth status`로 인증부터 확인한다.

## 목차
- 좌표 잡기: PR → 실패한 run
- run URL만 있을 때
- 실패한 단계/테스트 이름 뽑기
- 아티팩트 나열·다운로드
- 재실행(attempt)·여러 워크플로우 다루기
- 자주 막히는 지점

## 좌표 잡기: PR → 실패한 run

```bash
# PR의 모든 체크 상태 (실패한 것만 보고 싶으면 --required 또는 grep)
gh pr checks <PR번호|URL>

# 체크를 JSON으로 받아 실패한 워크플로우의 link(run URL)만 추출
gh pr checks <PR번호> --json name,state,link \
  --jq '.[] | select(.state=="FAILURE") | {name, link}'
```

`link`의 끝 숫자가 **run-id**다: `https://github.com/<owner>/<repo>/actions/runs/<RUN_ID>`.

브랜치만 알 때:

```bash
gh run list --branch <브랜치> --limit 10
# E2E 워크플로우만 필터하려면 -w <워크플로우파일명 또는 이름>
gh run list -w e2e.yml --branch <브랜치> --limit 5
```

## run URL만 있을 때

URL `.../actions/runs/12345678` 에서 `12345678`이 run-id. 요약과 실패 잡 확인:

```bash
gh run view <RUN_ID>                # 요약 (잡별 conclusion)
gh run view <RUN_ID> --verbose      # 잡 안의 단계까지
gh run view <RUN_ID> --json jobs \
  --jq '.jobs[] | select(.conclusion=="failure") | .name'   # 실패한 잡 이름만
```

## 실패한 단계/테스트 이름 뽑기

전체 로그는 크다. **실패한 단계만**:

```bash
gh run view <RUN_ID> --log-failed
# 특정 잡만:  gh run view <RUN_ID> --job <JOB_ID> --log-failed
```

Playwright 출력에서 찾을 신호:
- `1) [project] › path/to/spec.ts:42:5 › test title` ← 실패한 **spec 파일·라인·테스트 제목**.
- `Error: expect(...).toBeVisible()` / `Timeout 30000ms exceeded` ← 실패 **종류**(assertion vs timeout).
- `Error: locator.click: ... waiting for locator('...')` ← 깨진 **셀렉터**.

이 세 가지(spec 위치 / 실패 종류 / 셀렉터)가 trace에서 어디를 볼지 정해준다.

## 아티팩트 나열·다운로드

이름을 모르면 먼저 나열한다(레포마다 다름):

```bash
# REST로 이 run의 아티팩트 이름·크기 보기
gh api repos/{owner}/{repo}/actions/runs/<RUN_ID>/artifacts \
  --jq '.artifacts[] | {name, size_in_bytes, expired}'
```

자주 쓰이는 이름: `playwright-report`, `playwright-trace`, `trace`, `test-results`, `blob-report`. `expired:true`면 만료된 것 — 재실행이 필요하다(아래).

격리 폴더로 다운로드:

```bash
gh run download <RUN_ID> -n <아티팩트이름> -D /tmp/e2e-trace/<RUN_ID>
# 이름을 모르면 전부 받고 안에서 찾기
gh run download <RUN_ID> -D /tmp/e2e-trace/<RUN_ID>

# 받은 폴더에서 trace.zip 위치 찾기
find /tmp/e2e-trace/<RUN_ID> -name 'trace.zip' -o -name '*.zip'
```

`playwright-report`(HTML 리포트) 안에는 보통 `data/*.zip` 형태로 케이스별 trace가 들어 있고, `test-results/<test>/trace.zip` 형태로 따로 올라오기도 한다. 둘 다 `npx playwright show-trace <zip>`으로 열린다.

## 재실행(attempt)·여러 워크플로우 다루기

- 재실행된 run은 attempt가 여러 개다. 특정 시도의 로그/잡을 보려면 `--attempt N`:
  ```bash
  gh run view <RUN_ID> --attempt 2 --log-failed
  ```
- 아티팩트가 만료(`expired:true`)됐거나 flaky 의심이면 재실행 후 새 아티팩트를 받는다:
  ```bash
  gh run rerun <RUN_ID> --failed     # 실패한 잡만 재실행
  gh run watch <RUN_ID>              # 끝날 때까지 관찰
  ```
- monorepo에서 워크플로우가 여러 개면, **실패한 그 run-id 하나에 고정**한다. 다른 워크플로우의 초록 run에서 아티팩트를 받으면 엉뚱한 trace를 분석하게 된다.

## 자주 막히는 지점

- `gh: command not found` → gh 미설치. 사용자에게 알리고 진행 보류.
- 인증 안 됨 → `gh auth login` 또는 `GH_TOKEN` 필요. 자격 증명을 추측하지 않는다.
- 아티팩트가 0개 → 워크플로우가 trace 업로드 단계를 (실패 시에도) 돌리도록 설정돼 있는지 확인 필요. 이건 trace 분석이 아니라 **CI 설정 문제**로 보고한다.
- 사설 호스트(GHE)면 `-R <host>/<owner>/<repo>` 또는 `GH_HOST`가 필요할 수 있다.
