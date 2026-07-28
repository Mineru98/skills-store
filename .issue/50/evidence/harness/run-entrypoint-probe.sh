#!/usr/bin/env bash
#
# 이슈 #50 증거 하네스 — 진입점 가드가 실행 경로에 따라 어떻게 동작하는지 재현한다.
#
#   bash .issue/50/evidence/harness/run-entrypoint-probe.sh before
#   bash .issue/50/evidence/harness/run-entrypoint-probe.sh after
#
# 대상 9개 스크립트를 4가지 실행 경로로 각각 실행하고 stdout 유무와 exit code 를 기록한다.
#
#   symlink   임시 심볼릭 링크를 통해 실행 (심볼릭 링크 결함이 드러나는 경로)
#   realpath  실제 경로로 실행 (정상 동작하던 경로)
#   relative  상대 경로로 실행 — Node 가 argv[1] 을 절대화하므로 원래도 동작한다
#   spaced    공백이 든 디렉터리로 **복사**해 실제 경로로 실행
#             심볼릭 링크를 섞지 않아야 `file://${경로}` 의 퍼센트 인코딩 결함만 분리된다
#
# 인자 없이 실행하면 각 스크립트는 usage 를 출력한다. main() 이 호출됐는지를
# "출력이 있는가" 로 판정할 수 있어 네트워크·인증 없이 검증된다.
#
# 결과는 JSON 으로 stdout 에, 사람이 읽는 표는 stderr 로 나간다.
set -uo pipefail

PHASE="${1:-unknown}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"

TMP="$(mktemp -d)"
SPACED="$TMP/dir with spaces"
mkdir -p "$SPACED"
trap 'rm -rf "$TMP"' EXIT

# 대상: 저장소 루트 기준 상대 경로
SCRIPTS=(
  ".claude/skills/issue-start/scripts/issue-start.mjs"
  ".codex/skills/issue-start/scripts/issue-start.mjs"
  ".claude/skills/issue-create/scripts/issue-create.mjs"
  ".codex/skills/issue-create/scripts/issue-create.mjs"
  ".claude/skills/gh-setup/scripts/gh-env.mjs"
  ".codex/skills/gh-setup/scripts/gh-env.mjs"
  ".claude/skills/imagine/scripts/verify.js"
  ".codex/skills/loop/scripts/loop.mjs"
  ".codex/skills/schedule/scripts/schedule.mjs"
)

# 스크립트 하나를 주어진 경로로 실행하고 "<출력바이트>:<exit code>" 를 돌려준다.
run_one() {
  local target="$1" cwd="$2"
  local out rc
  out="$(cd "$cwd" && node "$target" 2>&1)"
  rc=$?
  printf '%s:%s' "${#out}" "$rc"
}

json_rows=()
printf '%-56s %-14s %-14s %-14s %-14s\n' "script" "symlink" "realpath" "relative" "spaced" >&2
printf '%s\n' "--------------------------------------------------------------------------------------------------------------" >&2

for rel in "${SCRIPTS[@]}"; do
  abs="$ROOT/$rel"
  if [ ! -f "$abs" ]; then
    printf '%-56s %s\n' "$rel" "<파일 없음>" >&2
    continue
  fi

  # 스킬 디렉터리(.claude/skills/<name>)를 링크한다 — 실제 설치 형태와 같다
  skill_dir="$(cd "$(dirname "$abs")/.." && pwd)"
  skill_name="$(basename "$skill_dir")"
  tail_path="${abs#"$skill_dir"/}"

  link_base="$TMP/links"
  mkdir -p "$link_base"
  link="$link_base/$(echo "$rel" | tr '/' '_')"
  rm -rf "$link"; ln -s "$skill_dir" "$link"

  # 공백 경로는 심볼릭 링크가 아니라 실제 복사본으로 만든다.
  # 링크를 쓰면 심볼릭 링크 결함에 가려 퍼센트 인코딩 결함이 보이지 않는다.
  spaced_copy="$SPACED/$(echo "$rel" | tr '/' '_')"
  rm -rf "$spaced_copy"; cp -r "$skill_dir" "$spaced_copy"

  r_symlink="$(run_one "$link/$tail_path" "$TMP")"
  r_realpath="$(run_one "$abs" "$TMP")"
  r_relative="$(run_one "./$rel" "$ROOT")"
  r_spaced="$(run_one "$spaced_copy/$tail_path" "$TMP")"

  printf '%-56s %-14s %-14s %-14s %-14s\n' \
    "$(basename "$(dirname "$(dirname "$rel")")")/$(basename "$rel")" \
    "$r_symlink" "$r_realpath" "$r_relative" "$r_spaced" >&2

  esc_rel="${rel//\"/\\\"}"
  json_rows+=("$(printf '{"script":"%s","skill":"%s","symlink":"%s","realpath":"%s","relative":"%s","spaced":"%s"}' \
    "$esc_rel" "$skill_name" "$r_symlink" "$r_realpath" "$r_relative" "$r_spaced")")
done

# 모듈 import 시 main() 이 실행되지 않는지 확인 (형태 A 대표 파일 하나)
IMPORT_PROBE="$TMP/import-probe.mjs"
probe_target="$ROOT/.claude/skills/issue-create/scripts/issue-create.mjs"
cat > "$IMPORT_PROBE" <<EOF
// import 만 하고 아무것도 호출하지 않는다. main() 이 돌면 usage 가 찍힌다.
await import(${probe_target@Q}.replace(/^/, 'file://'));
process.stdout.write('IMPORT_CLEAN');
EOF
import_out="$(cd "$TMP" && node "$IMPORT_PROBE" 2>&1)"
import_rc=$?
if [ "$import_out" = "IMPORT_CLEAN" ]; then import_verdict="clean"; else import_verdict="polluted"; fi
printf '\nimport 시 main() 미실행: %s (exit %s)\n' "$import_verdict" "$import_rc" >&2

printf '{\n  "issue": 50,\n  "phase": "%s",\n  "legend": "<출력바이트>:<exit code> — 0:0 이면 아무 출력 없이 성공 종료(조용한 실패)",\n  "importMainNotExecuted": "%s",\n  "rows": [\n' "$PHASE" "$import_verdict"
for i in "${!json_rows[@]}"; do
  sep=","; [ "$i" -eq $(( ${#json_rows[@]} - 1 )) ] && sep=""
  printf '    %s%s\n' "${json_rows[$i]}" "$sep"
done
printf '  ]\n}\n'
