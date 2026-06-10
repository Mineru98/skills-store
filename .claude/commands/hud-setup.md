---
description: Claude Code HUD(statusLine) 설정 — 5시간/주간 세션 사용량 표시 (on/off 토글)
allowed-tools: Bash(sh:*), Bash(jq:*), Bash(mkdir:*), Bash(cat:*), Bash(chmod:*), Bash(test:*), Bash(ls:*), Bash(mktemp:*), Bash(mv:*)
argument-hint: "[on|off]  (생략 시 on)"
---

지금 즉시 아래 워크플로우를 실행하라. 질문하지 말고 바로 실행하라.

이 명령은 Claude Code의 statusLine(HUD)을 **활성화/비활성화**한다. 활성화 시 한 줄에 다음을 표시한다:

- 현재 디렉터리 / git 브랜치 / 모델명
- `5h:` — 5시간 세션 **남은 비율** + 리셋까지 남은 시간 (보라색)
- `7d:` — 주간(7일) 세션 **남은 비율** + 리셋까지 남은 시간 (청록색)
- `ctx:` — 컨텍스트 윈도우 남은 비율 (회색)

## 인자 해석

사용자가 넘긴 인자는 다음과 같다 (소문자로 정규화):

```
$ARGUMENTS
```

- `off` / `deactivate` / `disable` / `0` / `false` → **비활성화 모드** → 4단계만 실행하고 1~3단계는 건너뛴다.
- 그 외(`on` / `activate` / `enable` / 빈 값 등) → **활성화 모드** → 1~3단계를 실행하고 4단계는 건너뛴다.

판단이 끝나면 해당 모드의 단계만 실행하라.

---

## [활성화] 1단계: statusLine 스크립트 설치

아래 bash 블록을 그대로 실행하여 `~/.claude/statusline-ps1.sh`(또는 `$CLAUDE_CONFIG_DIR`) 를 생성한다.

```bash
CDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
mkdir -p "$CDIR"
cat > "$CDIR/statusline-ps1.sh" <<'STATUSLINE_EOF'
#!/bin/sh
# Claude Code statusLine — styled after p10k lean prompt
# Segments: dir  git-branch  model  5h-session  7d-session  context%

input=$(cat)

# --- dir (cyan/blue) ---
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // empty')
if [ -z "$cwd" ]; then
  cwd=$(pwd)
fi
# Shorten home directory to ~
home="$HOME"
short_dir="${cwd#$home}"
if [ "$short_dir" != "$cwd" ]; then
  short_dir="~$short_dir"
else
  short_dir="$cwd"
fi

# --- git branch (green) ---
git_info=""
if git_branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null); then
  git_info="$git_branch"
elif git_commit=$(git -C "$cwd" rev-parse --short HEAD 2>/dev/null); then
  git_info="@$git_commit"
fi

# --- model (from Claude Code JSON) ---
model=$(echo "$input" | jq -r '.model.display_name // empty')

# --- context remaining % ---
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# --- 5-hour session limit (Claude.ai 구독 한도; 구독자 + 첫 API 응답 후에만 존재) ---
five_used=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')

# --- 7-day (weekly) session limit (주간 한도; 구독자 + 첫 API 응답 후에만 존재) ---
week_used=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
week_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

# --- assemble output with ANSI colors ---
reset='\033[0m'
cyan='\033[38;5;31m'
green='\033[38;5;76m'
yellow='\033[38;5;178m'
grey='\033[38;5;244m'
magenta='\033[38;5;170m'
teal='\033[38;5;44m'
red='\033[38;5;196m'

out=""
out="${out}${cyan}${short_dir}${reset}"

if [ -n "$git_info" ]; then
  out="${out}  ${green}${git_info}${reset}"
fi

if [ -n "$model" ]; then
  out="${out}  ${yellow}${model}${reset}"
fi

# 5h 리밋: 남은 비율 + 리셋까지 남은 시간 (예: 5h:73% ↻1h20m)
if [ -n "$five_used" ]; then
  five_remain=$(awk -v u="$five_used" 'BEGIN{r=100-u; if(r<0)r=0; printf "%.0f", r}')
  reset_str=""
  if [ -n "$five_reset" ]; then
    now=$(date +%s)
    diff=$((five_reset - now))
    if [ "$diff" -gt 0 ]; then
      h=$((diff / 3600)); m=$(((diff % 3600) / 60))
      if [ "$h" -gt 0 ]; then reset_str=" ↻${h}h${m}m"; else reset_str=" ↻${m}m"; fi
    fi
  fi
  out="${out}  ${magenta}5h:${five_remain}%${reset_str}${reset}"
fi

# 7d(주간) 리밋: 남은 비율 + 리셋까지 남은 시간 (예: 7d:87% ↻3d4h)
if [ -n "$week_used" ]; then
  week_remain=$(awk -v u="$week_used" 'BEGIN{r=100-u; if(r<0)r=0; printf "%.0f", r}')
  wreset_str=""
  if [ -n "$week_reset" ]; then
    now=$(date +%s)
    wdiff=$((week_reset - now))
    if [ "$wdiff" -gt 0 ]; then
      d=$((wdiff / 86400)); h=$(((wdiff % 86400) / 3600)); m=$(((wdiff % 3600) / 60))
      if [ "$d" -gt 0 ]; then wreset_str=" ↻${d}d${h}h"
      elif [ "$h" -gt 0 ]; then wreset_str=" ↻${h}h${m}m"
      else wreset_str=" ↻${m}m"; fi
    fi
  fi
  out="${out}  ${teal}7d:${week_remain}%${wreset_str}${reset}"
fi

if [ -n "$remaining" ]; then
  remaining_int=$(printf '%.0f' "$remaining")
  out="${out}  ${grey}ctx:${remaining_int}%${reset}"
fi

printf "%b\n" "$out"
STATUSLINE_EOF
chmod +x "$CDIR/statusline-ps1.sh"
echo "설치 완료: $CDIR/statusline-ps1.sh"
```

## [활성화] 2단계: settings.json 에 statusLine 연결

`settings.json`의 다른 키는 유지한 채 `statusLine`만 병합한다.

```bash
CDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CDIR/settings.json"
STATUSLINE_VAL='{"type":"command","command":"sh ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/statusline-ps1.sh"}'
if [ -f "$SETTINGS" ]; then
  tmp=$(mktemp)
  jq --argjson sl "$STATUSLINE_VAL" '.statusLine = $sl' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
else
  echo "{\"statusLine\":$STATUSLINE_VAL}" | jq '.' > "$SETTINGS"
fi
echo "HUD 활성화: settings.json 갱신 완료"
```

## [활성화] 3단계: 동작 검증

캐시된 입력이 있으면 그것으로, 없으면 더미 JSON으로 출력을 확인한다.

```bash
CDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
f=$(ls -t "$CDIR"/hud/cache/stdin.*.json 2>/dev/null | head -1)
if [ -n "$f" ]; then
  cat "$f" | sh "$CDIR/statusline-ps1.sh"
else
  echo '{"cwd":"'"$HOME"'/demo","model":{"display_name":"Opus 4.8"},"context_window":{"remaining_percentage":97},"rate_limits":{"five_hour":{"used_percentage":91,"resets_at":9999999999},"seven_day":{"used_percentage":13,"resets_at":9999999999}}}' | sh "$CDIR/statusline-ps1.sh"
fi
```

---

## [비활성화] 4단계: statusLine 끄기

`settings.json`에서 `statusLine` 키만 제거한다. 스크립트 파일(`statusline-ps1.sh`)은 그대로 보존하여 나중에 `on`으로 즉시 재활성화할 수 있게 한다.

```bash
CDIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CDIR/settings.json"
if [ -f "$SETTINGS" ]; then
  tmp=$(mktemp)
  jq 'del(.statusLine)' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  echo "HUD 비활성화: settings.json 의 statusLine 제거 완료 (스크립트 파일은 보존됨)"
else
  echo "settings.json 이 없어 비활성화할 항목이 없음"
fi
```

---

## 완료 보고

실행 후 사용자에게 다음을 한국어로 요약 보고하라:

- **활성화 모드**였으면: 설치된 스크립트 경로, `settings.json` 갱신 여부, 검증 출력 한 줄(실제 색상 미리보기), 새 세션/갱신 시 반영된다는 안내, 그리고 `/hud-setup off` 로 끌 수 있다는 안내.
- **비활성화 모드**였으면: `statusLine` 제거 완료, 스크립트 파일은 보존되어 `/hud-setup on` 으로 즉시 복구 가능하다는 안내.
