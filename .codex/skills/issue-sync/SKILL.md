---
name: issue-sync
description: GitHub 이슈를 완전 스냅샷으로 다시 읽어 `.issue/graph.json` 캐시를 생성·갱신합니다. "$issue-sync", "이슈 그래프 갱신", "그래프 만들기", issue-onboard가 그래프 없이 시작될 때 사용합니다.
---

# Issue Sync

GitHub 이슈가 정본이고 `.issue/graph.json`은 재생성 가능한 캐시다. 이 스킬은 부분 수정하지 않고
`issue-onboard sync --state all`로 전체 스냅샷을 다시 만든다.

## 실행

```bash
node <issue-sync>/scripts/issue-sync.mjs
```

현재 저장소의 `.codex/skills/issue-onboard` 또는 `.claude/skills/issue-onboard`를 찾아 실행한다.

## 성공 조건

`SNAPSHOT_STATUS=complete`와 `GRAPH_SYNC=ok`가 함께 나와야 한다. partial·실패 결과는
온보딩 추천에 사용하지 않는다.

`issue-onboard`는 graph.json이 없을 때 이 스킬을 먼저 호출한다. 상태 전이 뒤의 선택적 캐시
갱신은 `issue-graph-sync`가 담당한다.
