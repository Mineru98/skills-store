## 작업 요약

Codex issue 스킬의 사용자 노출 호출·위임·다음 작업 안내를 `$issue-*` 형식으로 통일했습니다.
`issue-create`와 `issue-todo`의 `NEXT=` 출력도 `$issue-start`로 변경했습니다.
Claude Code의 `/issue-*` 안내와 실행 경로·URL·정규식은 유지했습니다.

통합 검토에서 Codex·Claude 호출 표기의 의도적 차이가 `check-shared.sh`를 실패시키는 것을 발견했습니다. guard는 `$issue-*`와 `/issue-*`만 같은 호출로 정규화해 비교하도록 보완했습니다. 다른 내용 차이는 여전히 drift로 실패합니다.

## 변경 전후

이 이슈는 문서와 CLI 안내 출력만 바꾸는 `neither` 작업입니다. 화면/API 동작이 없어 webp 캡처와 성능 측정은 생략했습니다.

- 변경 전 텍스트 기준: `.issue/65/evidence/before/state.md`
- 변경 후 텍스트 기준: `.issue/65/evidence/after/state.md`

## 검증

- `git diff --check`: 통과
- `node --check` 대상 스크립트 2개: 통과
- `sh scripts/test-issue-create.sh`: 통과
- Codex 사용자 노출 `/issue-*` 잔여 표기: 0건
- `sh scripts/test-check-shared.sh`: 통과 — 호출 표기만 다른 경우 통과, 임의 차이는 실패
- `sh scripts/check-shared.sh`: 통과
- `TMPDIR=/private/tmp node --test scripts/test-phase-compatibility.mjs`: 9/9 통과

## 변경 파일

- `.codex/skills/issue-{create,start,end,merge,todo}/` — Codex 호출·위임·다음 작업 안내 통일
- `.codex/skills/issue-create/scripts/issue-create.mjs` — `NEXT=$issue-start`
- `.codex/skills/issue-todo/scripts/issue-todo.mjs` — `NEXT=$issue-start`
- `README.md` — Codex 예시와 다음 작업 안내 통일, Claude 예시 보존
- `scripts/check-shared.sh` — 런타임별 issue 호출 표기만 정규화해 비교
- `scripts/test-check-shared.sh` — 정규화 허용 범위를 고정하는 회귀 테스트

관련 이슈: #65
