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

merge 가 실패하면 출력의 `reason` 을 읽는다. 충돌이면 계획의 순서 판단이 틀린 것이다. 그 PR 을 보류로 돌리고 나머지를 계속할지 AskUserQuestion 으로 묻는다.

```text
질문: PR #<n> 의 merge 가 실패했습니다(<reason>). 나머지를 계속할까요?
- 보류하고 계속 (권장)   이 PR 만 빼고 계획의 다음 순서로 넘어갑니다
- 순서를 바꿔 재시도      먼저 넣을 PR 을 Other 로 입력받아 다시 시도합니다
- 이번 회차 중단          여기서 멈춥니다. 이미 merge 된 것은 그대로 남습니다
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
3. 되돌릴지 후속 수정할지 AskUserQuestion 으로 묻는다.

```text
질문: #21 이 통합 후 깨졌습니다. 어떻게 할까요?
- revert 하고 다시 작업 (권장)   git revert <merge commit> 후 /issue-start 로 재착수
- 이대로 두고 후속 이슈 등록      /issue-create 로 회귀 이슈를 만든다
- 무시하고 진행                   권장하지 않음. 기록만 남긴다
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
- **원격 작업 브랜치** — 삭제는 아래 정리 질문과 **따로** AskUserQuestion 으로 확인받는다. 증거 URL 이 의존할 수 있다.
- **통합되지 않은 워크트리** — 보류된 것은 다음 회차 대상이다.
- **`.issue/<번호>/evidence/`** — 기본 브랜치에 커밋된 증거는 영구 보존이다.

정리 전에 무엇을 지울지 목록으로 보여주고 AskUserQuestion 으로 확인받는다. 여기에는 인벤토리에서 넘어온 "이슈가 이미 닫힌 워크트리"도 함께 올린다.

```text
질문: 아래 <n>개 워크트리를 정리할까요?
- 전부 정리 (권장)   목록의 워크트리와 로컬 브랜치를 제거합니다
- 일부만 정리        남길 것을 Other 로 입력받습니다
- 정리하지 않음      전부 그대로 둡니다
```

## 7. 남은 것 정리

보류된 이슈가 있으면 무엇을 해야 다음 회차에 포함되는지 구체적으로 적는다.

```text
#64  before 증거 없음 → 해당 워크트리에서 /issue-end 실행해 pure-tree 로 before 캡처
```
