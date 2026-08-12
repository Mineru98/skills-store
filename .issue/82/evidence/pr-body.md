관련 이슈: [#82 이슈 워크플로 그래프 상태 동기화 추가](https://github.com/Mineru98/skills-store/issues/82) (통합 테스트 뒤 close)

## 변경 내용

- `issue-graph-sync` 공통 스킬을 추가해 V2 그래프 캐시 동기화 계약을 정의했습니다.
- `issue-create`, `issue-start`, `issue-end`, `issue-merge`의 성공한 상태 전이에 호출 지점을 추가했습니다.
- 그래프가 없거나 sync가 실패해도 원래 이슈 워크플로가 계속되도록 했습니다.

## 검증

- `quick_validate.py .codex/skills/issue-graph-sync` 통과
- 상태 전이별 `$issue-graph-sync` 호출 검색 확인
- `node .codex/skills/issue-todo/scripts/issue-todo.mjs --help`로 `sync --state all` 경로 확인
- `git diff --check` 통과

## 증거

[전후 리포트 보기](https://github.com/Mineru98/skills-store/issues/82#issuecomment-5265990497)
