## 작업 요약

같은 프로젝트를 여러 tmux 세션(워크트리 포함)에서 동시에 굴릴 때, 각 세션이 어디까지 진행됐는지 병렬로 수집·요약해 고정 양식으로 보고하고, 승인 후에만 각 세션에 지시를 전파하는 `tmux-orchestrate` 스킬을 추가했습니다.

## 변경 전후

UI 화면이 없는 CLI 스크립트 + 스킬 문서 추가라 스크린샷 비교가 성립하지 않습니다. 텍스트 기반 상태와 실행 로그로 대체합니다. 전문은 `.issue/52/evidence/before/state.md`, `.issue/52/evidence/after/state.md` 참고.

- 변경 전: `tmux-orchestrate` 스킬·스크립트가 없어 세션마다 직접 attach 해서 확인해야 했습니다.
- 변경 후: `scripts/tmux-capture.mjs`(list/capture), `scripts/tmux-send.mjs`(send/broadcast) 두 독립 스크립트와 이를 쓰는 `tmux-orchestrate` 스킬이 `.claude/skills`, `.codex/skills` 양쪽에 미러됩니다.

## 변경 파일

- `.claude/skills/tmux-orchestrate/SKILL.md`, `.codex/skills/tmux-orchestrate/SKILL.md` — 워크플로우·상태 판정 규칙(WAIT/WORK/DONE/ERROR/IDLE/UNKNOWN)·보고 양식 정의
- `.claude/skills/tmux-orchestrate/scripts/tmux-capture.mjs`, `.codex` 미러 — pane 목록·tail 캡처, git common-dir 기준 프로젝트 판별
- `.claude/skills/tmux-orchestrate/scripts/tmux-send.mjs`, `.codex` 미러 — 단일/전체 전송, `send-keys -l` + 지연 Enter
- `README.md` — 사용 순서 11번, "18. tmux-orchestrate" 절, Codex/Claude 자산 목록 추가
- `scripts/check-shared.sh` — 미러 검사 대상에 `tmux-orchestrate` 추가

## 검증

- 실제 tmux 세션(`issue52-evtest`)으로 `list`/`send`/`capture` 재현: repo 스코프 필터, 메시지 전송·수신, 세션 종료 후 count 0 복귀 모두 확인
- `node --check` 양쪽 스크립트 구문 통과
- `sh scripts/check-shared.sh` 통과 (`.claude` ↔ `.codex` 미러 동일)

## 남은 이슈

- 없음
