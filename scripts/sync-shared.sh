#!/usr/bin/env bash
# tools/issue-common.mjs 정본을 각 스킬의 scripts/ 아래로 복사한다.
#
# 스킬은 폴더 단위로 독립 설치되므로 스킬 간 import 가 불가능하다.
# 그래서 정본 1벌을 두고 기계적으로 사본을 만든다. 사본은 직접 고치지 않는다.
#
#   sh scripts/sync-shared.sh           복사
#   sh scripts/sync-shared.sh --check   차이만 확인하고 복사하지 않음 (exit 1 로 드리프트 알림)

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/tools/issue-common.mjs"
CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

[ -f "$SRC" ] || { echo "정본이 없다: $SRC"; exit 1; }

SKILLS="issue-create issue-start issue-end issue-merge"
FLAVORS=".claude .codex"

BANNER='// !!! VENDORED FILE — DO NOT EDIT !!!
// canonical: tools/issue-common.mjs
// resync   : sh scripts/sync-shared.sh
'

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
printf '%s' "$BANNER" > "$TMP"
cat "$SRC" >> "$TMP"

drift=0
copied=0
for flavor in $FLAVORS; do
  for skill in $SKILLS; do
    dir="$ROOT/$flavor/skills/$skill/scripts"
    [ -d "$dir" ] || continue
    dest="$dir/issue-common.mjs"
    if [ "$CHECK" -eq 1 ]; then
      if ! cmp -s "$TMP" "$dest" 2>/dev/null; then
        echo "DRIFT  $flavor/skills/$skill/scripts/issue-common.mjs"
        drift=1
      fi
    else
      cp "$TMP" "$dest"
      copied=$((copied + 1))
    fi
  done
done

if [ "$CHECK" -eq 1 ]; then
  if [ "$drift" -ne 0 ]; then
    echo
    echo "정본과 사본이 다르다. sh scripts/sync-shared.sh 를 실행하라."
    exit 1
  fi
  echo "sync-shared: 정본과 모든 사본이 동일하다"
else
  echo "sync-shared: ${copied}개 사본 갱신"
fi
