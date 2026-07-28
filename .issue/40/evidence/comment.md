## 작업 요약

`/setup-bash-cli-alias`가 cc/cx와 별도로 grok 마커 블록도 설치·교체하도록 갱신했습니다.
검증된 `grok()` 함수는 tmux, resume, 네이티브 worktree 전달과 세션 ID 로그를 지원합니다.
`gk`는 oh-my-zsh git alias와 충돌하므로 만들거나 수정하지 않습니다.

## 변경 전후

- 변경 전: 저장소 명령 문서에 grok 참조와 마커 블록이 없었습니다.
- 변경 후: 전제 확인·블록 탐지·설치 블록·검증·동작 요약에 grok이 반영됐습니다.
- cc/cx와 grok은 독립 마커 블록이라 서로의 커스터마이즈를 덮지 않습니다.

UI 변경이 아닌 명령 문서·셸 설정 변경이므로 이미지와 바운딩 박스는 생략했습니다.
전후 문서 상태와 격리된 zsh 검증 원본은 `.issue/40/evidence/`에 저장했습니다.

## 변경 파일

- `.claude/commands/setup-bash-cli-alias.md` — grok 독립 블록과 실행·검증·요약 절 추가

## 검증

- 저장소 grok 블록과 사용자 홈의 검증된 블록이 바이트 단위로 일치
- 임시 `.zshrc`에 대해 `zsh -n` 통과
- `type grok`은 shell function, 기존 `type gk`는 alias로 유지
- 비-tmux 기본 인자 `--always-approve` 전달 확인
- `grok --tmux`, `--tmux --resume`, `--tmux --worktree` 전달 인자 확인
- 새 세션 디렉터리에서 UUID 탐지 및 `~/.grok/grok-tmux-sessions.log` 기록 확인
- `--reasoning-effort` 기본 인자 미포함 확인
- `sh scripts/test-preflight.sh` 통과
- `git diff --check` 통과

## 남은 이슈

- 없음
