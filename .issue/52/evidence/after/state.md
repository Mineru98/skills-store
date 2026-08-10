# after — 커밋 fb86b0c 기준, 실제 tmux 세션으로 재검증

## 신설 파일

- `.claude/skills/tmux-orchestrate/SKILL.md`, `.codex/skills/tmux-orchestrate/SKILL.md`
- `.claude/skills/tmux-orchestrate/scripts/{tmux-capture.mjs,tmux-send.mjs}` (`.codex` 동일 미러)
- README.md "18. tmux-orchestrate" 항목, Codex/Claude 자산 목록에 `tmux-orchestrate` 등재
- `scripts/check-shared.sh` 미러 검사 대상에 `tmux-orchestrate` 추가

## 실행 검증 (issue52-evtest 세션으로 재현)

```
$ node scripts/tmux-capture.mjs list
count: 1, session: issue52-evtest, branch: feat/52-tmux-orchestrate, dirtyFiles: 1

$ node scripts/tmux-send.mjs send --target issue52-evtest --message "echo ISSUE-52-VERIFY"
{ "sent": true, "enter": true }

$ node scripts/tmux-capture.mjs capture --target issue52-evtest --lines 4 --text
tail:
  ❯ echo ISSUE-52-VERIFY
  ISSUE-52-VERIFY
```

세션 종료 후 `list` 의 `count` 가 0으로 복귀 — repo 스코프 필터가 정상 동작.

## 정적 검증

```
$ node --check .claude/skills/tmux-orchestrate/scripts/tmux-capture.mjs   → 통과
$ node --check .claude/skills/tmux-orchestrate/scripts/tmux-send.mjs      → 통과
$ sh scripts/check-shared.sh
sync-shared: 정본과 모든 사본이 동일하다
check-shared: 통과
```

## 캡처를 생략한 이유

UI 화면이 없는 CLI 스크립트 + 스킬 문서 추가라 스크린샷·바운딩 박스 비교가 성립하지 않는다.
[#40](https://github.com/Mineru98/skills-store/issues/40) (grok tmux alias 추가) 과 같은 방식으로,
텍스트 기반 before/after 상태와 실행 로그를 증거로 남긴다.
