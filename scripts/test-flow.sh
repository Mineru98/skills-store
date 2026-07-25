#!/usr/bin/env bash
# issue-start / issue-end 스크립트의 실제 git 동작을 임시 저장소에서 검증한다.
# gh 는 호출하지 않는 경로만 다룬다(fetch / context 의 gh 부분 제외).
#
#   sh scripts/test-flow.sh

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
START="$ROOT/.claude/skills/issue-start/scripts/issue-start.mjs"
END="$ROOT/.claude/skills/issue-end/scripts/issue-end.mjs"

# macOS 의 /tmp 는 /private/tmp 심볼릭 링크라 git 이 돌려주는 경로와 어긋난다.
# 실경로로 정규화해야 경로 비교가 성립한다.
TMP=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$TMP"' EXIT
export HOME="$TMP/home"
mkdir -p "$HOME"

fail=0
check() { # check <설명> <조건 결과 0/1>
  if [ "$2" -ne 0 ]; then echo "FAIL  $1"; fail=1; else echo "ok    $1"; fi
}

# --- 원격 역할을 할 bare 저장소 + 작업 저장소
git init -q --bare "$TMP/origin.git"
git init -q "$TMP/myapp"
cd "$TMP/myapp"
git config user.email t@e.com; git config user.name t
git config commit.gpgsign false
printf 'node_modules\n' > .gitignore
mkdir -p src && printf 'export const a = 1;\n' > src/index.ts
git add -A && git commit -qm "init"
git branch -M main
git remote add origin "$TMP/origin.git"
git push -q -u origin main

# --- migrate: 구 폴더를 .issue 로 이관
mkdir -p .issue-start/59/images .issue-evidence/59/before
printf '# plan\n' > .issue-start/59/plan.md
printf 'x' > .issue-evidence/59/before/home.webp
printf '.issue-start\n' >> .gitignore
node "$START" migrate > "$TMP/migrate.json"
check ".issue/59/plan.md 로 이관" "$([ -f .issue/59/plan.md ] && echo 0 || echo 1)"
check ".issue/59/evidence/before 로 이관" "$([ -f .issue/59/evidence/before/home.webp ] && echo 0 || echo 1)"
check "구 .issue-start 제거" "$([ ! -d .issue-start ] && echo 0 || echo 1)"
check "구 .issue-evidence 제거" "$([ ! -d .issue-evidence ] && echo 0 || echo 1)"
check ".gitignore 에서 구 줄 제거" "$(grep -qx '.issue-start' .gitignore && echo 1 || echo 0)"
check ".gitignore 에 블록 추가" "$(grep -q '!.issue/\*/evidence/\*\*' .gitignore && echo 0 || echo 1)"

# --- 무시 규칙이 실제로 먹는지
git add -A
STAGED=$(git diff --cached --name-only | grep '^\.issue/' || true)
check "plan.md 는 스테이징되지 않음" "$(echo "$STAGED" | grep -q 'plan.md' && echo 1 || echo 0)"
check "evidence 는 스테이징됨" "$(echo "$STAGED" | grep -q 'evidence/before/home.webp' && echo 0 || echo 1)"
git reset -q

# --- worktree: layout 미결정이면 exit 2 + 신호 출력
set +e
OUT=$(node "$START" worktree 59 --slug fix-login 2>&1); CODE=$?
set -e
check "layout 미결정 시 exit 2" "$([ "$CODE" -eq 2 ] && echo 0 || echo 1)"
check "WORKTREE_LAYOUT_UNSET 출력" "$(echo "$OUT" | grep -q 'WORKTREE_LAYOUT_UNSET=1' && echo 0 || echo 1)"

# --- sibling
node "$START" worktree 59 --slug fix-login --layout sibling --dry-run > "$TMP/wt.txt"
check "sibling 경로" "$(grep -q "WORKTREE_PATH=$TMP/myapp-issue-59\$" "$TMP/wt.txt" && echo 0 || echo 1)"
check "브랜치 이름" "$(grep -q 'BRANCH=fix/59-fix-login$' "$TMP/wt.txt" && echo 0 || echo 1)"

# --- nested: 실제 생성 후 부모가 깨끗한지
node "$START" worktree 59 --slug fix-login --layout nested > "$TMP/wt2.txt"
WT="$TMP/myapp/.issue/worktrees/59-fix-login"
check "nested 워크트리 생성" "$([ -d "$WT" ] && echo 0 || echo 1)"
check "nested 워크트리가 무시됨" "$(git check-ignore -q .issue/worktrees/59-fix-login/src/index.ts && echo 0 || echo 1)"
DIRTY=$(git status --porcelain | grep -c 'worktrees' || true)
check "부모 저장소 status 에 워크트리 미노출" "$([ "$DIRTY" -eq 0 ] && echo 0 || echo 1)"

# --- guard: 워크트리 안에서는 통과, base 에서는 실패
cd "$WT"
git config user.email t@e.com; git config user.name t; git config commit.gpgsign false
set +e
node "$START" guard > "$TMP/guard.json"; GCODE=$?
set -e
check "워크트리에서 guard 통과" "$([ "$GCODE" -eq 0 ] && echo 0 || echo 1)"
cd "$TMP/myapp"
set +e
node "$START" guard > /dev/null 2>&1; GCODE2=$?
set -e
check "base 브랜치에서 guard 차단" "$([ "$GCODE2" -eq 3 ] && echo 0 || echo 1)"

# --- 워크트리에서 구현 → 증거 → 커밋 → 미러
cd "$WT"
printf 'export const a = 2;\n' > src/index.ts
git add -A && git commit -qm "fix: 값 수정"
node "$START" evidence-init 59 > /dev/null
printf 'after' > .issue/59/evidence/after/home.webp
printf 'before' > .issue/59/evidence/before/home.webp
printf '# 리포트\n' > .issue/59/evidence/comment.md
node "$START" evidence-commit 59 > "$TMP/ec.json"
check "증거 커밋됨" "$(grep -q '"committed": true' "$TMP/ec.json" && echo 0 || echo 1)"

node "$START" evidence-mirror 59 --push > "$TMP/mirror.json"
check "미러 push 성공" "$(grep -q '"pushed": true' "$TMP/mirror.json" && echo 0 || echo 1)"
check "미러 대상이 main" "$(grep -q '"mirrorRef": "main"' "$TMP/mirror.json" && echo 0 || echo 1)"
git -C "$TMP/origin.git" show main:.issue/59/evidence/after/home.webp > /dev/null 2>&1
check "origin/main 에 증거 존재" "$?"

# --- issue-end context: 증거 완결성 판정
node "$END" context > "$TMP/ctx.json" 2>/dev/null
check "context: 워크트리 인식" "$(grep -q '"isLinkedWorktree": true' "$TMP/ctx.json" && echo 0 || echo 1)"
check "context: 이슈 추론" "$(grep -q '"issue": "59"' "$TMP/ctx.json" && echo 0 || echo 1)"
check "context: 증거 완결" "$(grep -q '"evidenceComplete": true' "$TMP/ctx.json" && echo 0 || echo 1)"
check "context: evidenceDir 경로" "$(grep -q '"evidenceDir": ".issue/59/evidence"' "$TMP/ctx.json" && echo 0 || echo 1)"

# --- pure-tree: 변경 직전 상태
node "$END" pure-tree --issue 59 > "$TMP/pure.json"
PURE="$WT/.issue/59/pure-tree"
check "pure-tree 생성" "$([ -d "$PURE" ] && echo 0 || echo 1)"
check "pure-tree 는 변경 전 내용" "$(grep -q 'a = 1' "$PURE/src/index.ts" && echo 0 || echo 1)"
node "$END" pure-tree --issue 59 --remove > /dev/null
check "pure-tree 정리" "$([ ! -d "$PURE" ] && echo 0 || echo 1)"

if [ "$fail" -ne 0 ]; then
  echo; echo "test-flow: 실패"; exit 1
fi
echo; echo "test-flow: 통과"
