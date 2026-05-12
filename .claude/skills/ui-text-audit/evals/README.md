# Evals

Synthetic test surfaces for `ui-text-audit`.

## Pages

| File | Purpose |
|---|---|
| `test-pages/overflow-buttons.html` | Six buttons exhibiting overflow / vertical-text / ellipsis-clip / bad-padding / overlap, plus one clean control. |
| `test-pages/clean.html` | Four well-formed buttons. The detector should emit zero confirmed issues. |

## Running locally

```bash
# 1. Serve the page (any tiny static server works)
python3 -m http.server 8765 --directory .claude/skills/ui-text-audit/evals/test-pages &

# 2. Audit it
SLUG=overflow-buttons
WORK=".omc/artifacts/ui-text-audit/$SLUG"
mkdir -p "$WORK/output"

# Capture (Playwright via npx; no project node_modules required)
npx --yes -p playwright node .claude/skills/ui-text-audit/scripts/capture_page.mjs \
  http://localhost:8765/overflow-buttons.html "$WORK"

# Detect + render (uv reads PEP 723 inline deps and runs in a cached venv)
uv run .claude/skills/ui-text-audit/scripts/detect_anomalies.py "$WORK"
uv run .claude/skills/ui-text-audit/scripts/render_report.py "$WORK"

# 3. Inspect
open "$WORK/output/screenshot.annotated.png"
jq '.issues | group_by(.type) | map({type: .[0].type, n: length})' "$WORK/output/issues.json"
```

If `uv` is unavailable, swap each `uv run` for the venv path documented in `references/installation.md`.

## Expected outcomes

`overflow-buttons.html` should produce (rule order may vary):

- `text_overflow` confirmed — 결제 진행하기
- `overlapping_text` confirmed — 사용자 이름 ↔ 관리자 권한
- `vertical_text_suspected` — 메뉴 열기
- `text_clipping_suspected` — 아주 긴 라벨이 들어 있어요
- `bad_padding_suspected` — 확인 (right padding 7.5× left)

`clean.html` should produce **zero confirmed** issues. A small number of suspected `bad_padding` or `bad_wrap` is acceptable noise — tune thresholds if it appears repeatedly.

## Adding a new test page

1. Drop a new `.html` under `test-pages/`. Use a single self-contained file — no external CSS/JS — so the eval is reproducible.
2. Add a new entry to `evals.json` with assertions tied to specific issue types.
3. Re-run the steps above and verify the assertions fire.

Don't add screenshots of real production pages — they age poorly and drift away from the rule set.
