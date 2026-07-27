## 작업 요약

현재 프로세스의 TTY에 OSC 제목 시퀀스를 기록하는 공통 함수를 추가했습니다.
`issue-start fetch`는 `#<번호>`, 승인 뒤 `issue-merge plan-dir`은 `merge #1 #2 ...`를 설정합니다.
VS Code 밖, 비 TTY, 쓰기 실패에서는 워크플로를 중단하지 않고 생략합니다.

## 변경 전후 증거

이 변경은 TTY 제어 시퀀스이며 재현 가능한 웹 화면이 없어 webp 캡처와 바운딩 박스 대신 자동 테스트 출력을 남겼습니다.

- [변경 전 — 기능 부재와 기존 테스트](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/36/evidence/before/terminal-title.txt)
- [변경 후 — 호출부와 전체 검증 결과](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/36/evidence/after/terminal-title.txt)

## 변경 파일

- `tools/issue-common.mjs` — 현재 VS Code TTY만 명명하는 실패 안전 공통 함수
- `.claude/skills/issue-start`, `.codex/skills/issue-start` — 이슈 번호 확정 뒤 `#<번호>` 적용
- `.claude/skills/issue-merge`, `.codex/skills/issue-merge` — 승인 목록 확정 뒤 merge 제목 적용
- `scripts/test-common.mjs` — VS Code·비 VS Code·비 TTY·tmux·다른 스트림·실패 조건 검증

## 검증

- `node scripts/test-common.mjs` 통과
- `sh scripts/test-flow.sh` 통과
- `sh scripts/test-preflight.sh` 통과
- `sh scripts/check-shared.sh` 통과
- `git diff --check` 통과

## 남은 이슈

- 없음
