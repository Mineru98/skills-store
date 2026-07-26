## 작업 요약

`issue-merge`의 질문 텍스트를 런타임 공통 정본으로 만들었습니다.
Claude는 같은 라벨·순서의 `AskUserQuestion` UI를 이어 호출하고, Codex는
동일한 번호 목록 텍스트만 출력해 답을 받도록 했습니다.

## 증거

화면 변경이 아닌 스킬 문서 변경이라 스크린샷은 만들지 않았습니다.
대신 전후 텍스트 감사를 남겼습니다.

- 전: `질문:` 14건, 공백 정렬 질문 8건, 권장안 불릿 14건, `ask.md` 0개
- 후: `질문:` 0건, 공백 정렬 질문 0건, 정본 `ask.md` 2개(런타임별 미러), 번호 권장안 18건

## 변경 파일

- `.claude/skills/issue-merge/references/ask.md`
- `.codex/skills/issue-merge/references/ask.md`
- 양쪽 `SKILL.md` 및 질문이 있는 reference 4개 — 정본 참조와 번호 질문 형식으로 통일

## 검증

- `sh scripts/check-shared.sh` 통과
- `sh scripts/test-flow.sh` 통과
- `git diff --check origin/main...HEAD` 통과
