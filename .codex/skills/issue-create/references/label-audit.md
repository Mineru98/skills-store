# 라벨 부착과 점검

라벨은 장식이 아니다. `issue-start` 가 라벨로 브랜치 prefix 를 정하고, `issue-end` 가 그 prefix 로 흐름을 잡는다.
라벨이 없는 이슈는 그 연결이 끊긴다. 그래서 **새로 만드는 이슈에는 반드시 붙이고, 기존 이슈도 같이 점검한다.**

## 표준 라벨과 매핑

```text
라벨            의미                    issue-start 브랜치 prefix
bug             동작이 잘못됨            fix/
enhancement     기능 추가·개선           feat/
documentation   문서                    docs/
chore           정리·설정·의존성          chore/
```

저장소에 이미 다른 컨벤션(`type: bug`, `kind/feature` 등)이 있으면 **그쪽을 따른다**. 표준 라벨을 강요하지 않는다.

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

## 3. 새 이슈에 붙이기

`create` 에 `--label` 을 넘기는 것이 기본이다. 등록 후 추가·변경이 필요하면 `label` 을 쓴다.

```bash
node <skill>/scripts/issue-create.mjs create --title "..." --body-file draft.md --label bug
node <skill>/scripts/issue-create.mjs label 59 --label bug --label frontend
```

## 4. 기존 이슈 점검

```bash
node <skill>/scripts/issue-create.mjs unlabeled --state open
# 닫힌 것까지: --state all   / 더 많이: --limit 100
```

출력 형식은 이렇다.

```text
  #41 주문 목록이 가끔 비어서 렌더링됨
     https://github.com/o/r/issues/41

SCANNED=12
UNLABELED=3
UNLABELED_NUMBERS=41 37 22
```

### 제안 절차

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

## 규칙

- 이미 라벨이 있는 이슈는 **건드리지 않는다**. 이 점검의 대상은 라벨이 0개인 이슈뿐이다.
- 라벨을 제거하지 않는다. 추가만 한다.
- 한 이슈에 두 개 이상 붙이지 않는다(성격 라벨은 하나). 영역 라벨(`frontend` 등)이 저장소 컨벤션이면 예외.
- 20건을 넘으면 전부 훑지 말고 최근 것부터 처리한 뒤, 남은 건수를 보고한다.
- 실패한 건은 `FAILED_ISSUE=` 로 남으니 그 번호를 모아 마지막에 보고한다.
