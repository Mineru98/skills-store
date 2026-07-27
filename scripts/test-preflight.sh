#!/usr/bin/env bash
# issue-merge 의 충돌 사전 감지(preflight) 와 해소 판 깔기(resolve) 를 임시 저장소에서 검증한다.
# gh 는 호출하지 않는다. 순수 git 경로만 다룬다.
#
#   sh scripts/test-preflight.sh

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MERGE="$ROOT/.claude/skills/issue-merge/scripts/issue-merge.mjs"

# macOS 의 /tmp 는 /private/tmp 심볼릭 링크라 git 이 돌려주는 경로와 어긋난다.
TMP=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$TMP"' EXIT
export HOME="$TMP/home"
mkdir -p "$HOME"

fail=0
check() { # check <설명> <조건 결과 0/1>
  if [ "$2" -ne 0 ]; then echo "FAIL  $1"; fail=1; else echo "ok    $1"; fi
}
# JSON 한 필드만 뽑는다. jq 의존을 만들지 않는다.
field() { # field <파일> <키경로>
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
    console.log(process.argv[2].split(".").reduce((a,k)=>a==null?a:a[k],d));' "$1" "$2"
}

# --- 원격 역할 bare 저장소 + 작업 저장소
git init -q --bare "$TMP/origin.git"
git init -q "$TMP/myapp"
cd "$TMP/myapp"
git config user.email t@e.com; git config user.name t
git config commit.gpgsign false
printf 'line1\nline2\nline3\n' > app.txt
printf '{"v":1}\n' > yarn.lock
printf 'untouched\n' > other.txt
git add -A && git commit -qm 'init'
git branch -M main
git remote add origin "$TMP/origin.git"
git push -q -u origin main

# --- 세 브랜치. b 와 c 만 app.txt 의 같은 줄을 서로 다르게 고친다.
git switch -qc fix/1-a
printf 'a\n' >> other.txt && git commit -qam a && git push -q -u origin fix/1-a

git switch -q main && git switch -qc feat/2-b
printf 'line1\nB-line2\nline3\n' > app.txt
printf '{"v":2}\n' > yarn.lock
git commit -qam b && git push -q -u origin feat/2-b

git switch -q main && git switch -qc feat/3-c
printf 'line1\nC-line2\nline3\n' > app.txt
printf '{"v":3}\n' > yarn.lock
git commit -qam c && git push -q -u origin feat/3-c
git switch -q main

# --- preflight: base 대비 단독 판정
node "$MERGE" preflight --branch fix/1-a > "$TMP/a.json"
check "preflight: 겹침 없는 브랜치는 clean" "$([ "$(field "$TMP/a.json" clean)" = true ] && echo 0 || echo 1)"
check "preflight: clean 이면 체인용 commit 을 준다" "$([ "$(field "$TMP/a.json" commit)" != null ] && echo 0 || echo 1)"
check "preflight: merge-tree 경로를 썼다" "$([ "$(field "$TMP/a.json" via)" = merge-tree ] && echo 0 || echo 1)"

# c 는 base 대비로는 깨끗하다. 이것이 "단독으로는 통과하지만 순서 때문에 깨지는" 케이스다.
node "$MERGE" preflight --branch feat/3-c > "$TMP/c-solo.json"
check "preflight: c 는 base 대비 단독으로는 clean" "$([ "$(field "$TMP/c-solo.json" clean)" = true ] && echo 0 || echo 1)"

# --- 누적 시뮬레이션: a → b → c
node "$MERGE" preflight --branch feat/2-b --onto "$(field "$TMP/a.json" commit)" > "$TMP/b.json"
check "preflight: 누적(a 위의 b) 도 clean" "$([ "$(field "$TMP/b.json" clean)" = true ] && echo 0 || echo 1)"

set +e
node "$MERGE" preflight --branch feat/3-c --onto "$(field "$TMP/b.json" commit)" > "$TMP/c.json"
code=$?
set -e
check "preflight: 누적(b 위의 c) 에서 충돌을 잡는다" "$([ "$(field "$TMP/c.json" clean)" = false ] && echo 0 || echo 1)"
check "preflight: 충돌이면 exit 1" "$([ "$code" -eq 1 ] && echo 0 || echo 1)"
check "preflight: 충돌 파일 2개" "$([ "$(field "$TMP/c.json" conflictCount)" = 2 ] && echo 0 || echo 1)"
check "preflight: 소스는 content 로 분류" "$([ "$(field "$TMP/c.json" conflicts.0.kind)" = content ] && echo 0 || echo 1)"
check "preflight: lockfile 은 generated 로 분류" "$([ "$(field "$TMP/c.json" conflicts.1.kind)" = generated ] && echo 0 || echo 1)"
check "preflight: 충돌이면 체인을 끊는다" "$([ "$(field "$TMP/c.json" commit)" = null ] && echo 0 || echo 1)"

# --onto 에 tree 를 넘기면 조용히 오독하지 않고 실패해야 한다.
# merge-tree 는 공통 조상을 찾아야 하므로 tree 만으로는 합칠 수 없다.
TREE=$(field "$TMP/b.json" tree)
set +e
node "$MERGE" preflight --branch feat/3-c --onto "$TREE" > "$TMP/bad.txt" 2>&1
bad=$?
set -e
check "preflight: tree 를 onto 로 주면 실패한다" "$([ "$bad" -ne 0 ] && echo 0 || echo 1)"
check "preflight: 실패 사유를 알려준다" "$(grep -q '커밋으로 해석할 수 없습니다' "$TMP/bad.txt" && echo 0 || echo 1)"

# --- resolve: 앞선 merge 를 실제로 반영한 뒤 c 쪽에서 해소한다
git merge -q --no-edit feat/2-b && git push -q origin main
git worktree add -q "$TMP/wt-c" feat/3-c

set +e
node "$MERGE" resolve --worktree "$TMP/wt-c" > "$TMP/r1.json"
r1=$?
set -e
check "resolve: 충돌을 잡고 exit 1" "$([ "$r1" -eq 1 ] && echo 0 || echo 1)"
check "resolve: merge 를 진행 중으로 멈춘다" "$([ "$(field "$TMP/r1.json" started)" = true ] && echo 0 || echo 1)"
check "resolve: 충돌 헌크 줄번호를 준다" "$([ "$(field "$TMP/r1.json" conflicts.0.hunks.0)" -gt 0 ] && echo 0 || echo 1)"
check "resolve: base 브랜치는 그대로" "$(git -C "$TMP/myapp" rev-parse main | grep -q "$(git -C "$TMP/origin.git" rev-parse main)" && echo 0 || echo 1)"

# 마커를 남긴 채 continue 하면 커밋하지 않아야 한다.
set +e
node "$MERGE" resolve --worktree "$TMP/wt-c" --continue > "$TMP/r2.json"
r2=$?
set -e
check "resolve --continue: 마커가 남으면 거부" "$([ "$r2" -ne 0 ] && echo 0 || echo 1)"
check "resolve --continue: 커밋하지 않았다" "$([ "$(field "$TMP/r2.json" committed)" = false ] && echo 0 || echo 1)"

# 양쪽 의도를 모두 보존하는 방향으로 해소
printf 'line1\nB-line2\nC-line2\nline3\n' > "$TMP/wt-c/app.txt"
printf '{"v":3}\n' > "$TMP/wt-c/yarn.lock"

node "$MERGE" resolve --worktree "$TMP/wt-c" --continue > "$TMP/r3.json"
check "resolve --continue: 해소되면 커밋" "$([ "$(field "$TMP/r3.json" committed)" = true ] && echo 0 || echo 1)"
check "resolve --continue: --push 없이는 올리지 않는다" "$([ "$(field "$TMP/r3.json" pushed)" = null ] && echo 0 || echo 1)"

node "$MERGE" resolve --worktree "$TMP/wt-c" --continue --push > "$TMP/r4.json"
check "resolve --continue --push: 올린다" "$([ "$(field "$TMP/r4.json" pushed)" = true ] && echo 0 || echo 1)"

node "$MERGE" preflight --branch feat/3-c > "$TMP/after.json"
check "해소 후 preflight 가 clean" "$([ "$(field "$TMP/after.json" clean)" = true ] && echo 0 || echo 1)"
check "해소가 양쪽 변경을 모두 남겼다" "$(grep -q 'B-line2' "$TMP/wt-c/app.txt" && grep -q 'C-line2' "$TMP/wt-c/app.txt" && echo 0 || echo 1)"

# --- base 워크트리에서는 해소하지 않는다
node "$MERGE" base-tree > /dev/null
set +e
node "$MERGE" resolve --worktree "$TMP/myapp/.issue/merge/base" > "$TMP/guard.txt" 2>&1
guard=$?
set -e
check "resolve: base 워크트리를 거부한다" "$([ "$guard" -ne 0 ] && echo 0 || echo 1)"
node "$MERGE" base-tree --remove > /dev/null

# --- detached 워크트리는 push 대상이 없으므로 시작하지 않는다
git worktree add -q --detach "$TMP/wt-detached" main
set +e
node "$MERGE" resolve --worktree "$TMP/wt-detached" > "$TMP/det.txt" 2>&1
det=$?
set -e
check "resolve: detached 워크트리를 거부한다" "$([ "$det" -ne 0 ] && echo 0 || echo 1)"
check "resolve: detached 사유를 알려준다" "$(grep -q 'detached' "$TMP/det.txt" && echo 0 || echo 1)"
git worktree remove --force "$TMP/wt-detached"

# --- merge 실패 사유 분류
node -e '
const src = require("fs").readFileSync(process.argv[1], "utf8");
// 스크립트 안의 순수 함수만 떼어 검증한다. gh 를 호출하지 않는다.
const body = src.slice(src.indexOf("function mergeFailureCause"));
const fn = new Function(body.slice(0, body.indexOf("\nconst MERGE_HINT")) + "\nreturn mergeFailureCause;")();
const cases = [
  ["Pull request is not mergeable: the merge commit cannot be cleanly created", "conflict"],
  ["required status check \"build\" is failing", "checks"],
  ["at least 1 approving review is required", "approval"],
  ["no pull requests found for branch", "state"],
  ["something else entirely", "unknown"],
];
let bad = 0;
for (const [text, want] of cases) {
  const got = fn(text);
  if (got !== want) { console.error(`  ${want} 기대인데 ${got}: ${text}`); bad = 1; }
}
process.exit(bad);
' "$MERGE"
check "merge 실패 사유를 충돌/CI/승인/상태로 가른다" "$?"

if [ "$fail" -ne 0 ]; then
  echo; echo "test-preflight: 실패"; exit 1
fi
echo; echo "test-preflight: 통과"
