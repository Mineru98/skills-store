#!/usr/bin/env bash
# 정본과 vendored 사본이 어긋났는지, .claude 와 .codex 미러가 어긋났는지 검사한다.
# CI 나 커밋 전에 돌린다.

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
fail=0

sh "$ROOT/scripts/sync-shared.sh" --check || fail=1

echo
for skill in issue-create issue-start issue-end issue-merge convention; do
  a="$ROOT/.claude/skills/$skill"
  b="$ROOT/.codex/skills/$skill"
  [ -d "$a" ] || continue
  if [ ! -d "$b" ]; then
    echo "MISSING  .codex/skills/$skill"
    fail=1
    continue
  fi
  # agents/ 는 런타임별 정의라 다른 것이 정상이다.
  if ! diff -r -x agents -x '.DS_Store' "$a" "$b" >/dev/null 2>&1; then
    echo "DRIFT    .claude/skills/$skill <-> .codex/skills/$skill"
    diff -r -q -x agents -x '.DS_Store' "$a" "$b" 2>&1 | sed 's/^/         /'
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo
  echo "check-shared: 실패"
  exit 1
fi
echo "check-shared: 통과"
