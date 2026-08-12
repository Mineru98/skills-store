---
name: issue-graph-sync
description: issue-create, issue-start, issue-end, issue-merge에서 이슈 진행 상태가 성공적으로 전환된 직후 issue-todo V2 그래프 캐시를 동기화합니다. `$issue-graph-sync #82 open`, "이슈 그래프 상태 동기화", "그래프에 진행 상태 반영" 요청과 issue-* 워크플로의 open·plan·in-process·review·close 전이 뒤에 사용합니다.
---

# Issue Graph Sync

`issue-todo` V2에서 GitHub 이슈는 정본이고 `.issue/graph.json`은 재생성 가능한 캐시다.
이 스킬은 상태 라벨을 직접 바꾸거나 그래프 파일을 부분 수정하지 않는다. 성공한 상태 전이를
GitHub에서 다시 읽어 캐시를 갱신한다.

## 입력

```text
$issue-graph-sync <이슈 번호> <open|plan|in-process|review|close>
```

첫 번째 인자는 `#82`, `82`, 이슈 URL을 받는다. 두 번째 인자는 방금 성공한 진행 상태다.
상태 전환 자체가 실패했거나 `--no-status`로 생략됐으면 호출하지 않는다.

## 절차

1. `<repo>/.issue/graph.json`이 있는지 확인한다. 없으면 `GRAPH_SYNC=skipped`와
   `REASON=graph-absent`를 남기고 종료한다. 그래프 기능을 새로 켜거나 파일을 만들지 않는다.
2. 존재하면 현재 저장소의 `issue-todo` 스킬을 찾아 아래를 실행한다.

   ```bash
   node <issue-todo>/scripts/issue-todo.mjs sync --state all
   ```

3. 결과가 완전한 스냅샷인지 확인한다. 성공하면 `GRAPH_SYNC=ok`, 이슈 번호, 상태,
   그래프 경로를 보고한다.
4. `issue-todo`를 찾지 못했거나 sync가 실패·partial이면 경고와 사유만 남기고
   `GRAPH_SYNC=skipped` 또는 `GRAPH_SYNC=failed`로 종료한다. 원래 issue-* 단계는 되돌리거나 막지 않는다.

## 호출 계약

호출자는 트래커 상태 전환이 성공한 뒤에만 이 스킬을 호출한다.

```text
issue-create  등록 직후                 → open
issue-start   이슈 수집 직후             → plan
issue-start   워크트리 생성 직후         → in-process
issue-end     PR 생성 직후               → review
issue-merge   통합 검증 후 이슈 close 직후 → close
```

여러 이슈를 처리할 때는 성공한 이슈마다 한 번씩 호출한다. 한 번의 sync 실패가 다음 이슈나
원래 워크플로를 막아서는 안 된다. 결과는 각 스킬의 마무리 보고에 `그래프 동기화` 항목으로 남긴다.
