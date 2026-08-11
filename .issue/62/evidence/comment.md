## ✅ 파이프라인 DAG 배선 완료 (중앙 훅 MVP)

`setTrackerStatus` 는 **모든 스킬(create/start/end/merge)의 상태 전환이 지나는 단일 초크포인트**입니다. 여기에 graph.json 노드 자동 갱신 훅을 걸어, 한 곳 변경으로 파이프라인 전체에서 DAG 가 자동 유지되도록 했습니다(sync-shared 로 4스킬 전파).

### 변경
- **issue-common**: `patchGraphNode(root, node)` — `.issue/graph.json` 이 있을 때만 노드 upsert. 없으면 no-op, 어떤 예외도 삼켜 상태 전환을 **절대 막지 않음**.
- **issue-tracker**: `setTrackerStatus` 성공 직후 이미 조회한 issueView 데이터로 훅 호출(추가 API 없음).
- **issue-merge** next-actions: close 후 `issue-todo plan` 으로 새로 풀린 ready 노출 안내.
- **issue-create** handoff: 분할 시 확정 의존을 `issue-todo link` 로 기록 안내.

### 검증 (GitHub 미접촉, 스텁 tracker)
```
# 상태 전환 → graph.json 자동 갱신
before: #57 = review
after : #57 = in-process

# graph.json 없을 때 no-op 안전성
patchGraphNode 반환: false (false=no-op, throw 안 함)

# 회귀
test-common: 통과
test-tracker: 통과
# sync-shared 드리프트: 정본과 모든 사본이 동일하다
```

### 효과
이제 open→plan→in-process→review→close 어느 전환이든 graph.json 이 자동으로 따라옵니다. issue-merge 가 이슈를 close 하면 노드가 close 로 바뀌고, 그에 의존하던 이슈가 자동으로 ready 로 풀립니다 — "다음 작업 자동 연결" 루프가 파이프라인에 내장됐습니다.

### 증거
- before: [state.txt](https://github.com/Mineru98/skills-store/blob/main/.issue/62/evidence/before/state.txt)
- after: [1-hook](https://github.com/Mineru98/skills-store/blob/main/.issue/62/evidence/after/1-hook.txt) / [2-regression](https://github.com/Mineru98/skills-store/blob/main/.issue/62/evidence/after/2-regression.txt)

### 범위 (MVP)
전체 배선(4스킬 SKILL.md 명시 단계, issue-start next 통합, machine-phase 계약 반영)은 후속으로 남깁니다. 이번엔 중앙 훅으로 자동 유지를 확보했습니다.

관련 이슈: #62
