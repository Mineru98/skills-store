## 결과

복합 요청을 이슈 여러 건으로 나누는 동작을 넣었습니다. 브랜치 `feat/14-split-requests-into-issues` (`12d2aa8`).

**다만 이슈 본문의 전제 하나가 증거로 반박됐습니다.** 아래 "정정" 절에 그대로 적었습니다.

## 정정 — 본문의 "뭉친다" 는 재현되지 않았다

이슈 본문에 이렇게 적었습니다.

> 복합 요청이 들어오면 하나의 이슈에 억지로 뭉치거나, 앞의 하나만 등록하고 나머지를 흘린다.

변경 전 스킬로 같은 요청을 실제로 돌려 보니 **3건으로 나눴습니다.**

```
세 건 모두 "이번 스프린트" 요청이라 하나로 묶지 않고 별도 이슈로 나눴습니다.
```
— [`before/composite-request.txt`](https://github.com/Mineru98/skills-store/blob/main/.issue/14/evidence/before/composite-request.txt) 29행

즉 "나누지 못한다" 는 제 진단이 틀렸습니다. 모델은 문서에 절차가 없어도 나눌 때가 있습니다.
진짜 문제는 **나누는 방식이 매번 달라지고, 승인 단계가 없다는 것**이었습니다.

## 실제로 달라진 것

같은 픽스처(커밋 35개), 같은 요청, 같은 모델로 전후를 찍었습니다.

### 1. 승인 단계 — 없음 → 2단계

**before** 는 분할안을 건너뛰고 **초안 전문 3건을 바로** 내놓았습니다.

```
## 그래서 지금 드릴 수 있는 것 — 이슈 초안 3건
### #A `feat` · 대시보드 기간 필터 추가
**성격**: frontend + backend (both)
**배경**: 대시보드가 현재 기간 구분 없이 단일 집계만 노출한다.
**요구**: ...
**대상 파일** ...
**미결 사항 (착수 전 확정 필요)** ...
```

**after** 는 제목·요약·예상 라벨만 있는 분할안을 먼저 제시하고 멈췄습니다.

```
## 분할안 (독립성 테스트 통과 — 3건)
| # | 제목 | 요약 | 예상 라벨 | 성격 |
...
위 3건 분할안이 맞는지 알려주시고 ... 초안 전문을 작성해 승인받고 등록하겠습니다
```

초안 N개를 한 번에 던지면 검토를 포기하게 됩니다. 그래서 분할안 → 초안 두 번 받습니다.

### 2. 분할 근거 — 임의 기준 → 독립성 테스트 4항목

- **before**: `세 건 모두 "이번 스프린트" 요청이라` — 스프린트가 같다는 건 나눌 근거가 아닙니다. 오히려 묶을 이유에 가깝습니다.
- **after**: `셋 다 따로 머지 가능하고, 완료 기준이 겹치지 않고, 하나가 취소돼도 나머지가 성립하고, 라벨 성격이 갈립니다 → 이슈 3개로 분리가 맞습니다`

네 항목을 **모두** 만족할 때만 쪼갭니다. 하나라도 아니면 단일 이슈 + 완료 기준 체크리스트로 갑니다.
억지 분할이 뭉친 이슈보다 나쁘기 때문입니다.

### 3. 라벨 — 없는 라벨 사용 → 표준 라벨

before 는 `frontend`, `backend` 라벨을 붙였습니다. 픽스처 저장소에 없는 라벨입니다.
"저장소에 실제로 있는 라벨만 붙인다" 는 기존 규칙을 어긴 것으로, 등록 시 실패했을 값입니다.
after 는 `enhancement` / `bug` / `chore` 만 씁니다.

### 4. 회귀 테스트 — 0 → 16

`issue-create` 는 회귀 테스트 커버가 **전혀 없었습니다.**

```
## issue-create.mjs 를 부르는 테스트가 있는가
없음 — issue-create 는 회귀 테스트 커버가 0 이다
```

`scripts/test-issue-create.sh` 를 새로 넣어 `gh` 를 부르지 않는 경로 16개를 검증합니다.
게이트 판정(스캐폴딩 SKIP / 성숙 저장소 비SKIP), 라벨 누락 시 exit 2, 다중 `--dry-run` 호출이
서로 다른 명령을 내는지, dry-run 이 `.issue/` 와 `.gitignore` 를 건드리지 않는지.

## 완료 기준 대조

- [x] 독립성 테스트·상한·2단계 승인 레퍼런스가 있고 `<routing>` 이 항상 읽는다 — `references/split-requests.md`
- [x] 실행 순서에 요청 분해 단계, 중복 검사·성격 판정이 항목별로 돈다 — 8단계로 재배치
- [x] mermaid 흐름도가 분할 → 항목별 반복 → N회 등록을 반영하고 문법이 유효하다 — 검증기 통과
- [x] 보고 포맷이 단건·복수 건 두 가지, 복수 건에 건너뜀·실패 줄이 있다
- [x] 복합 요청 시 분할안이 먼저, 승인 전에는 초안도 등록도 없다 — after 캡처로 확인
- [x] `issue-create` 회귀 테스트가 있고 통과한다 — 16개
- [x] `test-flow.sh` / `check-shared.sh` 무회귀 — 통과
- [x] `.claude` / `.codex` 미러 동일 — `check-shared` 통과

## 증거

| 파일 | 내용 |
| --- | --- |
| [`before/composite-request.txt`](https://github.com/Mineru98/skills-store/blob/main/.issue/14/evidence/before/composite-request.txt) | 변경 전 스킬의 복합 요청 처리 전문 |
| [`after/composite-request.txt`](https://github.com/Mineru98/skills-store/blob/main/.issue/14/evidence/after/composite-request.txt) | 변경 후, 동일 요청·동일 픽스처 |
| [`before/test-coverage.txt`](https://github.com/Mineru98/skills-store/blob/main/.issue/14/evidence/before/test-coverage.txt) | `issue-create` 테스트 커버 0 확인 |
| [`after/test-coverage.txt`](https://github.com/Mineru98/skills-store/blob/main/.issue/14/evidence/after/test-coverage.txt) | 신규 16개 + 기존 테스트 무회귀 |

캡처 조건 — 픽스처 저장소(커밋 35개, 소스 15개, `package.json` 보유)에
`issue-start` / `issue-end` / `issue-merge` / `gh-setup` 을 함께 설치한 상태.
전후 모두 `gh` 실행 승인이 없는 비대화형 환경이라 실제 등록 직전까지만 진행됩니다.

## 한계

- **전후 각 1회 실행입니다.** 모델 출력에는 분산이 있어, 이 캡처가 매번 재현된다고 보장하지 못합니다.
  특히 before 가 "3건으로 나눈 것" 자체가 실행마다 달라질 수 있는 부분입니다.
- 실제 GitHub 저장소에 이슈를 여러 건 등록하는 end-to-end 경로는 돌리지 않았습니다.
  진짜 이슈가 생성되기 때문입니다. 스크립트 수준(연속 `--dry-run` 3회)까지만 검증했습니다.
- 픽스처의 소스 파일이 전부 빈 스텁이라, 두 실행 모두 코드베이스 대조 없이 초안을 잡았습니다.
