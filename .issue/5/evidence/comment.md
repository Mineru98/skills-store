## 작업 완료 — 진행 상태 라벨 도입

브랜치 `feat/5-status-labels` · 커밋 `8c7213c` · 32개 파일

이슈 목록만 봐서는 그 이슈가 파이프라인 어디에 있는지 알 수 없었습니다. 상호배타 진행 상태 라벨 5개를 도입하고, 각 전이점에서 자동 전환하도록 했습니다.

### 전환 지점

| 라벨 | 전환 시점 | 주체 |
| --- | --- | --- |
| `status:open` | 이슈 등록 직후 | issue-create (자동) |
| `status:plan` | 이슈 수집 직후 | issue-start (자동) |
| `status:in-process` | 워크트리 생성 직후 | issue-start (자동) |
| `status:review` | PR 생성 직후 | issue-end (수동 호출) |
| `status:close` | 이슈 close 직전 | issue-merge (자동) |

`issue-end` 만 수동인 이유는 PR 생성이 스크립트가 아니라 모델의 `gh pr create` 라서입니다. 나머지는 그 시점에 어차피 도는 스크립트 안에서 부르므로 모델이 잊어도 동작합니다.

### 시각 증거를 생략한 이유

CLI 스크립트와 문서만 바뀌어 화면이 없습니다. 대신 **같은 명령의 before/after 출력**을 증거로 남겼습니다.

<details>
<summary><strong>before — 변경 직전 (main / 6e980ca)</strong></summary>

```text
## 1. status 서브커맨드가 존재하지 않는다
$ node issue-start.mjs status 5 plan
✗ 알 수 없는 모드: status
(exit=1)

## 2. unlabeled 는 단일 축 — 성격/상태 구분이 없다
$ node issue-create.mjs unlabeled --state all --limit 20
SCANNED=3
UNLABELED=0
UNLABELED_NUMBERS=

## 3. label 에 --remove-label 이 없다
$ node issue-create.mjs label 5 --remove-label status:open
✗ 알 수 없는 옵션: --remove-label
(exit=1)
```

</details>

<details>
<summary><strong>after — 현재 커밋 (8c7213c)</strong></summary>

```text
## 1. status 서브커맨드가 4스킬 모두에 있다
$ node issue-create.mjs status 5 plan --dry-run
(dry-run) gh issue edit 5 --add-label status:plan --remove-label status:in-process
$ node issue-start.mjs status 5 plan --dry-run
(dry-run) gh issue edit 5 --add-label status:plan --remove-label status:in-process
$ node issue-end.mjs status 5 plan --dry-run
(dry-run) gh issue edit 5 --add-label status:plan --remove-label status:in-process
$ node issue-merge.mjs status 5 plan --dry-run
(dry-run) gh issue edit 5 --add-label status:plan --remove-label status:in-process

## 2. unlabeled 가 두 축으로 분리됐다
$ node issue-create.mjs unlabeled --state all --limit 20
SCANNED=3
UNLABELED=0
UNLABELED_NUMBERS=
NO_STATUS=1
NO_STATUS_NUMBERS=1

## 3. --remove-label 이 동작한다
$ node issue-create.mjs label 5 --remove-label status:open --dry-run
(dry-run) gh issue edit 5 --remove-label status:open
(exit=0)

## 4. 잘못된 상태 이름은 exit 2 로 거부한다
$ node issue-end.mjs status 5 bogus
✗ 모르는 상태: bogus
  쓸 수 있는 값: status:open, status:plan, status:in-process, status:review, status:close (접두사 생략 가능)
(exit=2)
```

</details>

1번의 dry-run 출력이 **원자적 교체**를 보여줍니다 — `--add-label` 과 `--remove-label` 이 한 번의 `gh issue edit` 에 함께 들어갑니다. status 가 두 개 붙는 중간 상태가 없습니다.

### 검증

```text
## 1. 단위 테스트 (라벨 순수함수 12건 신규 — 기존 0건)
$ node scripts/test-common.mjs
test-common: 통과

## 2. 정본-사본 드리프트 (8벌 + .claude/.codex)
$ sh scripts/check-shared.sh
check-shared: 통과

## 3. 이 이슈(#5)로 5단계 실제 왕복
  open         → enhancement, status:open
  plan         → enhancement, status:plan
  in-process   → enhancement, status:in-process
  review       → enhancement, status:review
  close        → enhancement, status:close
  (복귀)
  in-process   → enhancement, status:in-process
```

매 단계 `status:*` 가 정확히 1개이고 성격 라벨 `enhancement` 가 보존됩니다.

### 같이 고친 것

- **`unlabeled` 점검망 회귀 차단.** 기존 필터가 `labels.length === 0` 이라, status 라벨이 붙는 순간 성격 라벨 없는 이슈가 점검에서 통째로 샜습니다. 두 축으로 분리했습니다. 실제로 `enhancement` 를 뗀 이슈가 `status:open` 만 남은 상태에서 `UNLABELED_NUMBERS` 에 잡히는 것을 확인했습니다.
- **`create` 라벨 게이트 보정.** `--label status:open` 만으로는 통과하지 못합니다. 성격 라벨만 셉니다.
- **라벨 정의 이원화 해소.** `issue-create.mjs` 로컬에 있던 `STANDARD_LABELS` 와 `ensure-label` 본체를 `tools/issue-common.mjs` 정본으로 승격했습니다.
- **`label --remove-label` 추가.**

### 설계 원칙

1. **상호배타** — 전환은 항상 "기존 `status:*` 제거 + 새 것 추가"의 원자적 교체.
2. **성격 라벨과 직교** — `status:*` 는 브랜치 prefix 결정에 관여하지 않습니다. `prefixFromLabels` 가 `typeLabels` 로 먼저 거릅니다.
3. **비차단** — 전환 실패는 `STATUS_FAILED=1` 만 남기고 exit 0. 라벨은 메타데이터이지 게이트가 아닙니다.

### 알려진 제약

- 원격이 GitHub 이 아니면 자동 전환이 `gh` 를 아예 호출하지 않습니다. `test-flow.sh` 의 gh-free 경로를 유지하기 위한 조치입니다.
- 커스텀 라벨 컨벤션(`type: bug` 등)은 `LABEL_PREFIX` 가 완전일치라 prefix 추론이 `fix/` 로 떨어집니다. 기존 동작이며 이 변경과 무관합니다.

### 이 이슈 범위 밖 — 별도 처리 필요

작업 트리의 `WORKTREE_LAYOUTS` 가 `nested` → `children` 로 바뀌어 있는데 `scripts/test-flow.sh` 는 아직 `--layout nested` 를 넘깁니다. 그래서 `test-flow.sh` 가 그 지점에서 멈춥니다. 레이아웃 이름만 맞춘 사본으로 돌리면 이 변경 구간은 전부 통과합니다. 제 변경과 무관하므로 손대지 않았습니다.
