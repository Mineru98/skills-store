#!/usr/bin/env bash
set -eu

SOURCE_ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/scripts" \
  "$TMP/.claude/skills/issue-create" \
  "$TMP/.codex/skills/issue-create"
cp "$SOURCE_ROOT/scripts/check-shared.sh" "$TMP/scripts/check-shared.sh"

printf '#!/usr/bin/env bash\nexit 0\n' > "$TMP/scripts/sync-shared.sh"
printf 'process.exit(0);\n' > "$TMP/scripts/build-phase-capability-bundle.mjs"
chmod +x "$TMP/scripts/sync-shared.sh" "$TMP/scripts/build-phase-capability-bundle.mjs"

printf '호출: `/issue-create`, `/issue-create`\n' > "$TMP/.claude/skills/issue-create/SKILL.md"
printf '호출: `$issue-create`\n' > "$TMP/.codex/skills/issue-create/SKILL.md"

set +e
sh "$TMP/scripts/check-shared.sh" > "$TMP/normalized.out" 2>&1
NORMALIZED_CODE=$?
set -e

if [ "$NORMALIZED_CODE" -ne 0 ]; then
  cat "$TMP/normalized.out"
  echo 'FAIL  runtime-specific issue 호출 표기는 허용해야 한다'
  exit 1
fi
echo 'ok    runtime-specific issue 호출 표기는 허용한다'

printf '의도하지 않은 차이\n' >> "$TMP/.codex/skills/issue-create/SKILL.md"
set +e
sh "$TMP/scripts/check-shared.sh" > "$TMP/drift.out" 2>&1
DRIFT_CODE=$?
set -e

if [ "$DRIFT_CODE" -eq 0 ]; then
  cat "$TMP/drift.out"
  echo 'FAIL  호출 표기 이외의 drift 는 막아야 한다'
  exit 1
fi
echo 'ok    호출 표기 이외의 drift 는 막는다'
