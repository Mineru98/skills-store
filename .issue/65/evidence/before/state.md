# #65 변경 전 상태

이 문서는 워크트리를 만든 직후, 대상 파일을 수정하기 전에 기록했다.

- 작업 성격: `neither` — 문서와 스크립트 출력 문구만 변경하며 화면/API 동작은 없다.
- Codex issue 스킬 영역에서 `/issue-*` 표기가 발견된 파일 수: 36
- 같은 영역에서 `$issue-*` 표기가 발견된 파일 수: 6
- README의 issue 관련 `/issue-*` 표기 수: 9
- Codex 스크립트 출력:
  - `.codex/skills/issue-create/scripts/issue-create.mjs:390` — `NEXT=/issue-start #${number}`
  - `.codex/skills/issue-todo/scripts/issue-todo.mjs:357` — `NEXT=/issue-start #${n}`

주요 잔여 표기는 `.codex/skills/issue-{create,start,end,merge,todo}/`의 SKILL.md·references와 README의 issue-start/issue-end 다음 작업 안내에 있었다. Claude용 `.claude/skills`는 이번 이슈의 변경 대상이 아니다.
