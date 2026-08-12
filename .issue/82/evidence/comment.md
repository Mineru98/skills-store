## 작업 요약

`issue-graph-sync` 공통 스킬을 추가했습니다.
각 issue 워크플로가 성공한 상태 전이 뒤에 V2 그래프 캐시를 동기화하도록 연결했습니다.
그래프를 쓰지 않는 저장소에서는 새 파일을 만들지 않고 경고만 남긴 채 기존 흐름을 계속합니다.

## 변경 파일

- `.codex/skills/issue-graph-sync/SKILL.md` — 동기화 계약과 비차단 실패 처리
- `.codex/skills/issue-create/SKILL.md` — `open` 단계 호출
- `.codex/skills/issue-start/SKILL.md` — `plan`, `in-process` 단계 호출
- `.codex/skills/issue-end/SKILL.md` — `review` 단계 호출
- `.codex/skills/issue-merge/SKILL.md` — `close` 단계 호출
- `.codex/skills/issue-end/scripts/issue-end.mjs` — 문서에 있던 `sync-base` CLI 경로 복원

## 검증

- `python3 /Users/mineru/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/issue-graph-sync` 통과
- 네 issue-* 스킬에서 `$issue-graph-sync` 호출과 모든 상태 전이를 검색해 확인
- `node .codex/skills/issue-todo/scripts/issue-todo.mjs --help`로 `sync --state all` 경로 확인
- `node .codex/skills/issue-end/scripts/issue-end.mjs sync-base`가 기본 체크아웃 갱신 JSON을 반환하는지 확인
- `git diff --check` 통과

## 증거

문서·워크플로 변경이라 화면 캡처나 성능 측정은 해당하지 않습니다.
변경 전후 구조 검증 기록은 `.issue/82/evidence/`에 보관했습니다.

## 남은 이슈

없음
