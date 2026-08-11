# #65 변경 후 상태

- Codex issue 스킬의 사용자 노출 `/issue-*` 호출 표기: 0건
- Codex `issue-create`·`issue-todo` 스크립트의 `NEXT=` 출력: 모두 `$issue-start`
- README의 Codex 작업 설명·다음 작업 안내: `$issue-*`
- README의 Claude Code 전용 호출 예시: `/issue-*` 유지
- `.claude/skills`의 사용자 노출 호출 표기: `/issue-*` 유지
- `git diff --check`: 통과
- 두 변경 스크립트 `node --check`: 통과
- `sh scripts/test-issue-create.sh`: 통과

경로, 실행 명령, URL, 정규식의 슬래시는 호출 표기 검색에서 제외되는 실제 경로·명령 문맥으로 유지했다.

## 후속 guard 검증

Codex와 Claude의 호출 표기가 의도적으로 다르므로, `check-shared.sh`는 `$issue-*`와 `/issue-*`를 같은 호출로 정규화해 비교하도록 보완했다. 그 밖의 내용 차이는 계속 drift로 실패한다.

- `sh scripts/test-check-shared.sh`: 통과 — 런타임별 호출 표기는 허용, 호출 표기 이외의 차이는 거부
- `sh scripts/check-shared.sh`: 통과 — vendored 사본·capability bundle·정규화된 mirror 모두 최신
- `sh scripts/test-issue-create.sh`: 통과
- `TMPDIR=/private/tmp node --test scripts/test-phase-compatibility.mjs`: 9/9 통과
