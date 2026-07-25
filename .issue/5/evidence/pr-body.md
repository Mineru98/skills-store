관련 이슈: #5 (통합 테스트 뒤 close)

## 변경 내용

이슈 목록만 봐서는 그 이슈가 파이프라인 어디에 있는지 알 수 없었습니다. 라벨이 성격 축(`bug`/`enhancement`/…) 하나뿐이었기 때문입니다.

상호배타 진행 상태 라벨 5개를 도입하고, 각 전이점에서 자동 전환합니다.

| 라벨 | 전환 시점 | 주체 |
| --- | --- | --- |
| `status:open` | 이슈 등록 직후 | issue-create (자동) |
| `status:plan` | 이슈 수집 직후 | issue-start (자동) |
| `status:in-process` | 워크트리 생성 직후 | issue-start (자동) |
| `status:review` | PR 생성 직후 | issue-end (수동 호출) |
| `status:close` | 이슈 close 직전 | issue-merge (자동) |

`issue-end` 만 수동인 이유는 PR 생성이 스크립트가 아니라 모델의 `gh pr create` 라서입니다. 나머지는 그 시점에 어차피 도는 스크립트 안에서 부르므로 모델이 잊어도 동작합니다.

## 설계 원칙

1. **상호배타** — 전환은 `gh issue edit` 한 번에 "기존 `status:*` 제거 + 새 것 추가"로 원자적으로 일어납니다. 두 개가 동시에 붙는 중간 상태가 없습니다.
2. **성격 라벨과 직교** — `status:*` 는 브랜치 prefix 결정에 관여하지 않습니다. `prefixFromLabels` 가 `typeLabels` 로 먼저 거릅니다.
3. **비차단** — 전환 실패는 `STATUS_FAILED=1` 만 남기고 exit 0. 라벨은 메타데이터이지 게이트가 아닙니다.

## 같이 고친 것

- **`unlabeled` 점검망 회귀 차단.** 기존 필터가 `labels.length === 0` 이라, status 라벨이 붙는 순간 성격 라벨 없는 이슈가 점검에서 통째로 샜습니다. `UNLABELED_NUMBERS`(성격 축)와 `NO_STATUS_NUMBERS`(상태 축)로 분리했습니다. **이 PR 에서 가장 주의 깊게 볼 부분입니다.**
- **`create` 라벨 게이트 보정.** 판정을 `typeLabels` 기준으로 바꿔 `--label status:open` 만으로는 통과하지 못하게 했습니다.
- **라벨 정의 이원화 해소.** `issue-create.mjs` 로컬에 있던 `STANDARD_LABELS` 와 `ensure-label` 본체를 `tools/issue-common.mjs` 정본으로 승격했습니다.
- **`label --remove-label` 추가.**

## 검증

```text
node scripts/test-common.mjs   → 통과 (라벨 순수함수 12건 신규, 기존 0건)
sh scripts/check-shared.sh     → 통과 (정본↔사본 8벌, .claude↔.codex 드리프트 0)
```

이슈 #5 로 5단계 실제 왕복을 돌려 매 단계 `status:*` 가 정확히 1개이고 성격 라벨이 보존되는 것을 확인했습니다. before/after 명령 출력과 왕복 로그는 이슈 코멘트와 `.issue/5/evidence/` 에 있습니다.

## 리뷰 포인트

- `tools/issue-common.mjs` 의 `setStatus` — 원자적 교체와 실패 시 비차단 처리
- `issue-create.mjs` 의 `cmdUnlabeled` — 두 축 분리가 기존 점검을 약화시키지 않는지
- 자동 전환 호출 지점 3곳 (`cmdFetch` / `cmdWorktree` / `cmdClose`) 의 위치가 적절한지

## 알려진 제약

- 원격이 GitHub 이 아니면 자동 전환이 `gh` 를 호출하지 않습니다. `test-flow.sh` 의 gh-free 경로 유지를 위한 조치입니다.
- 커스텀 라벨 컨벤션(`type: bug` 등)은 `LABEL_PREFIX` 가 완전일치라 prefix 추론이 `fix/` 로 떨어집니다. 기존 동작이며 이 PR 과 무관합니다.

## 전체 테스트

`scripts/test-flow.sh` 도 전체 통과합니다.
