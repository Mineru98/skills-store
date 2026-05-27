#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  migrate-skill-agent.sh [--skill|--agent] <name> [--target home|project]

Options:
  --skill <name>       Install a skill only.
  --agent <name>       Install an agent only.
  --target <target>    Target scope: home or project.
  -h, --help           Show this help.

Environment for tests:
  MIGRATE_SKILLS_STORE_PATH  Override skills-store lookup.
EOF
}

TYPE=""
NAME=""
TARGET="${MIGRATE_TARGET:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skill)
      if [[ "$TYPE" == "agent" ]]; then
        echo "error: --skill and --agent cannot be used together" >&2
        exit 2
      fi
      TYPE="skill"
      shift
      [[ $# -gt 0 ]] || { echo "error: --skill requires a name" >&2; exit 2; }
      NAME="$1"
      ;;
    --agent)
      if [[ "$TYPE" == "skill" ]]; then
        echo "error: --skill and --agent cannot be used together" >&2
        exit 2
      fi
      TYPE="agent"
      shift
      [[ $# -gt 0 ]] || { echo "error: --agent requires a name" >&2; exit 2; }
      NAME="$1"
      ;;
    --target)
      if [[ -n "$TARGET" ]]; then
        echo "error: --target specified more than once" >&2
        exit 2
      fi
      shift
      [[ $# -gt 0 ]] || { echo "error: --target requires home or project" >&2; exit 2; }
      TARGET="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "$NAME" ]]; then
        echo "error: item name specified more than once" >&2
        exit 2
      fi
      NAME="$1"
      ;;
  esac
  shift
done

if [[ -z "$NAME" ]]; then
  echo "error: missing skill or agent name" >&2
  usage >&2
  exit 2
fi

if [[ ! "$NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
  echo "error: item name must start with a letter or number and may contain only letters, numbers, dot, underscore, and hyphen" >&2
  exit 2
fi

if [[ -n "$TARGET" && "$TARGET" != "home" && "$TARGET" != "project" ]]; then
  echo "error: --target must be home or project" >&2
  exit 2
fi

is_skills_store_repo() {
  local dir="$1"
  [[ -d "$dir/.git" ]] || return 1
  [[ -d "$dir/.claude/skills" || -d "$dir/.codex/skills" || -d "$dir/.claude/agents" || -d "$dir/.codex/agents" ]] || return 1

  local remote url
  while IFS= read -r remote; do
    [[ -n "$remote" ]] || continue
    while IFS= read -r url; do
      case "$url" in
      https://github.com/Mineru98/skills-store|https://github.com/Mineru98/skills-store.git|git@github.com:Mineru98/skills-store.git|ssh://git@github.com/Mineru98/skills-store.git)
        return 0
        ;;
      esac
    done < <(git -C "$dir" remote get-url --all "$remote" 2>/dev/null || true)
  done < <(git -C "$dir" remote 2>/dev/null || true)

  return 1
}

find_store() {
  local candidates=()
  if [[ -n "${MIGRATE_SKILLS_STORE_PATH:-}" ]]; then
    candidates+=("$MIGRATE_SKILLS_STORE_PATH")
  fi
  candidates+=("$PWD" "$HOME/SourceCode/skills-store" "$HOME/skills-store")

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -d "$candidate" ]] && is_skills_store_repo "$candidate"; then
      (cd "$candidate" && pwd)
      return 0
    fi
  done

  echo "error: skills-store repository not found" >&2
  exit 1
}

STORE="$(find_store)"

echo "skills-store: $STORE"
echo "running: git pull"
if ! git -C "$STORE" pull; then
  echo "error: git pull failed; no target files were copied" >&2
  exit 1
fi

declare -a SOURCE_KINDS=()
declare -a SOURCE_PATHS=()
declare -a TARGET_REL_PATHS=()
declare -a VERIFY_REL_PATHS=()

add_source() {
  SOURCE_KINDS+=("$1")
  SOURCE_PATHS+=("$2")
  TARGET_REL_PATHS+=("$3")
  VERIFY_REL_PATHS+=("$4")
}

if [[ "$TYPE" != "agent" ]]; then
  [[ -f "$STORE/.claude/skills/$NAME/SKILL.md" ]] && add_source "dir" "$STORE/.claude/skills/$NAME" ".claude/skills/$NAME" ".claude/skills/$NAME/SKILL.md"
  [[ -f "$STORE/.codex/skills/$NAME/SKILL.md" ]] && add_source "dir" "$STORE/.codex/skills/$NAME" ".codex/skills/$NAME" ".codex/skills/$NAME/SKILL.md"
fi

SKILL_MATCHES="${#SOURCE_PATHS[@]}"

if [[ "$TYPE" != "skill" ]]; then
  [[ -f "$STORE/.claude/agents/$NAME.md" ]] && add_source "file" "$STORE/.claude/agents/$NAME.md" ".claude/agents/$NAME.md" ".claude/agents/$NAME.md"
  [[ -f "$STORE/.codex/agents/$NAME.toml" ]] && add_source "file" "$STORE/.codex/agents/$NAME.toml" ".codex/agents/$NAME.toml" ".codex/agents/$NAME.toml"
fi

if [[ -z "$TYPE" && "$SKILL_MATCHES" -gt 0 && "${#SOURCE_PATHS[@]}" -gt "$SKILL_MATCHES" ]]; then
  echo "error: '$NAME' exists as both skill and agent; use --skill or --agent" >&2
  exit 1
fi

if [[ "${#SOURCE_PATHS[@]}" -eq 0 ]]; then
  echo "error: source item '$NAME' not found in skills-store" >&2
  exit 1
fi

if [[ -z "$TARGET" ]]; then
  printf "Install target? [home/project]: " >&2
  read -r TARGET
fi

if [[ "$TARGET" != "home" && "$TARGET" != "project" ]]; then
  echo "error: target must be home or project" >&2
  exit 2
fi

if [[ "$TARGET" == "home" ]]; then
  TARGET_ROOT="$HOME"
else
  TARGET_ROOT="$PWD"
fi

STORE_REAL="$(cd "$STORE" && pwd -P)"
TARGET_ROOT_REAL="$(mkdir -p "$TARGET_ROOT" && cd "$TARGET_ROOT" && pwd -P)"

if [[ "$TARGET" == "project" && "$STORE_REAL" == "$TARGET_ROOT_REAL" ]]; then
  echo "error: project target cannot be the skills-store source repository" >&2
  exit 1
fi

copy_dir() {
  local source="$1"
  local target="$2"
  local source_real target_real
  mkdir -p "$(dirname "$target")"
  source_real="$(cd "$source" && pwd -P)"
  if [[ -e "$target" ]]; then
    target_real="$(cd "$target" && pwd -P)"
    if [[ "$source_real" == "$target_real" ]]; then
      echo "error: source and target are the same path: $target" >&2
      exit 1
    fi
  fi
  rm -rf "$target"
  mkdir -p "$target"
  rsync -a --delete "$source/" "$target/"
}

copy_file() {
  local source="$1"
  local target="$2"
  local source_real target_real
  mkdir -p "$(dirname "$target")"
  source_real="$(cd "$(dirname "$source")" && pwd -P)/$(basename "$source")"
  if [[ -e "$target" ]]; then
    target_real="$(cd "$(dirname "$target")" && pwd -P)/$(basename "$target")"
    if [[ "$source_real" == "$target_real" ]]; then
      echo "error: source and target are the same path: $target" >&2
      exit 1
    fi
  fi
  cp "$source" "$target"
}

echo "target: $TARGET_ROOT"

for i in "${!SOURCE_PATHS[@]}"; do
  source_path="${SOURCE_PATHS[$i]}"
  target_path="$TARGET_ROOT/${TARGET_REL_PATHS[$i]}"
  verify_path="$TARGET_ROOT/${VERIFY_REL_PATHS[$i]}"

  if [[ "${SOURCE_KINDS[$i]}" == "dir" ]]; then
    copy_dir "$source_path" "$target_path"
  else
    copy_file "$source_path" "$target_path"
  fi

  if [[ ! -e "$verify_path" ]]; then
    echo "error: copy completed but required file is missing: $verify_path" >&2
    exit 1
  fi

  echo "installed: $source_path -> $target_path"
  echo "verified: $verify_path"
done

echo "done"
