## 작업 요약

Gist 「프롬프트 for bash」만 반영한 Claude Code slash command `/setup-bash-cli-alias` 를 `.claude/commands/setup-bash-cli-alias.md` 에 추가했다.
명령 실행 시 프로젝트 파일은 건드리지 않고 `~/.zshrc` 에 `cc`/`cx`(tmux·resume·worktree) 블록을 넣도록 지시한다.
PowerShell 절은 포함하지 않았다.

## 변경 전후

문서·설정 이슈라 스크린샷 대신 파일 목록 증거를 남겼다.

### before

`.claude/commands/` 에 `audit.md`, `commit.md`, `kill-process.md` 만 존재. `setup-bash-cli-alias.md` 없음.

원본: `.issue/27/evidence/before/commands-listing.txt`

### after

`setup-bash-cli-alias.md` 추가 (약 12KB). 키워드 `cc()`, `cx()`, `--tmux`, `--worktree`, `--resume`, `~/.zshrc` 확인. PowerShell 프로필 코드 없음.

원본: `.issue/27/evidence/after/commands-listing.txt`

## 변경 파일

- `.claude/commands/setup-bash-cli-alias.md` — bash/zsh CLI alias 셋업 slash command (신규)

## 검증

- 파일 존재: OK
- frontmatter `description` / `allowed-tools` / `argument-hint`: OK
- Gist bash 핵심 키워드: 전부 OK
- PowerShell 본문 부재: OK
- 구현 커밋에 신규 1파일만 포함

## 남은 이슈

없음. `/setup-bash-cli-alias` 를 실행하면 실제 `~/.zshrc` 에 반영된다 (이 이슈 범위는 command 파일 추가까지).
