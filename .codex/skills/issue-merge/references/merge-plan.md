# 충돌 사전 감지 · 계획 수립 · 해소 · 비판 검토

## 1. 계획 디렉터리

```bash
node <skill>/scripts/issue-merge.mjs plan-dir 16 21 53 64
```

번호는 정렬돼 `.issue/merge/16-21-53-64/` 가 된다. 여기에 `plan.md` 와 `review.md` 를 쓴다.
`.issue/merge/**` 는 무시되는 경로다. 계획 문서는 커밋되지 않는다.

## 2. 충돌 사전 감지 — 계획을 세우기 전에

**merge 를 시도해 보고 나서 충돌을 아는 방식은 쓰지 않는다.** 먼저 확정한다.

```bash
node <skill>/scripts/issue-merge.mjs preflight --branch fix/16-login-redirect
```

`git merge-tree` 로 합친 결과를 만들어만 본다. 워킹트리도, 인덱스도, base 브랜치도 바뀌지 않는다.

```json
{ "branch": "...", "clean": false, "commit": null,
  "conflicts": [{ "path": "src/shared/api.ts", "kind": "content" },
                { "path": "yarn.lock", "kind": "generated" }] }
```

```text
clean       충돌 없이 합쳐지는가
commit      다음 회차가 이어 볼 수 있는 커밋. clean 일 때만 나온다
conflicts   실제로 충돌하는 파일. inventory 의 overlapsWith 와 달리 추측이 아니다
kind        content = 사람이 합쳐야 함 / generated = lockfile·빌드 산출물, 다시 만들어야 함
```

후보 전부를 base 대비로 한 번씩 돌린다. 이것이 1차 재료다.

### 순서를 정한다

**merge 순서 근거는 확정된 충돌 관계다.** 변경 파일 수가 아니다 — 2파일이 핵심 파일 하나를 건드리면 9파일보다 위험하다.

```text
1. base 대비 clean 한 것을 먼저 넣는다. 실패할 여지가 없다.
2. 충돌하는 것끼리는 변경 범위가 좁은 쪽을 먼저 넣어 기준을 만든다.
3. 같은 파일을 건드리는 묶음은 서로 붙여 둔다. 사이에 다른 것을 끼우면 원인 추적이 어려워진다.
```

### 누적 시뮬레이션 — 순서 효과를 본다

정한 순서대로 앞 회차의 `commit` 을 다음 회차의 `--onto` 로 넘긴다.

```bash
node <skill>/scripts/issue-merge.mjs preflight --branch fix/53-n-plus-one          # → commit A
node <skill>/scripts/issue-merge.mjs preflight --branch fix/16-login-redirect --onto <A>   # → commit B
node <skill>/scripts/issue-merge.mjs preflight --branch feat/21-search-filter --onto <B>
```

**이 단계를 건너뛰면 "혼자서는 통과하는데 순서 때문에 깨지는" 경우를 놓친다.**
base 대비로는 셋 다 clean 인데 누적하면 마지막이 충돌하는 상황이 흔하다. 앞의 merge 가 뒤의 기준선을 바꾸기 때문이다.

- `--onto` 에는 **커밋**을 넘긴다. `tree` 값을 넘기면 실패한다(공통 조상을 찾을 수 없다).
- 충돌이 나면 그 회차에서 체인이 끊긴다. 5절에서 해소한 뒤 그 지점부터 다시 잇는다.

## 3. 분석 서브에이전트 팬아웃

**워크트리 개수만큼** `issue-merge-analyst` 를 병렬로 띄운다. 각 에이전트에는 하나만 배정한다.

각 프롬프트에 넣을 것:

```text
- 배정된 워크트리 경로와 브랜치
- 기본 브랜치 이름
- inventory 가 뽑은 그 워크트리의 항목 전체
- 그 브랜치의 preflight 결과 (단독 · 누적 둘 다)  ← 확정된 충돌. 추측을 넘기지 않는다
- 다른 워크트리들의 { branch, changedFiles } 목록
- 연결된 이슈의 완료 기준 (본문에서 뽑아낸 것)
```

각 에이전트는 JSON 하나를 돌려준다. `resolved` 와 `recommendation` 이 핵심이다.

에이전트가 `null` 을 돌려주거나 죽으면 그 워크트리는 **보류**로 처리한다. 빈 결과를 성공으로 취급하지 않는다.

## 4. plan.md 작성

분석 결과를 모아 계획을 쓴다. **각 단계는 판정 기준이 있어야 한다.** "확인 후 진행" 같은 문장은 비판 단계에서 걸린다.

```markdown
# 통합 계획 — #16 #21 #53 #64

## 대상

| 이슈 | 브랜치 | PR | 변경 파일 | 판정 |
| --- | --- | --- | ---: | --- |
| #16 | fix/16-login-redirect | #101 | 3 | merge |
| #21 | feat/21-search-filter | #102 | 7 | merge |
| #53 | fix/53-n-plus-one | #103 | 2 | merge |
| #64 | feat/64-export-csv | #104 | 9 | 보류 (before 증거 없음) |

## 충돌 현황 (preflight 확정)

| 브랜치 | base 대비 | 누적 대비 | 충돌 파일 | 종류 | 해소 |
| --- | --- | --- | --- | --- | --- |
| fix/53-n-plus-one | clean | clean | — | — | — |
| fix/16-login-redirect | clean | clean | — | — | — |
| feat/21-search-filter | clean | **충돌** | `src/shared/api.ts` | content | resolver |
| feat/21-search-filter | | | `yarn.lock` | generated | 재생성 |

#21 은 **혼자서는 깨끗하게 들어간다.** #16 을 먼저 넣은 뒤에만 충돌한다.
누적 시뮬레이션을 돌리지 않았으면 merge 직전까지 몰랐을 항목이다.

## merge 순서와 근거

1. **#53** — base 대비 clean, 다른 후보와 충돌 없음. 기준선을 세운다.
2. **#16** — #53 위에서도 clean. `src/shared/api.ts` 를 #21 과 공유하므로 먼저 넣어 기준을 만든다.
3. **#21** — #16 의 `api.ts` 변경 위에서 충돌. 5절에서 브랜치 쪽에서 해소한 뒤 넣는다.

순서 근거는 **preflight 로 확정된 충돌 관계**다. 변경 파일 수로 정하지 않는다.

## 단계별 판정 기준

| # | 단계 | 통과 조건 |
| --- | --- | --- |
| 1 | `preflight --branch feat/21-search-filter --onto <B>` | `clean: true`. 아니면 resolve 로 간다 |
| 2 | `gh pr checks 103` | 모든 체크 SUCCESS. 하나라도 FAILURE 면 중단 |
| 3 | `merge --pr 103` | `merged: true` |
| 4 | base-tree 에서 `git pull` | 충돌 0 |
| 5 | #53 통합 테스트 | 아래 재현 조건 참조 |
| ... | | |

## 통합 테스트 재현 조건

각 이슈의 증거를 만들 때 쓴 조건을 그대로 옮긴다.

- **#53** `oha -n 200 -c 10 http://localhost:8080/api/orders` → p95 ≤ 200ms (증거상 180ms)
- **#16** `http://localhost:3000/login` 1440x900 → 리디렉트 후 `/dashboard` 도달
- **#21** `http://localhost:3000/search?q=주문` 1440x900 → 필터 칩 3개 렌더

## 되돌리기

merge 후 통합 테스트가 실패하면:
- squash merge 이므로 `git revert <merge commit>` 한 번으로 되돌린다.
- 되돌린 뒤 해당 이슈는 close 하지 않고 실패 내용을 코멘트로 남긴다.

## 예외

- #64 는 증거 부족으로 제외. issue-end 로 before 를 만든 뒤 다음 회차에 포함한다.
```

## 5. 충돌 해소

**충돌이 0건이면 이 절을 통째로 건너뛰고 6절로 간다.** 없는 충돌을 위해 에이전트를 띄우지 않는다.

### 판을 깐다

해소는 **작업 브랜치 쪽에서** 한다. base 에서 합치면 PR 은 여전히 더러운 채로 남고, base-tree 를 오염시킨다.

```bash
node <skill>/scripts/issue-merge.mjs resolve --worktree /Users/me/work/repo-issue-21
```

그 워크트리에서 `origin/<base>` 를 merge 해 **진행 중 상태로 멈춘다.** 충돌 파일과 각 헌크의 줄 번호가 나온다.

```json
{ "started": true, "clean": false,
  "conflicts": [{ "path": "src/shared/api.ts", "kind": "content", "hunks": [42, 96] }] }
```

- 저장 안 된 변경이 있으면 시작하지 않는다. 먼저 커밋하거나 치운다.
- base 워크트리를 지정하면 거부된다.
- 되돌리려면 `resolve --worktree <경로> --abort`.

### 해소 서브에이전트

충돌이 있는 워크트리마다 `issue-merge-resolver` 를 띄운다. 여러 개면 병렬.

프롬프트에 넣을 것:

```text
- 워크트리 경로와 브랜치
- resolve 출력의 conflicts 전체
- 이 브랜치가 연결된 이슈의 완료 기준
- 반대쪽(이미 base 에 들어간) 변경이 무엇을 하려던 것인지 — 그쪽 이슈의 완료 기준
```

돌아오는 `verdict` 에 따라 갈린다.

| verdict | 행동 |
| --- | --- |
| `resolved` | `regenerate` 의 명령을 실행해 생성물을 다시 만들고 다음으로 |
| `partial` | 남은 것을 `escalate` 로 보고 아래 질문으로 간다 |
| `escalate` | 해당 PR 을 보류한다. 억지로 합치지 않는다 |

`escalate` 가 하나라도 있으면 `references/ask.md` 3절 형식으로 묻는다.

```text
#21 의 src/router.ts 에서 판단이 필요합니다.
#16 은 /legacy 경로에 리디렉트를 추가했고, #21 은 같은 경로를 제거했습니다.
어느 쪽이 맞는지 코드만으로는 알 수 없습니다.

질문 — issue-merge 5단계(충돌 해소 → 비판 서브에이전트로 모호성 검토)
이 파일을 어떻게 할까요?

1. #21 을 보류 (권장)      나머지만 통합하고 #21 은 다음 회차로 넘깁니다
2. #16 쪽을 남긴다          리디렉트를 유지합니다. #21 의 완료 기준이 깨질 수 있습니다
3. #21 쪽을 남긴다          경로를 제거합니다. #16 의 완료 기준이 깨질 수 있습니다

번호로 답해 주세요.
```

### 결과를 보여주고 승인받는다

**해소한 diff 를 사용자에게 보여준 뒤에만 push 한다.** resolver 결과를 그대로 밀지 않는다.

```bash
git -C <워크트리> diff --stat
git -C <워크트리> diff        # 파일이 적으면 전문, 많으면 파일별로 나눠서
```

승인 전까지는 커밋만 하고 멈출 수 있다.

```bash
node <skill>/scripts/issue-merge.mjs resolve --worktree <경로> --continue           # 커밋만
node <skill>/scripts/issue-merge.mjs resolve --worktree <경로> --continue --push    # 승인 후
```

`--continue` 는 충돌 마커가 하나라도 남아 있으면 커밋하지 않고 거부한다. 남은 파일과 줄 번호를 돌려준다.

### 다시 확인한다

push 한 뒤 같은 `--onto` 로 `preflight` 를 다시 돌려 `clean: true` 를 확인한다.

**아직 충돌하면 5절을 한 번 더 돈다. 최대 2회다.** 두 번째에도 안 되면 그 PR 을 보류하고 사유를 계획에 적는다.
같은 자리를 세 번 시도하는 것은 자동 해소로 풀 문제가 아니라는 신호다.

## 6. 비판 서브에이전트

`plan.md` 를 `issue-merge-critic` 에 넘긴다. **이 단계를 건너뛰지 않는다.**
해소를 했으면 그 결과도 함께 넘긴다 — **해소한 쪽이 스스로 승인하지 않는다.**

프롬프트에 넣을 것:

```text
- plan.md 전문
- inventory 결과 (계획이 사실과 맞는지 대조할 재료)
- preflight 결과 전부 (단독 · 누적)
- resolver 의 출력과 해소 diff (해소가 있었다면)
- "동의가 아니라 깨뜨리는 것이 역할이다"
```

결과를 `review.md` 에 저장한다.

| verdict | 행동 |
| --- | --- |
| `block` | `blocking` 항목을 전부 해소하도록 `plan.md` 를 고치고 다시 검토받는다 |
| `revise` | `warnings` 를 반영하고 넘어간다. 반영하지 않은 것은 이유를 계획에 적는다 |
| `proceed` | 다음 단계로 |

같은 계획으로 두 번 연속 `block` 이 나오면 자동 수정을 멈추고 사용자에게 판단을 넘긴다. 무한 루프를 돌지 않는다.

### 자주 걸리는 것

- 판정 기준 없는 단계 — "문제 없으면 진행"
- preflight 를 안 돌리고 "충돌 없음"이라고 단정
- 누적 시뮬레이션 없이 base 대비 결과만 보고 순서를 정함
- 해소가 한쪽 변경을 버렸는데 `resolved` 로 보고됨
- 이슈 close 가 통합 테스트보다 앞에 있음
- 되돌리기 방법이 없음
- `resolved: true` 인데 근거가 커밋 메시지뿐

## 7. 사용자 승인

`plan.md` 와 `review.md` 를 요약해 보여주고 승인받는다. 형식은 `references/ask.md` 3절을 따른다.

```text
순서       #53 → #16 → #21
충돌       1건 해소됨 — #21 의 src/shared/api.ts (양쪽 변경 모두 보존), yarn.lock 재생성
비판 검토   proceed / warnings 2건 반영됨

질문 — issue-merge 6단계(merge · 통합 테스트)
위 순서로 3개를 merge 할까요?

1. 이대로 진행 (권장)   #53 → #16 → #21 순서로 하나씩 merge 합니다
2. 순서 조정            원하는 순서를 직접 알려주세요
3. 일부만 merge         뺄 대상을 직접 알려주세요
4. 중단                 여기서 멈춥니다. 아무것도 merge 되지 않습니다

번호로 답해 주세요.
```

승인 없이 merge 하지 않는다.
