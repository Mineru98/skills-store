## 작업 요약

Codex issue 스킬의 사용자 노출 호출·위임·다음 작업 안내를 `$issue-*` 형식으로 통일했습니다.
`issue-create`와 `issue-todo`의 `NEXT=` 출력도 `$issue-start`로 변경했습니다.
Claude Code의 `/issue-*` 안내와 실행 경로·URL·정규식은 유지했습니다.

## 변경 전후

이 이슈는 문서와 CLI 안내 출력만 바꾸는 `neither` 작업입니다. 화면/API 동작이 없어 webp 캡처와 성능 측정은 생략했습니다.

- 변경 전 텍스트 기준: `.issue/65/evidence/before/state.md`
- 변경 후 텍스트 기준: `.issue/65/evidence/after/state.md`

## 검증

- `git diff --check`: 통과
- `node --check` 대상 스크립트 2개: 통과
- `sh scripts/test-issue-create.sh`: 통과
- Codex 사용자 노출 `/issue-*` 잔여 표기: 0건
- `.claude/skills` 변경: 0개

참고로 전체 `scripts/test-phase-compatibility.mjs`는 기존 `.claude/skills/issue-end/scripts/issue-common.mjs` 폐쇄 해시 불일치로 실패했습니다. 이번 변경 파일과 무관한 기존 저장소 상태입니다.

## 변경 파일

- `.codex/skills/issue-{create,start,end,merge,todo}/` — Codex 호출·위임·다음 작업 안내 통일
- `.codex/skills/issue-create/scripts/issue-create.mjs` — `NEXT=$issue-start`
- `.codex/skills/issue-todo/scripts/issue-todo.mjs` — `NEXT=$issue-start`
- `README.md` — Codex 예시와 다음 작업 안내 통일, Claude 예시 보존

관련 이슈: #65
