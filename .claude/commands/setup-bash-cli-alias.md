---
description: Gist bash 절 기준으로 ~/.zshrc 에 cc/cx/grok CLI alias(tmux·resume·worktree)를 셋업
allowed-tools: Read, Edit, Write, Bash(test:*), Bash(ls:*), Bash(grep:*), Bash(wc:*), Bash(head:*), Bash(tail:*), Bash(source:*), Bash(zsh:*), Bash(which:*), Bash(command:*), Bash(date:*), Bash(cat:*), Bash(cp:*)
argument-hint: [선택 힌트 — 예: dry-run]
---

# 목적

[Gist cli-alias-등록.md 의 「프롬프트 for bash」](https://gist.github.com/Mineru98/0be1b95c6585d069ad35446adb212c96#%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8-for-bash) 내용만 사용해 `~/.zshrc` 에 Claude Code / Codex / Grok CLI alias 를 넣는다.

PowerShell 프로필 설정은 **절대 하지 않는다.**

# 하드 제약

- **현재 프로젝트(저장소) 파일은 수정하지 않는다.**
- 대상은 사용자 홈의 `~/.zshrc` 뿐이다. (zsh 전용 문법)
- 기존 `.zshrc` 의 무관한 설정은 유지한다. 관련 블록만 추가하거나 교체한다.
- `~/.bashrc` / `~/.bash_profile` / PowerShell 프로필에 쓰지 않는다.
- `claude`, `codex`, `grok`, `tmux`, `jq`, `zsh` 가 이미 설치되어 있다고 가정한다. 없으면 설치를 강제하지 말고 누락만 보고한다.

사용자 힌트: $ARGUMENTS

# 실행 순서

질문하지 말고 바로 수행한다. dry-run 힌트가 있으면 실제 쓰기 전에 변경 요약만 보여 준다.

## 1. 전제 확인

```bash
echo "SHELL=$SHELL"
command -v zsh; command -v claude; command -v codex; command -v grok; command -v tmux; command -v jq
test -f "$HOME/.zshrc" && echo "zshrc=exists" || echo "zshrc=missing"
```

## 2. 기존 블록 탐지

`~/.zshrc` 에 아래 마커가 있으면 **그 구간만 교체**한다. 없으면 파일 끝에 추가한다.

```text
# >>> skills-store bash cli alias (cc/cx) >>>
# <<< skills-store bash cli alias (cc/cx) <<<

# >>> skills-store bash cli alias (grok) >>>
# <<< skills-store bash cli alias (grok) <<<
```

cc/cx 와 grok 은 **서로 분리된 독립 블록**으로 탐지·교체한다. 한쪽을 갱신할 때 다른 블록의 커스터마이즈를 덮지 않는다.

동등한 기존 `cc()` / `cx()` / `grok()` 함수 정의가 마커 없이 있으면, 충돌 여부를 보고한 뒤 해당 마커 블록으로 통합한다. 사용자 다른 함수는 건드리지 않는다.
`gk` 는 oh-my-zsh git 플러그인이 쓰는 alias 일 수 있으므로 grok 래퍼로 만들거나 수정하지 않는다.

## 3. 넣을 내용

아래 블록 전체를 마커 사이에 넣는다. 함수 본문은 Gist bash 절과 동일하다.

````zsh
# >>> skills-store bash cli alias (cc/cx) >>>
cc() {
  local -a claude_default_args=(--effort medium --dangerously-skip-permissions)

  if [[ "$1" == "--tmux" ]]; then
    shift
    local claude_bin="${commands[claude]}"

    if [[ "$1" == "--resume" ]]; then
      local resume_id="$2"
      local resume_session_name="cc-resume-${resume_id[1,8]:-picker}-$(date +%H%M%S)-$RANDOM"

      if [[ -n "$TMUX" ]]; then
        tmux new-session -d -s "$resume_session_name" -c "$PWD" -- \
          "$claude_bin" "${claude_default_args[@]}" "$@" || return
        tmux set-option -t "$resume_session_name" detach-on-destroy off
        tmux switch-client -t "$resume_session_name"
        while tmux has-session -t "$resume_session_name" 2>/dev/null; do
          sleep 0.1
        done
      else
        tmux new-session -s "$resume_session_name" -c "$PWD" -- \
          "$claude_bin" "${claude_default_args[@]}" "$@"
      fi

      if [[ -n "$resume_id" ]]; then
        printf '\nClaude session ID: %s\n' "$resume_id"
        printf 'Resume: cc --resume %s\n' "$resume_id"
        printf 'Resume with claude: claude --resume %s\n' "$resume_id"
        printf 'Resume in tmux: cc --tmux --resume %s\n' "$resume_id"
        printf 'Resume in tmux with claude: claude --tmux --resume %s\n' "$resume_id"
      fi
      return
    fi

    local use_worktree=false
    if [[ "$1" == "--worktree" ]]; then
      use_worktree=true
      shift
    fi

    local session_name="cc-$(date +%Y%m%d-%H%M%S)-$RANDOM"
    local start_dir="$PWD"
    local repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
    local session_project="$start_dir"
    local -a claude_args=("$@")

    if [[ "$use_worktree" == true ]]; then
      session_project="$repo_root/.claude/worktrees/$session_name"
      claude_args=(--worktree "$session_name" "$@")
    fi

    local history_file="$HOME/.claude/history.jsonl"
    local history_start_size=0
    if [[ -f "$history_file" ]]; then
      history_start_size="$(wc -c < "$history_file" | tr -d ' ')"
    fi

    if [[ -n "$TMUX" ]]; then
      tmux new-session -d -s "$session_name" -c "$start_dir" -- \
        "$claude_bin" "${claude_default_args[@]}" "${claude_args[@]}" || return
      tmux set-option -t "$session_name" detach-on-destroy off
      tmux switch-client -t "$session_name"
      while tmux has-session -t "$session_name" 2>/dev/null; do
        sleep 0.1
      done
    else
      tmux new-session -s "$session_name" -c "$start_dir" -- \
        "$claude_bin" "${claude_default_args[@]}" "${claude_args[@]}"
    fi

    local session_id=""
    local transcript_file=""
    local attempt

    if [[ -f "$history_file" ]]; then
      for attempt in {1..20}; do
        session_id="$(tail -c +$((history_start_size + 1)) "$history_file" | \
          jq -r --arg project "$session_project" \
          'select(.project == $project and .sessionId) | .sessionId' \
          2>/dev/null | tail -n 1)"
        [[ -n "$session_id" && "$session_id" != "null" ]] && break
        sleep 0.1
      done
    fi

    if [[ -n "$session_id" && "$session_id" != "null" ]]; then
      transcript_file="$(find "$HOME/.claude/projects" -type f \
        -name "$session_id.jsonl" -print -quit 2>/dev/null)"
    fi

    if [[ -n "$transcript_file" ]]; then
      local session_log="$HOME/.claude/cc-tmux-sessions.log"
      printf '%s\t%s\t%s\t%s\n' \
        "$(date '+%Y-%m-%dT%H:%M:%S%z')" \
        "$session_id" "$session_name" "$session_project" >> "$session_log"

      printf '\nClaude session ID: %s\n' "$session_id"
      printf 'Resume: cc --resume %s\n' "$session_id"
      printf 'Resume with claude: claude --resume %s\n' "$session_id"
      printf 'Resume in tmux: cc --tmux --resume %s\n' "$session_id"
      printf 'Resume in tmux with claude: claude --tmux --resume %s\n' "$session_id"
      printf 'Log: %s\n' "$session_log"
    elif [[ -n "$session_id" && "$session_id" != "null" ]]; then
      printf '\nNo resumable conversation was created.\n'
    fi
    return
  fi

  VISUAL=code EDITOR=code command claude "${claude_default_args[@]}" "$@"
}
claude() { cc "$@"; }

cx() {
  local -a codex_default_args=(--disable apps)
  local arg
  local has_bypass=false

  for arg in "$@"; do
    if [[ "$arg" == "--dangerously-bypass-approvals-and-sandbox" ]]; then
      has_bypass=true
      break
    fi
  done

  if [[ "$has_bypass" == false ]]; then
    codex_default_args=(--dangerously-bypass-approvals-and-sandbox "${codex_default_args[@]}")
  fi

  if [[ "$1" == "--resume" ]]; then
    shift
    VISUAL=vi EDITOR=vi command codex resume "${codex_default_args[@]}" "$@"
    return
  fi

  if [[ "$1" == "--tmux" ]]; then
    shift
    local codex_bin="${commands[codex]}"
    local start_dir="$PWD"
    local zsh_bin="${commands[zsh]:-zsh}"
    local -a tmux_settle_wrapper=(
      "$zsh_bin" -fc '
        VISUAL=vi EDITOR=vi "$@"
        exit_status=$?
        sleep 3
        exit "$exit_status"
      ' cx-tmux-settle
    )

    if [[ "$1" == "--resume" ]]; then
      shift
      local resume_id="$1"
      local resume_session_name="cx-resume-${resume_id[1,8]:-picker}-$(date +%H%M%S)-$RANDOM"

      if [[ -n "$TMUX" ]]; then
        tmux new-session -d -s "$resume_session_name" -c "$start_dir" -- \
          "${tmux_settle_wrapper[@]}" \
          "$codex_bin" resume \
          "${codex_default_args[@]}" "$@" || return
        tmux set-option -t "$resume_session_name" detach-on-destroy off
        tmux switch-client -t "$resume_session_name"
        while tmux has-session -t "$resume_session_name" 2>/dev/null; do
          sleep 0.1
        done
      else
        tmux new-session -s "$resume_session_name" -c "$start_dir" -- \
          "${tmux_settle_wrapper[@]}" \
          "$codex_bin" resume \
          "${codex_default_args[@]}" "$@"
      fi

      if [[ -n "$resume_id" ]]; then
        printf '\nCodex session ID: %s\n' "$resume_id"
        printf 'Resume: cx --resume %s\n' "$resume_id"
        printf 'Resume in tmux: cx --tmux --resume %s\n' "$resume_id"
        printf 'Resume with codex: codex resume %s\n' "$resume_id"
        printf 'Resume in tmux with codex: codex --tmux --resume %s\n' "$resume_id"
      fi
      return
    fi

    local session_name="cx-$(date +%Y%m%d-%H%M%S)-$RANDOM"
    local -A known_rollouts
    local rollout_file

    for rollout_file in "$HOME"/.codex/sessions/**/*.jsonl(N); do
      known_rollouts[$rollout_file]=1
    done

    if [[ -n "$TMUX" ]]; then
      tmux new-session -d -s "$session_name" -c "$start_dir" -- \
        "${tmux_settle_wrapper[@]}" \
        "$codex_bin" \
        "${codex_default_args[@]}" "$@" || return
      tmux set-option -t "$session_name" detach-on-destroy off
      tmux switch-client -t "$session_name"
      while tmux has-session -t "$session_name" 2>/dev/null; do
        sleep 0.1
      done
    else
      tmux new-session -s "$session_name" -c "$start_dir" -- \
        "${tmux_settle_wrapper[@]}" \
        "$codex_bin" \
        "${codex_default_args[@]}" "$@"
    fi

    local session_id=""
    local rollout_cwd=""

    for rollout_file in "$HOME"/.codex/sessions/**/*.jsonl(N); do
      [[ -n "${known_rollouts[$rollout_file]}" ]] && continue
      rollout_cwd="$(head -n 1 "$rollout_file" | jq -r \
        'select(.type == "session_meta") | .payload.cwd // empty' 2>/dev/null)"
      [[ "$rollout_cwd" != "$start_dir" ]] && continue
      session_id="$(head -n 1 "$rollout_file" | jq -r \
        'select(.type == "session_meta") | .payload.id // empty' 2>/dev/null)"
    done

    if [[ -n "$session_id" ]]; then
      local session_log="$HOME/.codex/cx-tmux-sessions.log"
      printf '%s\t%s\t%s\t%s\n' \
        "$(date '+%Y-%m-%dT%H:%M:%S%z')" \
        "$session_id" "$session_name" "$start_dir" >> "$session_log"

      printf '\nCodex session ID: %s\n' "$session_id"
      printf 'Resume: cx --resume %s\n' "$session_id"
      printf 'Resume in tmux: cx --tmux --resume %s\n' "$session_id"
      printf 'Resume with codex: codex resume %s\n' "$session_id"
      printf 'Resume in tmux with codex: codex --tmux --resume %s\n' "$session_id"
      printf 'Log: %s\n' "$session_log"
    fi
    return
  fi

  VISUAL=vi EDITOR=vi command codex "${codex_default_args[@]}" "$@"
}
codex() { cx "$@"; }
# <<< skills-store bash cli alias (cc/cx) <<<
````

grok 은 cc/cx 와 별도 마커 블록으로 관리한다. 아래 블록 전체를 그대로 넣는다.
`gk` 래퍼는 만들지 않는다. zsh 는 함수 정의 시점에 alias 를 확장하므로, oh-my-zsh 의
`gk='gitk --all --branches &!'` 와 충돌하면 함수 본문이 깨질 수 있다.

````zsh
# >>> skills-store bash cli alias (grok) >>>
grok() {
  local -a grok_default_args=(--always-approve)

  if [[ "$1" == "--tmux" ]]; then
    shift
    local grok_bin="${commands[grok]}"
    local start_dir="$PWD"

    if [[ "$1" == "--resume" || "$1" == "-r" ]]; then
      shift
      local resume_id="$1"
      local resume_session_name="grok-resume-${resume_id[1,8]:-picker}-$(date +%H%M%S)-$RANDOM"

      if [[ -n "$TMUX" ]]; then
        tmux new-session -d -s "$resume_session_name" -c "$start_dir" -- \
          "$grok_bin" "${grok_default_args[@]}" --resume "$@" || return
        tmux set-option -t "$resume_session_name" detach-on-destroy off
        tmux switch-client -t "$resume_session_name"
        while tmux has-session -t "$resume_session_name" 2>/dev/null; do
          sleep 0.1
        done
      else
        tmux new-session -s "$resume_session_name" -c "$start_dir" -- \
          "$grok_bin" "${grok_default_args[@]}" --resume "$@"
      fi

      if [[ -n "$resume_id" ]]; then
        printf '\nGrok session ID: %s\n' "$resume_id"
        printf 'Resume: grok --resume %s\n' "$resume_id"
        printf 'Resume with grok: grok --resume %s\n' "$resume_id"
        printf 'Resume in tmux: grok --tmux --resume %s\n' "$resume_id"
        printf 'Resume in tmux with grok: grok --tmux --resume %s\n' "$resume_id"
      fi
      return
    fi

    local use_worktree=false
    if [[ "$1" == "--worktree" || "$1" == "-w" ]]; then
      use_worktree=true
      shift
    fi

    local session_name="grok-$(date +%Y%m%d-%H%M%S)-$RANDOM"
    local -a grok_args=("$@")
    if [[ "$use_worktree" == true ]]; then
      grok_args=(--worktree "$session_name" "$@")
    fi

    # 세션 디렉토리는 ~/.grok/sessions/<percent-encoded-cwd>/<uuid>/ 형태다.
    # 실행 전 스냅샷을 떠 두고, 종료 후 새로 생긴 디렉토리 이름에서 session id 를 얻는다.
    local -A known_sessions
    local session_dir
    for session_dir in "$HOME"/.grok/sessions/*/*(N/); do
      known_sessions[$session_dir]=1
    done

    if [[ -n "$TMUX" ]]; then
      tmux new-session -d -s "$session_name" -c "$start_dir" -- \
        "$grok_bin" "${grok_default_args[@]}" "${grok_args[@]}" || return
      tmux set-option -t "$session_name" detach-on-destroy off
      tmux switch-client -t "$session_name"
      while tmux has-session -t "$session_name" 2>/dev/null; do
        sleep 0.1
      done
    else
      tmux new-session -s "$session_name" -c "$start_dir" -- \
        "$grok_bin" "${grok_default_args[@]}" "${grok_args[@]}"
    fi

    local session_id=""
    local enc_dir="${start_dir//\//%2F}"
    local candidate
    # 현재 cwd 로 인코딩된 디렉토리를 먼저 보고, 없으면(worktree 등) 전체에서 최신 것을 찾는다.
    for candidate in \
      "$HOME"/.grok/sessions/"$enc_dir"/*(N/om) \
      "$HOME"/.grok/sessions/*/*(N/om); do
      [[ -n "${known_sessions[$candidate]}" ]] && continue
      session_id="${candidate:t}"
      break
    done

    if [[ -n "$session_id" ]]; then
      local session_log="$HOME/.grok/grok-tmux-sessions.log"
      printf '%s\t%s\t%s\t%s\n' \
        "$(date '+%Y-%m-%dT%H:%M:%S%z')" \
        "$session_id" "$session_name" "$start_dir" >> "$session_log"

      printf '\nGrok session ID: %s\n' "$session_id"
      printf 'Resume: grok --resume %s\n' "$session_id"
      printf 'Resume with grok: grok --resume %s\n' "$session_id"
      printf 'Resume in tmux: grok --tmux --resume %s\n' "$session_id"
      printf 'Resume in tmux with grok: grok --tmux --resume %s\n' "$session_id"
      printf 'Log: %s\n' "$session_log"
    else
      printf '\nNo resumable Grok session was found.\n'
    fi
    return
  fi

  VISUAL=code EDITOR=code command grok "${grok_default_args[@]}" "$@"
}
# <<< skills-store bash cli alias (grok) <<<
````

## 4. 쓰기

1. `~/.zshrc` 가 없으면 생성한다.
2. 마커 구간 교체 또는 파일 끝 추가를 수행한다.
3. 쓰기 전 백업: `~/.zshrc.bak.$(date +%Y%m%d-%H%M%S)` (파일이 이미 있을 때만).

## 5. 검증

새 셸에서 문법이 깨지지 않는지 확인한다.

```bash
zsh -n "$HOME/.zshrc"
zsh -ic 'type cc; type cx; type claude; type codex; type grok; type gk' 2>/dev/null | head -30
```

가능하면 짧은 smoke (실제 TUI 는 강제하지 않음):

```bash
# 함수가 --tmux 를 가로채는지 (바이너리에 --tmux 를 넘기지 않아야 함)
zsh -ic 'functions cc | head -5'
zsh -ic 'functions cx | head -5'
zsh -ic 'functions grok | head -8'
```

`type grok` 은 shell function 이어야 한다. `type gk` 가 기존 alias 를 가리키면 그대로 유지된 것이며,
`grok()` 함수는 `gk` 를 호출하지 않아야 한다.

다음 오류 패턴이 사용자 환경에서 나면 실패로 보고한다.

```text
error: unexpected argument '--tmux' found
Error: --tmux requires --worktree
```

## 6. 보고

- 변경한 경로: `~/.zshrc`
- 백업 경로
- 추가/교체 여부
- 검증 결과
- 프로젝트 파일을 건드리지 않았음을 한 줄로 명시

# 참고 동작 요약 (구현 시 빠뜨리지 말 것)

## cc / claude

- 기본 args: `--effort medium --dangerously-skip-permissions`
- 비-tmux: `VISUAL=code EDITOR=code command claude ...`
- `--tmux`: 새 tmux 세션에서 claude 실행. 이미 tmux 안이면 detach-on-destroy off + switch-client + 세션 종료 대기
- `--tmux --resume [id]`: resume 세션명 `cc-resume-...`, 종료 후 resume 안내 출력
- `--tmux --worktree`: git root 필요, claude 에 `--worktree <session_name>` 전달, project 경로는 `.claude/worktrees/<session>`
- 세션 종료 후 `~/.claude/history.jsonl` 증분 + jq 로 sessionId 추출, transcript 있으면 `~/.claude/cc-tmux-sessions.log` 기록 및 resume 안내
- `claude()` 는 `cc "$@"` 위임

## cx / codex

- 기본: `--disable apps` + (없을 때) `--dangerously-bypass-approvals-and-sandbox`
- `--resume`: `codex resume` + `VISUAL=vi EDITOR=vi`
- `--tmux`: zsh settle wrapper(3초 sleep)로 실행 후 rollout jsonl 로 session id 탐지, `~/.codex/cx-tmux-sessions.log` 기록
- `--tmux --resume`: resume 경로 + 안내 출력
- `codex()` 는 `cx "$@"` 위임

## grok

- 코어 함수는 `grok()` 자체다. oh-my-zsh git 플러그인과 충돌하는 `gk` 래퍼는 만들지 않는다
- 기본 args: `--always-approve`. `--reasoning-effort` 는 기본값에 넣지 않는다
- 비-tmux: `VISUAL=code EDITOR=code command grok ...`
- `--tmux`: 새 tmux 세션에서 grok 실행. 이미 tmux 안이면 detach-on-destroy off + switch-client + 세션 종료 대기
- `--tmux --resume [id]` / `--tmux -r [id]`: resume 세션명 `grok-resume-...`, 종료 후 resume 안내 출력
- `--tmux --worktree` / `--tmux -w`: grok 네이티브 `--worktree <session_name>` 을 그대로 전달
- 세션 종료 후 `~/.grok/sessions/<percent-encoded-cwd>/<uuid>/` 의 새 디렉터리명에서 session id 추출
- session id 를 찾으면 `~/.grok/grok-tmux-sessions.log` 기록 및 resume 안내
