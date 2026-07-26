# 라벨 부착과 점검

라벨은 장식이 아니다. 이 저장소의 라벨은 **두 축**이고, 축마다 쓰임이 다르다.

```text
축              예시                          쓰임
성격 라벨        bug / enhancement / …         issue-start 가 브랜치 prefix 를 정한다
진행 상태 라벨    status:open / status:plan / …  파이프라인이 지금 어디까지 왔는지 보여준다
```

두 축은 **독립**이다. 한 이슈에 성격 라벨 하나 + 진행 상태 라벨 하나가 함께 붙는다.
성격 라벨이 없으면 브랜치 prefix 연결이 끊기고, 진행 상태 라벨이 없으면 이슈 목록만 보고 진행을 읽을 수 없다.
**새로 만드는 이슈에는 둘 다 붙이고, 기존 이슈도 두 축 모두 점검한다.**

## 성격 라벨과 매핑

```text
라벨            의미                    issue-start 브랜치 prefix
bug             동작이 잘못됨            fix/
enhancement     기능 추가·개선           feat/
documentation   문서                    docs/
chore           정리·설정·의존성          chore/
```

저장소에 이미 다른 컨벤션(`type: bug`, `kind/feature` 등)이 있으면 **그쪽을 따른다**. 표준 라벨을 강요하지 않는다.
다만 `LABEL_PREFIX` 는 완전일치로만 매칭하므로, 커스텀 컨벤션에서는 prefix 추론이 `fix/` 로 떨어진다.
그럴 때는 `worktree --prefix` 로 직접 지정한다.

## 진행 상태 라벨

```text
라벨                 의미                        전환 주체
status:open          등록됨, 아직 착수 전          issue-create — 등록 직후 자동
status:plan          분석·계획 중                 issue-start  — 이슈 수집 직후 자동
status:in-process    워크트리에서 구현 중          issue-start  — 워크트리 생성 직후 자동
status:review        PR 이 열려 리뷰·merge 대기    issue-end    — PR 생성 직후 (수동 호출)
status:close         merge 되어 종료              issue-merge  — 이슈 close 직전 자동
```

전환은 전용 명령 하나로 한다. 기존 `status:*` 를 떼고 새 것을 붙이는 동작이 한 번에 일어난다.

```bash
node <skill>/scripts/issue-create.mjs status 59 in-process
# 접두사는 생략 가능하다. status:in-process 라고 써도 같다.
```

네 스킬 전부 같은 `status` 서브커맨드를 갖는다 — `issue-create.mjs` / `issue-start.mjs` / `issue-end.mjs` / `issue-merge.mjs`.
가까이 있는 것을 쓰면 된다.

`--add-label` 과 `--remove-label` 을 직접 조합해 상태를 바꾸지 않는다. 두 개가 동시에 붙는 사고가 난다.

## 1. 저장소 라벨 확인

```bash
node <skill>/scripts/issue-create.mjs labels
```

출력의 `LABELS=` 목록에 있는 이름만 쓴다.

## 2. 쓸 라벨이 없을 때

작업 성격에 맞는 라벨이 하나도 없으면 AskUserQuestion 으로 묻는다.

```text
질문: 이 저장소에 `enhancement` 라벨이 없습니다. 만들까요?
- 만들고 붙이기 (권장)   → ensure-label 실행
- 라벨 없이 등록          → 이슈만 만들고 라벨은 생략
- 다른 라벨 지정          → 기존 목록에서 고름
```

승인받았을 때만 만든다.

```bash
node <skill>/scripts/issue-create.mjs ensure-label enhancement
# 색·설명 직접 지정: --color a2eeef --desc "New feature or request"
```

`ensure-label` 은 이미 있으면 아무것도 하지 않는다(`CREATED=0`).
`status:*` 라벨은 색·설명 프리셋이 내장돼 있어 따로 만들 필요가 없다 — `status` 명령이 없으면 알아서 만든다.

## 3. 새 이슈에 붙이기

`create` 에 `--label` 로 **성격 라벨**을 넘기는 것이 기본이다. `status:open` 은 등록 직후 자동으로 붙으므로 직접 넘기지 않는다.

```bash
node <skill>/scripts/issue-create.mjs create --title "..." --body-file draft.md --label bug
node <skill>/scripts/issue-create.mjs label 59 --label bug --label frontend
```

`--label status:open` 만 넘기는 것으로는 성격 라벨 게이트를 통과하지 못한다(exit 2). 게이트는 성격 라벨만 센다.

## 4. 기존 이슈 점검

```bash
node <skill>/scripts/issue-create.mjs unlabeled --state open
# 닫힌 것까지: --state all   / 더 많이: --limit 100
```

출력은 두 축을 나눠서 준다.

```text
성격 라벨 없음:
  #41 주문 목록이 가끔 비어서 렌더링됨
     https://github.com/o/r/issues/41

진행 상태 라벨 없음:
  #41 주문 목록이 가끔 비어서 렌더링됨
  #38 대시보드 필터

SCANNED=12
UNLABELED=3
UNLABELED_NUMBERS=41 37 22
NO_STATUS=5
NO_STATUS_NUMBERS=41 38 37 22 19
```

`UNLABELED` 는 **성격 라벨이 없는** 건수다. `status:*` 만 붙어 있어도 여기 잡힌다.

### 성격 라벨 보정 절차

1. `UNLABELED_NUMBERS` 의 각 이슈를 `gh issue view <번호>` 로 **실제로 읽는다**. 제목만으로 단정하지 않는다.
2. 이슈당 라벨 하나를 고른다. 애매하면 `enhancement` 대신 라벨 없이 남기고 이유를 적는다.
3. 제안 목록을 한 번에 보여주고 AskUserQuestion 으로 승인받는다.

```text
#41  주문 목록이 가끔 비어서 렌더링됨      → bug
#37  대시보드에 기간 필터 추가             → enhancement
#22  README 설치 절차 갱신                → documentation

질문: 위 3건에 라벨을 붙일까요?
- 전부 적용 (권장)
- 일부만 적용   → 번호를 받아 그것만
- 적용 안 함
```

4. 승인된 것만 붙인다.

```bash
node <skill>/scripts/issue-create.mjs label 41 --label bug
node <skill>/scripts/issue-create.mjs label 37 --label enhancement
```

### 진행 상태 보정 절차

`NO_STATUS_NUMBERS` 는 상태를 **추측하지 말고** 실제 상황으로 판정한다. 판정 근거는 이슈가 아니라 PR·브랜치다.

```text
열린 PR 이 있다              → status:review
브랜치·워크트리만 있다        → status:in-process
아무것도 없다                → status:open
이미 닫힌 이슈다             → status:close
```

이것도 승인 후에만 적용한다. 한 번에 하나씩.

```bash
node <skill>/scripts/issue-create.mjs status 41 open
```

## 규칙

- 성격 라벨이 이미 있는 이슈는 **건드리지 않는다**. 성격 라벨 점검의 대상은 그 축이 비어 있는 이슈뿐이다.
- 성격 라벨은 제거하지 않는다. 추가만 한다.
- **`status:*` 는 예외 — 항상 교체한다.** 상호배타이므로 새로 붙일 때 기존 것을 반드시 뗀다. `status` 명령이 이 동작을 한 번에 처리한다.
- 한 이슈에 성격 라벨 두 개 이상을 붙이지 않는다. 영역 라벨(`frontend` 등)이 저장소 컨벤션이면 예외.
- 20건을 넘으면 전부 훑지 말고 최근 것부터 처리한 뒤, 남은 건수를 보고한다.
- 실패한 건은 `FAILED_ISSUE=` 로 남으니 그 번호를 모아 마지막에 보고한다.
- 상태 전환 실패는 흐름을 막지 않는다(`STATUS_FAILED=1`). 라벨은 메타데이터이지 게이트가 아니다. 다만 실패는 반드시 보고한다.
