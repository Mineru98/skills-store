# before — 워크트리 pure 상태 (HEAD fe4f59d)

- `.claude/skills/tmux-orchestrate/`, `.codex/skills/tmux-orchestrate/` 없음
- `scripts/tmux-capture.mjs`, `scripts/tmux-send.mjs` 없음
- README.md 에 tmux-orchestrate 관련 항목 없음
- `sh scripts/check-shared.sh` 대상 스킬 목록에 `tmux-orchestrate` 미포함

같은 프로젝트를 여러 tmux 세션에서 동시에 굴려도, 각 세션 상태를 한 번에 모아 보는 수단이 없다.
세션마다 직접 attach 해서 확인해야 한다.
