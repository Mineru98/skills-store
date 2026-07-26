#!/usr/bin/env python3
"""gh_env.py — gh(GitHub CLI) 설치·로그인 부트스트랩 (Python 구현).

gh-env.mjs 와 동일한 서브커맨드·출력 키를 제공한다.
node 가 없는 환경에서 라우터(gh-env.sh / gh-env.ps1)가 이 파일을 부른다.

  detect / status / plan / install [--dry-run] / login / config get|set

요구사항: Python 3.8+
"""
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

RUNTIME = "python"
SETTINGS_DIR = Path.home() / ".issue"
SETTINGS_PATH = SETTINGS_DIR / "settings.json"
# 구 경로. 새 경로가 없을 때만 읽어서 1회 옮긴다. gh-env.mjs 와 같은 규칙이다.
LEGACY_SETTINGS_PATH = Path.home() / ".issue-plugin" / "settings.json"
SETTINGS_VERSION = 1

TERMINAL_PROGRAMS = {
    "iTerm.app": "iterm",
    "Apple_Terminal": "apple-terminal",
    "vscode": "vscode",
    "WarpTerminal": "warp",
    "ghostty": "ghostty",
    "Hyper": "hyper",
    "tabby": "tabby",
    "alacritty": "alacritty",
    "WezTerm": "wezterm",
}

RUNTIME_PROCESS_RE = re.compile(r"^(node|deno|bun|python3?|ruby|perl|sh|claude|codex)$")


def usage(exit_code=1):
    sys.stderr.write(
        "Usage:\n"
        "  python3 gh_env.py detect [--os <o>] [--distro <d>]\n"
        "  python3 gh_env.py status\n"
        "  python3 gh_env.py plan [--os <o>] [--distro <d>] [--downloader <curl|wget>]\n"
        "  python3 gh_env.py install [--dry-run]\n"
        "  python3 gh_env.py login\n"
        "  python3 gh_env.py config get [key]\n"
        "  python3 gh_env.py config set <key> <value>\n"
    )
    sys.exit(exit_code)


def run(args, shell=False):
    try:
        res = subprocess.run(args, shell=shell, capture_output=True, text=True)
        return res.returncode, res.stdout or "", res.stderr or ""
    except OSError as err:
        return 127, "", str(err)


def has(cmd):
    return shutil.which(cmd) is not None


# ------------------------------------------------------------------ settings


def _parse_settings(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        sys.stderr.write("! 설정 파일을 읽지 못했다(JSON 오류): %s\n" % path)
        return None


def migrate_settings():
    """구 경로의 설정을 새 경로로 복사한다. 원본은 지우지 않는다."""
    if SETTINGS_PATH.exists() or not LEGACY_SETTINGS_PATH.exists():
        return False
    prev = _parse_settings(LEGACY_SETTINGS_PATH)
    if prev is None:
        return False
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(prev, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    sys.stderr.write(
        "! 설정을 %s 에서 %s 로 옮겼다. 구 파일은 그대로 둔다.\n" % (LEGACY_SETTINGS_PATH, SETTINGS_PATH)
    )
    return True


def read_settings():
    migrate_settings()
    if SETTINGS_PATH.exists():
        return _parse_settings(SETTINGS_PATH)
    if LEGACY_SETTINGS_PATH.exists():
        return _parse_settings(LEGACY_SETTINGS_PATH)
    return None


def write_settings(settings):
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    settings["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    SETTINGS_PATH.write_text(json.dumps(settings, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return settings


def merge_preference(existing, detected):
    """기존 순서를 보존하고, 감지값 중 없는 것만 뒤에 덧붙인다."""
    base = list(existing) if isinstance(existing, list) and existing else list(detected)
    for item in detected:
        if item not in base:
            base.append(item)
    return base


# -------------------------------------------------------------------- detect


def detect_os():
    if sys.platform == "win32":
        return "windows"
    if sys.platform == "darwin":
        return "macos"
    if os.environ.get("WSL_DISTRO_NAME"):
        return "wsl"
    try:
        if "microsoft" in Path("/proc/version").read_text(encoding="utf-8").lower():
            return "wsl"
    except OSError:
        pass
    return "linux"


def detect_distro():
    path = Path("/etc/os-release")
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8")
    ident = re.search(r"^ID=(.*)$", text, re.M)
    like = re.search(r"^ID_LIKE=(.*)$", text, re.M)
    if not ident:
        return None
    return {
        "id": ident.group(1).replace('"', "").strip(),
        "like": like.group(1).replace('"', "").strip() if like else "",
    }


def normalize_family(distro):
    ident = (distro or {}).get("id", "").lower()
    like = (distro or {}).get("like", "").lower()
    both = "%s %s" % (ident, like)
    if re.search(r"\b(debian|ubuntu|linuxmint|pop|elementary|raspbian)\b", both):
        return "debian"
    if re.search(r"\b(fedora|rhel|centos|rocky|almalinux)\b", both):
        return "fedora"
    if re.search(r"\b(arch|manjaro|endeavouros)\b", both):
        return "arch"
    if re.search(r"\balpine\b", both):
        return "alpine"
    if re.search(r"\b(opensuse|suse|sles)\b", both):
        return "opensuse"
    return "unknown"


def detect_terminals(os_name):
    found = []

    def push(value):
        if value and value not in found:
            found.append(value)

    if os_name == "windows":
        push("powershell" if os.environ.get("PSModulePath") else "cmd")
    else:
        shell = os.environ.get("SHELL")
        push(Path(shell).name if shell else None)

    program = os.environ.get("TERM_PROGRAM")
    if program:
        push(TERMINAL_PROGRAMS.get(program, program.lower()))
    if os.environ.get("WT_SESSION"):
        push("windows-terminal")
    if os.environ.get("TMUX"):
        push("tmux")

    if os_name != "windows":
        code, out, _ = run("ps -o comm= -p $PPID 2>/dev/null", shell=True)
        parent = out.strip().lstrip("-").split("/")[-1].lower() if code == 0 else ""
        if parent and not RUNTIME_PROCESS_RE.match(parent):
            push(parent)
    return found


def detect_downloaders():
    return [c for c in ("curl", "wget") if has(c)]


def detect_package_managers(os_name):
    if os_name == "windows":
        candidates = ("winget", "scoop", "choco")
    elif os_name == "macos":
        candidates = ("brew", "port")
    else:
        candidates = ("apt-get", "dnf", "yum", "pacman", "apk", "zypper", "brew")
    return [c for c in candidates if has(c)]


def cmd_detect(opts):
    os_name = opts.get("os") or detect_os()
    distro = {"id": opts["distro"], "like": ""} if opts.get("distro") else detect_distro()
    prev = read_settings() or {}

    # prev 를 먼저 펼쳐 이 스크립트가 모르는 키(issue-* 의 worktree/issue 등)를 보존한다.
    settings = dict(prev)
    settings.update({
        "version": SETTINGS_VERSION,
        "platform": {
            "os": os_name,
            "distro": (distro or {}).get("id"),
            "family": normalize_family(distro) if os_name in ("linux", "wsl") else os_name,
            "arch": "arm64" if platform.machine() in ("arm64", "aarch64") else "x64",
        },
        "runtime": RUNTIME,
        "terminals": merge_preference(prev.get("terminals"), detect_terminals(os_name)),
        "downloaders": merge_preference(prev.get("downloaders"), detect_downloaders()),
        "packageManagers": merge_preference(prev.get("packageManagers"), detect_package_managers(os_name)),
        "gh": prev.get("gh") or {"installed": False, "version": None, "authenticated": False, "account": None},
    })
    write_settings(settings)

    print("  OS        : %s%s / %s" % (
        settings["platform"]["os"],
        " (%s)" % distro["id"] if distro else "",
        settings["platform"]["arch"],
    ))
    print("  터미널     : %s" % (", ".join(settings["terminals"]) or "(감지 실패)"))
    print("  다운로더   : %s" % (", ".join(settings["downloaders"]) or "(없음)"))
    print("  패키지관리 : %s" % (", ".join(settings["packageManagers"]) or "(없음)"))
    print("")
    emit(settings)


# -------------------------------------------------------------------- status


def gh_state():
    code, out, _ = run(["gh", "--version"])
    if code != 0:
        return {"installed": False, "version": None, "authenticated": False, "account": None}
    version = re.search(r"gh version (\S+)", out)
    auth_code, auth_out, auth_err = run(["gh", "auth", "status"])
    text = "%s\n%s" % (auth_out, auth_err)
    account = re.search(r"account (\S+)", text)
    return {
        "installed": True,
        "version": version.group(1) if version else None,
        "authenticated": auth_code == 0,
        "account": account.group(1) if account else None,
    }


def load_or_detect():
    existing = read_settings()
    if existing:
        return existing
    cmd_detect({})
    return read_settings()


def cmd_status():
    settings = read_settings() or load_or_detect()
    settings["gh"] = gh_state()
    write_settings(settings)
    gh = settings["gh"]
    print("  gh        : %s" % ("설치됨 (%s)" % gh["version"] if gh["installed"] else "없음"))
    print("  로그인     : %s" % ("됨 (%s)" % (gh["account"] or "unknown") if gh["authenticated"] else "안 됨"))
    print("")
    emit(settings)


# ---------------------------------------------------------------------- plan


def build_plan(family, arch, downloader, managers):
    dl = "wget -qO-" if downloader == "wget" else "curl -fsSL"

    def step(cmd, sudo=False, auto=False, note=""):
        return {"run": cmd, "sudo": sudo, "auto": auto, "note": note}

    def binary_fallback():
        ext = "zip" if family == "macos" else "tar.gz"
        plat = "macOS" if family == "macos" else "linux"
        cpu = "arm64" if arch == "arm64" else "amd64"
        fetch = "wget -qO" if downloader == "wget" else "curl -fsSL -o"
        extract = "unzip -oq gh.zip" if ext == "zip" else "tar xzf gh.tar.gz"
        return [
            step(
                "GH_VER=$(%s https://api.github.com/repos/cli/cli/releases/latest"
                " | grep -m1 '\"tag_name\"' | cut -d'\"' -f4 | tr -d v) && \\\n"
                "  %s /tmp/gh.%s \"https://github.com/cli/cli/releases/download/v${GH_VER}/gh_${GH_VER}_%s_%s.%s\" && \\\n"
                "  mkdir -p \"$HOME/.local/bin\" && cd /tmp && %s && \\\n"
                "  cp gh_${GH_VER}_%s_%s/bin/gh \"$HOME/.local/bin/gh\""
                % (dl, fetch, ext, plat, cpu, ext, extract, plat, cpu),
                note="공식 릴리스 바이너리를 ~/.local/bin 에 설치. PATH 에 ~/.local/bin 이 있어야 한다",
            )
        ]

    if family == "macos":
        if "brew" in managers:
            return [step("brew install gh", auto=True)]
        return [
            step(
                '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
                sudo=True,
                note="Homebrew 설치 (관리자 비밀번호 필요). 설치 후 brew install gh",
            )
        ] + binary_fallback()

    if family == "windows":
        if "winget" in managers:
            return [step("winget install --id GitHub.cli --source winget", auto=True)]
        if "scoop" in managers:
            return [step("scoop install gh", auto=True)]
        if "choco" in managers:
            return [step("choco install gh -y", sudo=True, note="관리자 PowerShell 필요")]
        return [
            step(
                "winget install --id GitHub.cli --source winget",
                note="winget 이 없으면 https://github.com/cli/cli/releases 에서 .msi 를 받아 설치",
            )
        ]

    if family == "debian":
        return [
            step("sudo mkdir -p -m 755 /etc/apt/keyrings", sudo=True),
            step(
                "%s https://cli.github.com/packages/githubcli-archive-keyring.gpg"
                " | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null" % dl,
                sudo=True,
                note="GitHub CLI 공식 keyring 등록",
            ),
            step("sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg", sudo=True),
            step(
                'echo "deb [arch=$(dpkg --print-architecture)'
                ' signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg]'
                ' https://cli.github.com/packages stable main"'
                " | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null",
                sudo=True,
            ),
            step("sudo apt update && sudo apt install gh -y", sudo=True),
        ]

    if family == "fedora":
        tool = "yum" if ("dnf" not in managers and "yum" in managers) else "dnf"
        return [step("sudo %s install -y gh" % tool, sudo=True)]

    if family == "arch":
        return [step("sudo pacman -S --needed github-cli", sudo=True)]

    if family == "alpine":
        return [step("sudo apk add github-cli", sudo=True, note="community 저장소가 켜져 있어야 한다")]

    if family == "opensuse":
        return [step("sudo zypper install -y gh", sudo=True)]

    if "brew" in managers:
        return [step("brew install gh", auto=True)]
    return binary_fallback()


def plan_context(settings, opts):
    os_name = opts.get("os") or settings.get("platform", {}).get("os") or detect_os()
    if os_name in ("macos", "windows"):
        family = os_name
    elif opts.get("distro"):
        family = normalize_family({"id": opts["distro"], "like": ""})
    else:
        family = settings.get("platform", {}).get("family") or normalize_family(detect_distro())
    downloaders = settings.get("downloaders") or ["curl"]
    return {
        "family": family,
        "arch": settings.get("platform", {}).get("arch", "x64"),
        "downloader": opts.get("downloader") or downloaders[0],
        "managers": settings.get("packageManagers") or [],
    }


def cmd_plan(opts):
    settings = load_or_detect()
    ctx = plan_context(settings, opts)
    steps = build_plan(ctx["family"], ctx["arch"], ctx["downloader"], ctx["managers"])

    print("  대상: %s / %s / 다운로더 %s" % (ctx["family"], ctx["arch"], ctx["downloader"]))
    print("")
    for i, s in enumerate(steps, 1):
        kind = "auto" if s["auto"] else ("user" if s["sudo"] else "guide")
        print("  %d. [%s] %s" % (i, kind, s["run"]))
        if s["note"]:
            print("     → %s" % s["note"])
    print("")
    print("PLAN_STEPS=%d" % len(steps))
    print("AUTO_STEPS=%d" % len([s for s in steps if s["auto"]]))
    print("NEEDS_SUDO=%d" % (1 if any(s["sudo"] for s in steps) else 0))
    emit(settings, {"OS": ctx["family"], "DOWNLOADER": ctx["downloader"]})


# ------------------------------------------------------------------- install


def cmd_install(opts):
    settings = load_or_detect()
    current = gh_state()
    if current["installed"]:
        print("✓ gh 가 이미 설치되어 있다 (%s)" % current["version"])
        settings["gh"] = current
        write_settings(settings)
        emit(settings)
        return

    ctx = plan_context(settings, opts)
    steps = build_plan(ctx["family"], ctx["arch"], ctx["downloader"], ctx["managers"])
    auto = [s for s in steps if s["auto"]]
    manual = [s for s in steps if not s["auto"]]

    if not auto:
        print("자동으로 실행할 수 있는 명령이 없다. 아래를 직접 실행하라.")
        for s in manual:
            print("  %s%s" % ("! " if s["sudo"] else "", s["run"]))
        print("")
        print("INSTALLED=0")
        print("NEEDS_USER_ACTION=%d" % len(manual))
        emit(settings, {"OS": ctx["family"]})
        return

    for s in auto:
        print("$ %s" % s["run"])
        if opts.get("dry_run"):
            continue
        if subprocess.run(s["run"], shell=True).returncode != 0:
            sys.stderr.write("✗ 실패: %s\n" % s["run"])
            break

    if opts.get("dry_run"):
        print("\n(dry-run) 아무것도 실행하지 않았다.")
        for s in manual:
            print("  남은 수동 단계: %s%s" % ("! " if s["sudo"] else "", s["run"]))
        emit(settings, {"OS": ctx["family"]})
        return

    settings["gh"] = gh_state()
    write_settings(settings)
    print("")
    print("INSTALLED=%d" % (1 if settings["gh"]["installed"] else 0))
    if not settings["gh"]["installed"]:
        for s in manual:
            print("  남은 단계: %s%s" % ("! " if s["sudo"] else "", s["run"]))
    emit(settings, {"OS": ctx["family"]})


# --------------------------------------------------------------------- login


def cmd_login():
    settings = load_or_detect()
    settings["gh"] = gh_state()
    write_settings(settings)

    if not settings["gh"]["installed"]:
        print("gh 가 없다. 먼저 install 을 끝내라.")
        emit(settings)
        return
    if settings["gh"]["authenticated"]:
        print("✓ 이미 로그인되어 있다 (%s)" % (settings["gh"]["account"] or "unknown"))
        emit(settings)
        return

    has_token = bool(os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN"))
    headless = bool(os.environ.get("SSH_CONNECTION")) or (sys.platform.startswith("linux") and not os.environ.get("DISPLAY"))

    print("로그인이 필요하다. 아래 명령을 터미널에서 직접 실행하라 (대화형이라 대신 실행할 수 없다).")
    print("")
    if has_token:
        print("  환경변수 토큰이 이미 있다. 다음으로 확인만 하면 된다.")
        print("  gh auth status")
    elif headless:
        print("  1) https://github.com/settings/tokens 에서 repo 스코프 PAT 발급")
        print("  2) ! gh auth login --hostname github.com --git-protocol https --with-token < token.txt")
    else:
        print("  ! gh auth login --hostname github.com --git-protocol https --web")
    print("")
    print("  완료 후 확인: gh auth status")
    print("")
    print("LOGIN_REQUIRED=1")
    emit(settings)


# -------------------------------------------------------------------- config

LIST_KEYS = ("terminals", "downloaders", "packageManagers")


def cmd_config(action, key, value):
    settings = load_or_detect()
    if action == "get":
        if not key:
            print(json.dumps(settings, indent=2, ensure_ascii=False))
        else:
            found = settings
            for part in key.split("."):
                found = found.get(part) if isinstance(found, dict) else None
            print(",".join(found) if isinstance(found, list) else json.dumps(found))
        print("")
        emit(settings)
        return

    if action != "set" or not key or value is None:
        usage()
    if key not in LIST_KEYS:
        sys.stderr.write("✗ 배열 설정만 바꿀 수 있다: %s\n" % ", ".join(LIST_KEYS))
        sys.exit(1)

    settings[key] = [v.strip() for v in value.split(",") if v.strip()]
    write_settings(settings)
    print("✓ %s = %s" % (key, ", ".join(settings[key])))
    print("")
    emit(settings)


# ---------------------------------------------------------------------- emit


def emit(settings, extra=None):
    gh = settings.get("gh") or {}
    out = {
        "RUNTIME": RUNTIME,
        "OS": settings.get("platform", {}).get("os", "unknown"),
        "FAMILY": settings.get("platform", {}).get("family", "unknown"),
        "TERMINAL": (settings.get("terminals") or [""])[0],
        "DOWNLOADER": (settings.get("downloaders") or [""])[0],
        "GH_INSTALLED": 1 if gh.get("installed") else 0,
        "GH_AUTHENTICATED": 1 if gh.get("authenticated") else 0,
        "SETTINGS_PATH": str(SETTINGS_PATH),
    }
    out.update(extra or {})
    for key, value in out.items():
        print("%s=%s" % (key, value))


# ---------------------------------------------------------------------- main


def main():
    argv = sys.argv[1:]
    if not argv or "-h" in argv or "--help" in argv:
        usage(0 if argv else 1)

    mode = argv[0]
    opts = {"dry_run": False}
    positional = []
    i = 1
    while i < len(argv):
        arg = argv[i]
        if arg == "--dry-run":
            opts["dry_run"] = True
        elif arg == "--os":
            i += 1
            opts["os"] = argv[i]
        elif arg == "--distro":
            i += 1
            opts["distro"] = argv[i]
        elif arg == "--downloader":
            i += 1
            opts["downloader"] = argv[i]
        elif arg.startswith("--"):
            sys.stderr.write("✗ 알 수 없는 옵션: %s\n" % arg)
            usage()
        else:
            positional.append(arg)
        i += 1

    if mode == "detect":
        cmd_detect(opts)
    elif mode == "status":
        cmd_status()
    elif mode == "plan":
        cmd_plan(opts)
    elif mode == "install":
        cmd_install(opts)
    elif mode == "login":
        cmd_login()
    elif mode == "config":
        cmd_config(
            positional[0] if positional else None,
            positional[1] if len(positional) > 1 else None,
            positional[2] if len(positional) > 2 else None,
        )
    else:
        sys.stderr.write("✗ 알 수 없는 모드: %s\n" % mode)
        usage()


if __name__ == "__main__":
    main()
