#!/usr/bin/env bash
# .issue 워크스페이스의 .gitignore 패턴이 의도대로 동작하는지 실제 저장소에서 검증한다.
#
#   무시  : .issue/<n>/ 아래의 계획·이슈 캐시·첨부 이미지, .issue/worktrees/**, .issue/merge/**
#   커밋  : .issue/<n>/evidence/** 만
#
# 이 스크립트가 통과하지 않으면 issue-* 스킬의 경로 통합 작업을 시작하면 안 된다.

set -eu

BLOCK='# issue-* workspace — evidence only stays committed so issue comments render
.issue/**
!.issue/*/
!.issue/*/evidence/
!.issue/*/evidence/**
.issue/**/.auth.json
.issue/**/storage-state.json'

# 무시되어야 하는 경로
IGNORED="
.issue/59/plan.md
.issue/59/issue.json
.issue/59/issue.md
.issue/59/request.md
.issue/59/images/image-01.png
.issue/59/baseline.txt
.issue/59/evidence/.auth.json
.issue/worktrees/59-fix-login/package.json
.issue/worktrees/59-fix-login/src/index.ts
.issue/merge/16-21-53-64/plan.md
.issue/no-issue-hotfix/plan.md
"

# 커밋되어야 하는 경로
TRACKED="
.issue/59/evidence/before/home.webp
.issue/59/evidence/after/home.webp
.issue/59/evidence/comment.md
.issue/59/evidence/before/bench.txt
.issue/no-issue-hotfix/evidence/after/x.webp
"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

git -C "$TMP" init -q
git -C "$TMP" config user.email verify@example.com
git -C "$TMP" config user.name verify
printf '%s\n' "$BLOCK" > "$TMP/.gitignore"

for p in $IGNORED $TRACKED; do
  mkdir -p "$TMP/$(dirname "$p")"
  : > "$TMP/$p"
done

fail=0

# 1) check-ignore 단위 검증
for p in $IGNORED; do
  if ! git -C "$TMP" check-ignore -q "$p"; then
    echo "FAIL  무시되어야 하는데 추적 대상: $p"
    fail=1
  fi
done

for p in $TRACKED; do
  if git -C "$TMP" check-ignore -q "$p"; then
    echo "FAIL  커밋되어야 하는데 무시됨: $p"
    git -C "$TMP" check-ignore -v "$p" || true
    fail=1
  fi
done

# 2) git add -A 후 실제로 staged 되는 집합이 TRACKED 와 정확히 일치하는지
git -C "$TMP" add -A
ACTUAL=$(git -C "$TMP" diff --cached --name-only | grep '^\.issue/' | sort || true)
EXPECT=$(printf '%s\n' $TRACKED | sort)

if [ "$ACTUAL" != "$EXPECT" ]; then
  echo "FAIL  git add -A 결과가 기대와 다르다"
  echo "--- 기대 ---"
  printf '%s\n' "$EXPECT"
  echo "--- 실제 ---"
  printf '%s\n' "$ACTUAL"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo
  echo "verify-ignore: 실패"
  exit 1
fi

echo "verify-ignore: 통과 ($(printf '%s\n' $IGNORED | wc -l | tr -d ' ')개 무시, $(printf '%s\n' $TRACKED | wc -l | tr -d ' ')개 커밋)"
