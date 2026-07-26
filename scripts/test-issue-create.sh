#!/usr/bin/env bash
# issue-create 스크립트의 실제 동작을 임시 저장소에서 검증한다.
# gh 를 호출하는 경로(search / labels / unlabeled / label / ensure-label, 실제 create)는 다루지 않는다.
# 원격을 붙이지 않아야 gate 가 gh 를 부르지 않는다.
#
#   sh scripts/test-issue-create.sh

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
CREATE="$ROOT/.claude/skills/issue-create/scripts/issue-create.mjs"

TMP=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$TMP"' EXIT
export HOME="$TMP/home"
mkdir -p "$HOME"

fail=0
check() { # check <설명> <조건 결과 0/1>
  if [ "$2" -ne 0 ]; then echo "FAIL  $1"; fail=1; else echo "ok    $1"; fi
}

init_repo() { # init_repo <경로>
  git init -q "$1"
  cd "$1"
  git config user.email t@e.com
  git config user.name t
  git config commit.gpgsign false
}

# =====================================================================
# gate — 스캐폴딩 저장소
# 커밋 2개 이하이면 신호 수와 무관하게 SKIP 이어야 한다.
# =====================================================================
init_repo "$TMP/scaffold"
mkdir -p src
printf '{"name":"scaffold"}\n' > package.json
i=1
while [ "$i" -le 12 ]; do printf 'export const a%s = %s;\n' "$i" "$i" > "src/m$i.ts"; i=$((i + 1)); done
git add -A && git commit -qm "init"
printf 'export const b = 1;\n' > src/extra.ts
git add -A && git commit -qm "second"

OUT=$(node "$CREATE" gate)
check "gate: 커밋 2개면 신호가 있어도 SKIP" "$(echo "$OUT" | grep -q 'VERDICT=SKIP' && echo 0 || echo 1)"
check "gate: 스캐폴딩에서도 build-config 신호는 잡힘" "$(echo "$OUT" | grep -q 'build-config' && echo 0 || echo 1)"

# =====================================================================
# gate — 자리 잡은 저장소
# 커밋 25개 + package.json + 소스 12개 → 신호 3개 → ASK 이상.
# 원격이 없으므로 remote+gh / issue-pr-history 는 못 채운다(= gh 미호출).
# =====================================================================
init_repo "$TMP/mature"
mkdir -p src
printf '{"name":"mature"}\n' > package.json
i=1
while [ "$i" -le 12 ]; do printf 'export const a%s = %s;\n' "$i" "$i" > "src/m$i.ts"; i=$((i + 1)); done
git add -A && git commit -qm "init"
i=1
while [ "$i" -le 24 ]; do
  printf 'export const c%s = %s;\n' "$i" "$i" >> src/m1.ts
  git add -A && git commit -qm "change $i"
  i=$((i + 1))
done

OUT=$(node "$CREATE" gate)
check "gate: 커밋 25개 저장소는 SKIP 이 아님" "$(echo "$OUT" | grep -q 'VERDICT=SKIP' && echo 1 || echo 0)"
check "gate: commits 신호 충족" "$(echo "$OUT" | grep -q '✓ commits>=20' && echo 0 || echo 1)"
check "gate: source 신호 충족" "$(echo "$OUT" | grep -q '✓ source>=10' && echo 0 || echo 1)"
check "gate: 원격 없으면 remote+gh 미충족 (gh 미호출)" "$(echo "$OUT" | grep -q '· remote+gh' && echo 0 || echo 1)"

# =====================================================================
# create — 라벨 강제
# =====================================================================
printf '## 배경\n\n테스트 본문\n' > "$TMP/draft-1.md"

set +e
OUT=$(node "$CREATE" create --title "라벨 없는 이슈" --body-file "$TMP/draft-1.md" 2>&1)
CODE=$?
set -e
check "create: --label 없으면 exit 2" "$([ "$CODE" -eq 2 ] && echo 0 || echo 1)"
check "create: --label 없을 때 이유를 출력" "$(echo "$OUT" | grep -q -- '성격 라벨(--label)이 하나 이상 필요하다' && echo 0 || echo 1)"
check "create: --label 없으면 .issue 를 만들지 않음" "$([ ! -d .issue ] && echo 0 || echo 1)"

# =====================================================================
# create --dry-run — 다중 등록 경로 스모크
# 항목마다 따로 호출해도 서로 간섭하지 않아야 한다.
# =====================================================================
printf '## 배경\n\n두번째\n' > "$TMP/draft-2.md"
printf '## 배경\n\n세번째\n' > "$TMP/draft-3.md"

GITIGNORE_BEFORE=$(cat .gitignore 2>/dev/null || printf '')

D1=$(node "$CREATE" create --dry-run --title "대시보드 기간 필터 추가" --body-file "$TMP/draft-1.md" --label enhancement)
D2=$(node "$CREATE" create --dry-run --title "주문 목록 빈 렌더링 수정" --body-file "$TMP/draft-2.md" --label bug)
D3=$(node "$CREATE" create --dry-run --title "레거시 export 스크립트 제거" --body-file "$TMP/draft-3.md" --label chore)

check "dry-run 1: 제목·라벨이 명령에 반영" "$(echo "$D1" | grep -q '대시보드 기간 필터 추가' && echo "$D1" | grep -q -- '--label enhancement' && echo 0 || echo 1)"
check "dry-run 2: 제목·라벨이 명령에 반영" "$(echo "$D2" | grep -q '주문 목록 빈 렌더링 수정' && echo "$D2" | grep -q -- '--label bug' && echo 0 || echo 1)"
check "dry-run 3: 제목·라벨이 명령에 반영" "$(echo "$D3" | grep -q '레거시 export 스크립트 제거' && echo "$D3" | grep -q -- '--label chore' && echo 0 || echo 1)"
UNIQ=$(printf '%s\n%s\n%s\n' "$D1" "$D2" "$D3" | grep 'gh issue create' | sort -u | wc -l | tr -d ' ')
check "dry-run: 세 호출이 서로 다른 명령을 냄" "$([ "$UNIQ" = "3" ] && echo 0 || echo 1)"

# 부작용이 없어야 한다 — dry-run 은 아무것도 만들지 않는다.
check "dry-run: .issue 를 만들지 않음" "$([ ! -d .issue ] && echo 0 || echo 1)"
check "dry-run: .gitignore 를 건드리지 않음" "$([ "$(cat .gitignore 2>/dev/null || printf '')" = "$GITIGNORE_BEFORE" ] && echo 0 || echo 1)"

# =====================================================================
# create — 본문 파일이 없을 때
# =====================================================================
set +e
node "$CREATE" create --title "없는 본문" --body-file "$TMP/nope.md" --label bug >/dev/null 2>&1
CODE=$?
set -e
check "create: 본문 파일이 없으면 실패" "$([ "$CODE" -ne 0 ] && echo 0 || echo 1)"

echo
if [ "$fail" -ne 0 ]; then
  echo "test-issue-create: 실패"
  exit 1
fi
echo "test-issue-create: 통과"
