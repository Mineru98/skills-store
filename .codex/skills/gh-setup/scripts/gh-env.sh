#!/bin/sh
# gh-env.sh — POSIX 진입점.
#
# node 나 python3 이 있으면 그 구현으로 라우팅하고, 둘 다 없으면
# 이 파일 안의 폴백으로 감지(detect)와 안내(status/plan/login)까지 처리한다.
# install / config set 은 폴백에서 지원하지 않는다.
#
# 사용: sh gh-env.sh <detect|status|plan|install|login|config> [args...]

set -u

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SETTINGS_DIR="$HOME/.issue"
SETTINGS_PATH="$SETTINGS_DIR/settings.json"
# 구 경로. 새 경로가 없을 때만 읽어서 1회 옮긴다. gh-env.mjs 와 같은 규칙이다.
LEGACY_SETTINGS_PATH="$HOME/.issue-plugin/settings.json"

have() { command -v "$1" >/dev/null 2>&1; }

# ------------------------------------------------------------------ 라우팅
if have node; then
  exec node "$DIR/gh-env.mjs" "$@"
elif have python3; then
  exec python3 "$DIR/gh_env.py" "$@"
elif have python; then
  exec python "$DIR/gh_env.py" "$@"
fi

# ------------------------------------------------------------------ 폴백
MODE=${1:-detect}

detect_os() {
  case "$(uname -s 2>/dev/null)" in
    Darwin) echo macos ;;
    Linux)
      if [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; then
        echo wsl
      else
        echo linux
      fi
      ;;
    MINGW* | MSYS* | CYGWIN*) echo windows ;;
    *) echo unknown ;;
  esac
}

detect_family() {
  os=$1
  [ "$os" = macos ] && { echo macos; return; }
  [ "$os" = windows ] && { echo windows; return; }
  [ -r /etc/os-release ] || { echo unknown; return; }
  ids=$(. /etc/os-release 2>/dev/null; echo "${ID:-} ${ID_LIKE:-}")
  case "$ids" in
    *debian* | *ubuntu* | *mint* | *pop* | *raspbian*) echo debian ;;
    *fedora* | *rhel* | *centos* | *rocky* | *alma*) echo fedora ;;
    *arch* | *manjaro*) echo arch ;;
    *alpine*) echo alpine ;;
    *suse*) echo opensuse ;;
    *) echo unknown ;;
  esac
}

detect_terminal() {
  if [ -n "${SHELL:-}" ]; then
    basename "$SHELL"
  elif [ -n "${BASH_VERSION:-}" ]; then
    echo bash
  elif [ -n "${ZSH_VERSION:-}" ]; then
    echo zsh
  else
    echo sh
  fi
}

detect_downloader() {
  if have curl; then echo curl
  elif have wget; then echo wget
  else echo none
  fi
}

detect_arch() {
  case "$(uname -m 2>/dev/null)" in
    arm64 | aarch64) echo arm64 ;;
    *) echo x64 ;;
  esac
}

OS=$(detect_os)
FAMILY=$(detect_family "$OS")
TERMINAL=$(detect_terminal)
DOWNLOADER=$(detect_downloader)
ARCH=$(detect_arch)

if have gh; then
  GH_INSTALLED=1
  GH_VERSION=$(gh --version 2>/dev/null | head -1 | awk '{print $3}')
  if gh auth status >/dev/null 2>&1; then GH_AUTHENTICATED=1; else GH_AUTHENTICATED=0; fi
else
  GH_INSTALLED=0
  GH_VERSION=""
  GH_AUTHENTICATED=0
fi

migrate_settings() {
  if [ ! -f "$SETTINGS_PATH" ] && [ -f "$LEGACY_SETTINGS_PATH" ]; then
    mkdir -p "$SETTINGS_DIR"
    cp "$LEGACY_SETTINGS_PATH" "$SETTINGS_PATH"
    echo "! 설정을 $LEGACY_SETTINGS_PATH 에서 $SETTINGS_PATH 로 옮겼다. 구 파일은 그대로 둔다." >&2
  fi
}

write_settings() {
  migrate_settings
  mkdir -p "$SETTINGS_DIR"
  # 다운로더가 하나도 없으면 빈 배열로 둔다. "none" 을 선호값으로 남기지 않는다.
  if [ "$DOWNLOADER" = none ]; then DL_JSON='[]'; else DL_JSON="[\"$DOWNLOADER\"]"; fi
  cat > "$SETTINGS_PATH" <<EOF
{
  "version": 1,
  "platform": { "os": "$OS", "distro": null, "family": "$FAMILY", "arch": "$ARCH" },
  "runtime": "sh",
  "terminals": ["$TERMINAL"],
  "downloaders": $DL_JSON,
  "packageManagers": [],
  "gh": {
    "installed": $([ "$GH_INSTALLED" = 1 ] && echo true || echo false),
    "version": $([ -n "$GH_VERSION" ] && echo "\"$GH_VERSION\"" || echo null),
    "authenticated": $([ "$GH_AUTHENTICATED" = 1 ] && echo true || echo false),
    "account": null
  }
}
EOF
  echo "! node/python 이 없어 폴백으로 기록했다. 배열 순서 편집은 파일을 직접 고쳐라: $SETTINGS_PATH"
}

print_plan() {
  dl_pipe="curl -fsSL"
  [ "$DOWNLOADER" = wget ] && dl_pipe="wget -qO-"
  echo "  대상: $FAMILY / $ARCH / 다운로더 $DOWNLOADER"
  echo ""
  case "$FAMILY" in
    macos)
      echo "  1. [auto] brew install gh"
      echo "     → brew 가 없으면: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
      ;;
    debian)
      echo "  1. [user] sudo mkdir -p -m 755 /etc/apt/keyrings"
      echo "  2. [user] $dl_pipe https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null"
      echo "  3. [user] sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg"
      echo "  4. [user] echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main\" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null"
      echo "  5. [user] sudo apt update && sudo apt install gh -y"
      ;;
    fedora) echo "  1. [user] sudo dnf install -y gh" ;;
    arch) echo "  1. [user] sudo pacman -S --needed github-cli" ;;
    alpine) echo "  1. [user] sudo apk add github-cli" ;;
    opensuse) echo "  1. [user] sudo zypper install -y gh" ;;
    windows) echo "  1. [guide] winget install --id GitHub.cli --source winget" ;;
    *)
      echo "  1. [guide] https://github.com/cli/cli/releases 에서 gh_<버전>_linux_${ARCH}.tar.gz 를 받아"
      echo "     bin/gh 를 \$HOME/.local/bin 에 복사"
      ;;
  esac
  echo ""
}

print_login() {
  if [ "$GH_AUTHENTICATED" = 1 ]; then
    echo "✓ 이미 로그인되어 있다."
  elif [ -n "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]; then
    echo "환경변수 토큰이 있다. 확인: gh auth status"
  elif [ -n "${SSH_CONNECTION:-}" ]; then
    echo "1) https://github.com/settings/tokens 에서 repo 스코프 PAT 발급"
    echo "2) ! gh auth login --hostname github.com --git-protocol https --with-token < token.txt"
  else
    echo "! gh auth login --hostname github.com --git-protocol https --web"
  fi
}

case "$MODE" in
  detect)
    echo "  OS        : $OS / $ARCH ($FAMILY)"
    echo "  터미널     : $TERMINAL"
    echo "  다운로더   : $DOWNLOADER"
    echo ""
    write_settings
    echo ""
    ;;
  status)
    echo "  gh        : $([ "$GH_INSTALLED" = 1 ] && echo "설치됨 ($GH_VERSION)" || echo 없음)"
    echo "  로그인     : $([ "$GH_AUTHENTICATED" = 1 ] && echo 됨 || echo "안 됨")"
    echo ""
    write_settings
    echo ""
    ;;
  plan) print_plan ;;
  login) print_login; echo "" ;;
  install)
    echo "폴백에서는 자동 설치를 하지 않는다. 아래 명령을 직접 실행하라."
    echo ""
    print_plan
    ;;
  config)
    echo "폴백에서는 설정 편집을 지원하지 않는다. 파일을 직접 고쳐라: $SETTINGS_PATH"
    echo ""
    ;;
  *)
    echo "✗ 알 수 없는 모드: $MODE (detect|status|plan|install|login|config)" >&2
    exit 1
    ;;
esac

echo "RUNTIME=sh"
echo "OS=$OS"
echo "FAMILY=$FAMILY"
echo "TERMINAL=$TERMINAL"
echo "DOWNLOADER=$DOWNLOADER"
echo "GH_INSTALLED=$GH_INSTALLED"
echo "GH_AUTHENTICATED=$GH_AUTHENTICATED"
echo "SETTINGS_PATH=$SETTINGS_PATH"
