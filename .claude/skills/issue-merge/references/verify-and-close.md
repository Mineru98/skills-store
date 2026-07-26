# merge · 통합 테스트 · close

## 0. 자동 close 트리거 제거 — merge 보다 먼저

PR 본문에 `Closes #N` / `Fixes #N` / `Resolves #N` 이 있으면 **merge 되는 순간 GitHub 이 이슈를 닫는다.**
통합 테스트를 돌리기 전에 닫히므로, "close 는 통합 테스트 뒤" 규칙이 그대로 깨진다.

검증되지 않은 이슈가 닫히는 것을 막는 것이 규칙의 목적이다. 따라서 **merge 전에 트리거를 걷어낸다.**

```bash
gh pr view <PR> --json body -q .body | grep -inE '(close[sd]?|fix(e[sd])?|resolve[sd]?) +#[0-9]+'
```

걸리면 해당 키워드만 무력화하고 본문을 다시 올린다. 이슈 참조 자체는 남긴다 — 추적을 잃지 않기 위해서다.

```bash
gh pr view <PR> --json body -q .body > /tmp/pr-body.md
# "Closes #3" → "관련 이슈: #3 (통합 테스트 뒤 수동 close)"
gh pr edit <PR> --body-file /tmp/pr-body.md
```

수정 뒤 반드시 재확인한다. 남아 있으면 merge 하지 않는다.

```bash
gh pr view <PR> --json body -q .body | grep -icE '(close[sd]?|fix(e[sd])?|resolve[sd]?) +#[0-9]+'   # 0 이어야 한다
```

- **PR 본문 수정은 허용된다.** 이 스킬의 non-goal 은 "이슈 본문 수정"이며 PR 본문은 여기에 해당하지 않는다.
- 권한이 없거나 수정이 실패하면 merge 를 멈추고 사용자에게 알린다. 자동 close 를 사후 수용하지 않는다.
- 이미 자동 close 된 뒤에 발견했다면 6절의 사후 처리를 따른다.

## 1. CI 확인 후 merge

계획의 순서대로 하나씩 처리한다. 한꺼번에 돌리지 않는다. 앞의 merge 가 뒤의 기준선을 바꾸기 때문이다.

```bash
gh pr checks 103                                   # 먼저 확인
node <skill>/scripts/issue-merge.mjs merge --pr 103 --method squash
```

- **CI 가 실패한 PR 은 merge 하지 않는다.** 계획에서 빼고 사유를 기록한다.
- `--method` 는 저장소의 기존 관행을 따른다. `git log --merges -5` 로 확인한다. 기본은 `squash`.
- `--delete-branch` 를 붙이지 않는다. 증거 URL 이 브랜치에 의존할 수 있다.

merge 가 실패하면 출력의 `cause` 를 읽는다. 스크립트가 이미 갈라 놓았으므로 다시 조사하지 않는다.

| cause | 뜻 | 다음 행동 |
| --- | --- | --- |
| `conflict` | 합쳐지지 않는다 | `preflight` 로 다시 확정하고 `resolve` 로 해소한다 |
| `checks` | CI 가 실패했다 | **merge 하지 않는다.** 계획에서 빼고 사유를 기록한다 |
| `approval` | 리뷰 승인이나 브랜치 보호 | 스크립트가 우회하지 않는다. 사용자에게 알린다 |
| `state` | 이미 닫혔거나 merge 됨 | `gh pr view` 로 확인하고 정리 대상으로 넘긴다 |

`conflict` 이면 4단계에서 preflight 를 통과했는데도 실패했다는 뜻이다 —
그 사이 base 가 움직였거나, 5단계 해소 이후 다른 PR 이 먼저 들어갔다. 계획이 틀린 것이 아니라 기준선이 바뀐 것이다.

```text
질문 — issue-merge 6단계(merge · 통합 테스트)
PR #21 의 merge 가 충돌로 실패했습니다. 어떻게 할까요?

1. 충돌 해소 후 재시도 (권장)   5단계로 돌아가 preflight → resolve 를 한 번 더 돕니다
2. 이 PR 만 보류하고 계속        계획의 다음 순서로 넘어갑니다
3. 이번 회차 중단                여기서 멈춥니다. 이미 merge 된 것은 그대로 남습니다

번호로 답해 주세요.
```

**같은 PR 에 대한 해소 재시도는 최대 2회다.** 세 번째부터는 1번 선택지를 빼고 보류로 넘긴다.
자동으로 풀 문제가 아니라는 신호이고, 반복하면 사용자만 같은 질문을 계속 받는다.

`conflict` 이 아닌 실패는 해소로 풀리지 않는다. 1번 선택지를 넣지 않는다.

여러 건을 순서대로 처리하므로 **지금 몇 번째를 다루는지 함께 적는다.**

```text
현재 단계 — issue-merge 6단계(merge · 통합 테스트) · #16 #21 #53 중 #21 처리 중
```

## 2. base-tree 갱신

merge 한 결과를 받아온다.

```bash
node <skill>/scripts/issue-merge.mjs base-tree      # 최신 origin/<base> 로 맞춘다
```

`.issue/merge/base/` 가 방금 merge 된 상태가 된다. 통합 테스트는 여기서 돌린다.
**사용자의 작업 트리는 여전히 건드리지 않는다.**

## 3. 통합 테스트

각 이슈의 **증거를 만들 때 쓴 조건 그대로** 재현한다. 새 조건을 만들지 않는다. 그래야 "개별로는 됐는데 합치니 깨졌다"를 잡아낼 수 있다.

```bash
cd .issue/merge/base
<의존성 설치>
<빌드 / 서버 기동>
```

### 프론트엔드

증거와 같은 URL·뷰포트·대기 조건으로 다시 찍어 비교한다.

```bash
node <capture.mjs 경로> \
  --url http://localhost:3200/search?q=주문 \
  --out .issue/merge/16-21-53-64/verify/21-search.webp \
  --width 1440 --height 900 --full --wait "text=검색 결과" \
  --box ".filter-chip" --box-label "필터 칩"
```

after 증거(`.issue/21/evidence/after/`)와 나란히 놓고 같은 결과인지 본다. 다르면 통합으로 깨진 것이다.

### 백엔드

```bash
oha -n 200 -c 10 http://localhost:8180/api/orders | tee .issue/merge/16-21-53-64/verify/53-bench.txt
```

증거의 after 수치와 비교한다. 유의미하게 나빠졌으면 통합 회귀다.

### 판정

```text
이슈   재현 조건            증거 기준        통합 후        판정
----  -------------------  --------------  ------------  ------
#53   oha p95              180ms           176ms         통과
#16   /login → /dashboard  리디렉트 성공    리디렉트 성공  통과
#21   필터 칩 3개          3개              0개           실패
```

## 4. 실패 처리

통합 테스트가 실패한 항목은:

1. **이슈를 닫지 않는다.**
2. 원인을 조사해 그 이슈에 코멘트로 남긴다. 어떤 조합에서 깨졌는지 명시한다.
3. 되돌릴지 후속 수정할지 묻는다.

```text
질문 — issue-merge 6단계(merge · 통합 테스트)
#21 이 통합 후 깨졌습니다. 어떻게 할까요?

1. revert 하고 다시 작업 (권장)   merge 커밋을 되돌리고 /issue-start 로 재착수합니다
2. 이대로 두고 후속 이슈 등록      /issue-create 로 회귀 이슈를 만듭니다
3. 무시하고 진행                   권장하지 않습니다. 기록만 남기고 넘어갑니다

번호로 답해 주세요.
```

squash merge 면 revert 는 커밋 하나다.

```bash
git -C .issue/merge/base revert <merge commit>
```

## 5. 이슈 close

**통합 테스트를 통과한 것만** 닫는다. 순서를 앞당기지 않는다.

```bash
node <skill>/scripts/issue-merge.mjs close --issue 53 --comment-file .issue/merge/16-21-53-64/verify/53-result.md
```

`close` 는 닫기 **직전에** 진행 상태를 `status:close` 로 옮긴다. 출력 JSON 의 `status` / `statusChanged` 로 확인한다.
닫힌 뒤에 붙이면 실패 여지가 늘어나므로 순서를 바꾸지 않는다. 라벨 전환을 건너뛰려면 `--no-status`.

close 코멘트에는 통합 재검증 결과를 넣는다.

```markdown
## 통합 완료

PR #103 이 `main` 에 merge 되었고, 통합 후 재검증을 통과했습니다.

| 지표 | 개별 검증 | 통합 후 |
| --- | ---: | ---: |
| p95 (ms) | 180 | 176 |

함께 통합된 작업: #16, #21
```

### 이미 자동으로 닫혀 있다면

0절을 지켰다면 이 상황은 생기지 않는다. 그래도 닫혀 있다면(0절 이전에 merge 됐거나 트리거 제거가 실패한 경우) 이렇게 처리한다.

| 통합 테스트 결과 | 처리 |
| --- | --- |
| 통과 | close 를 건너뛰고 재검증 결과 코멘트만 남긴다 |
| **실패** | **이슈를 다시 연다.** 검증되지 않은 채 닫혀 있으면 안 된다 |

```bash
gh issue reopen <번호> --comment "통합 후 재검증 실패로 재오픈합니다. <실패 내용>"
```

그리고 그 회차 보고에 "자동 close 를 사전에 막지 못했다"를 기록한다. 다음 회차에는 0절에서 걸러야 한다.

## 6. 정리

통합이 끝난 워크트리를 제거한다. 이슈가 닫힌 것만 대상이다.

```bash
node <skill>/scripts/issue-merge.mjs cleanup --worktree <경로> --branch <브랜치>
node <skill>/scripts/issue-merge.mjs base-tree --remove
```

### 지우지 않는 것

- **`evidence/issue-*` 브랜치** — 기본 브랜치 보호로 폴백된 증거가 여기 있다. 지우면 이슈 코멘트의 이미지가 전부 깨진다.
- **원격 작업 브랜치** — 삭제는 아래 정리 질문과 **따로** 확인받는다. 증거 URL 이 의존할 수 있다.
- **통합되지 않은 워크트리** — 보류된 것은 다음 회차 대상이다.
- **`.issue/<번호>/evidence/`** — 기본 브랜치에 커밋된 증거는 영구 보존이다.

정리 전에 무엇을 지울지 목록으로 보여주고 확인받는다. 경로는 `inventory` 의 `display` 값을 쓴다 — 그래야 사용자가 `ctrl+클릭` 으로 열어 내용을 확인한 뒤 결정할 수 있다. 여기에는 인벤토리에서 넘어온 "이슈가 이미 닫힌 워크트리"도 함께 올린다.

```text
지울 것
- `.issue/worktrees/16-login-redirect`      [#16](url) — close 됨
- `/Users/me/work/repo-issue-53`            [#53](url) — close 됨

남길 것
- `/Users/me/work/repo-issue-64`            [#64](url) — 보류, 다음 회차 대상
- `evidence/issue-*` 브랜치                  증거 URL 이 의존
```

```text
질문 — issue-merge 7단계(이슈 close · 정리)
위 2개 워크트리를 정리할까요?

1. 전부 정리 (권장)   목록의 워크트리와 로컬 브랜치를 제거합니다
2. 일부만 정리        남길 것을 직접 알려주세요
3. 정리하지 않음      전부 그대로 둡니다

번호로 답해 주세요.
```

## 7. 남은 것 정리

보류된 이슈가 있으면 무엇을 해야 다음 회차에 포함되는지 구체적으로 적는다.

```text
#64  before 증거 없음 → 해당 워크트리에서 /issue-end 실행해 pure-tree 로 before 캡처
```
