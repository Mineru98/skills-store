## ✅ issue-todo 스킬 구현 완료

이슈를 독립 단위로만 다루던 파이프라인 위에 **의존 그래프(DAG) 레이어**를 얹었습니다. `.issue/graph.json` 에 노드(이슈)+타입 엣지(의존)를 저장하고 `sync/link/plan/next/validate` 를 제공합니다.

### 핵심 구성
- **데이터 모델**: `.issue/graph.json` (base 브랜치 커밋 — `!.issue/graph.json` 예외 + `IGNORE_BLOCK` 반영). 엣지는 한 방향만 저장 — `from --depends-on--> to`.
- **sync**: 트래커를 정본으로 노드 갱신 + 본문 `depends on #N` 자동 엣지 감지. 손으로 건 엣지는 보존.
- **link/unlink**: 근거(provenance) 붙인 엣지. 순서 엣지가 순환을 만들면 거부.
- **plan(todo)**: 위상정렬 + ready-frontier + 우선순위로 착수가능/막힘/진행중/완료 분류.
- **next**: ready 첫 이슈 추천. **validate**: 사이클/dangling/close 불일치 점검.

### 검증 (dogfooding — 이 저장소 실제 이슈)

`sync` 가 #61·#62 본문의 `depends-on #60` 을 자동 엣지로 감지하고, `plan` 이 둘을 `#60` 대기로 정확히 BLOCKED 분류했습니다.

```
## ▶ 착수 가능 (ready) — 1개
  - #3 feat(codex): 누락된 스킬 UI 메타데이터 추가
## ⏳ 진행 중 (in-progress) — 3개
  - #57 ... (review) / #59 ... (in-process) / #60 ... (in-process)
## ⛔ 막힘 (blocked) — 2개
  - #61 feat(issue-viz): ...  ← 대기: #60
  - #62 feat(issue-pipeline): ...  ← 대기: #60
## ✔ 완료 (done) — 27개
```

- **validate(정상)**: `VALID=1`
- **link 순환 거부**: `60 → 61 → 60` 감지, 추가 거부 (exit 2)
- **validate(인위 사이클)**: 순환 경로 탐지 (exit 2)
- **sync-shared 드리프트**: 정본과 모든 사본 동일

### 증거
- `before`: [state.txt](../evidence/before/state.txt) — 스킬 부재 상태
- `after`: [1-sync](../evidence/after/1-sync.txt) / [2-plan](../evidence/after/2-plan.txt) / [3-next](../evidence/after/3-next.txt) / [4-validate](../evidence/after/4-validate.txt)

### 범위 밖 (후속)
- 그래프 시각화 → #61 (issue-viz, depends-on #60)
- 기존 4스킬 DAG 배선 → #62 (depends-on #60)

관련 이슈: #60
