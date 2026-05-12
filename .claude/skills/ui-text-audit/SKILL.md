---
name: ui-text-audit
description: Audits webpage UI for button/input/card text rendering anomalies — text overflow, unintended vertical or rotated text, edge clipping, overlapping text, and broken padding/wrap — by combining Playwright DOM extraction, OpenCV contour fallback, geometry rules, and optional Tesseract crop-OCR. Use whenever the user gives a URL or a browser screenshot and asks to check for "버튼 텍스트 깨짐", "텍스트 오버플로우", "세로 텍스트", "버튼 잘림", "UI 깨짐 검사", "라벨 잘렸는지 확인", "button text overflow", "vertical text rendering", "text clipping audit", or wants to verify deployed page button labels visually fit. Runs CPU-only on Mac (Apple Silicon and Intel) with no Nvidia/CUDA requirement; OCR is opt-in and the skill still emits DOM/style/geometry warnings without it.
---

# UI Text Audit

## Overview

Detect rendering anomalies in webpage UI text by triangulating three independent signals:

1. **DOM truth** — `innerText`, accessibility name, `getBoundingClientRect`, `getComputedStyle` (`writing-mode`, `white-space`, `overflow`, `text-overflow`, `line-height`, padding).
2. **Pixel evidence** — Playwright viewport screenshot, optional OpenCV contour for elements DOM cannot resolve.
3. **OCR fallback** — Tesseract on suspicious crops only, never on the full page.

Outputs three artifacts per run:

```
output/
  screenshot.annotated.png   # green=container, blue=text, red=issue, purple=overflow
  layout.json                # elements + text + parent relations
  issues.json                # confirmed + suspected anomalies
```

This skill implements the **Phase 1 MVP** path of `docs/final.md`: DOM-first geometry analysis, OpenCV contour as image-only fallback, OCR strictly opt-in. It does **not** require CUDA, Nvidia GPU, PaddleOCR, or any external Cloud Vision API. PaddleOCR is documented as an optional accuracy pack in `references/installation.md` but is not part of the default path.

## When to use

Trigger on any of these:

- User pastes a URL and asks "버튼 텍스트가 잘리거나 깨지는지 봐줘" / "체크해줘".
- User attaches a screenshot and asks to find UI text issues.
- User wants automated visual QA for deployed pages where DOM is inspectable.
- User mentions: button overflow, vertical text, text clipping, label collision, padding asymmetry.

Do **not** use for: full visual regression diffs (use Playwright/Percy/Backstop instead), accessibility audit (use axe), pure layout reverse-engineering (use `make-[redacted]`).

## Inputs

The skill accepts one of two input modes:

| Mode | Input | What it gives |
|---|---|---|
| **DOM-first** (recommended) | URL | Playwright launches Chromium, captures viewport screenshot + per-element DOM/style/bbox. Most accurate. |
| **Image-only** (fallback) | local PNG/JPG path | OpenCV contour for element detection, OCR for text. DOM signals are skipped — `image_only_mode: true` flag is set on the report. |

If both URL and screenshot are provided, prefer URL (DOM beats pixels).

## Workflow

### Step 1 — Set up artifact directory

```bash
SLUG=$(echo "<host-or-image-name>" | tr '/.: ' '----' | tr '[:upper:]' '[:lower:]')
WORK=".omc/artifacts/ui-text-audit/$SLUG"
mkdir -p "$WORK/output"
```

All scripts read/write inside `$WORK`. Never pollute the user's repo root.

### Step 2 — Capture page (URL input)

```bash
npx --yes -p playwright node .claude/skills/ui-text-audit/scripts/capture_page.mjs \
  "<url>" "$WORK"
```

Optional flags:
- `--viewport-width 1440 --viewport-height 900` (default: 1440x900)
- `--device-scale 1` (set 2 for retina-emulated)
- `--wait 1500` ms after `domcontentloaded`
- `--full-page` to capture entire page height (off by default; long pages tile poorly).

Output:
- `$WORK/screenshot.png`
- `$WORK/dom.json` — `{ meta, elements: [...], texts: [...] }`
- `$WORK/page.html` — rendered DOM for grep-only follow-up

If Chromium is missing, the script prints a one-line install hint. Run `npx --yes playwright install chromium` once and retry. The first install takes 1–3 minutes; use `run_in_background` if needed.

#### Image-only fallback

Skip Step 2 entirely. Place the screenshot at `$WORK/screenshot.png` and create an empty `$WORK/dom.json`:

```bash
echo '{"meta":{"image_only":true},"elements":[],"texts":[]}' > "$WORK/dom.json"
```

The detector reads `image_only` and switches to OpenCV+OCR-only judgment with reduced confidence.

### Step 3 — Detect anomalies

The Python scripts ship with PEP 723 inline metadata, so `uv run` handles the venv and dependency install automatically. No `pip install` step is required if `uv` is on PATH.

```bash
uv run .claude/skills/ui-text-audit/scripts/detect_anomalies.py "$WORK"
```

Fallback if `uv` is unavailable (slower, requires manual deps):

```bash
python3 -m pip install --user opencv-python-headless numpy Pillow  # one-time
python3 .claude/skills/ui-text-audit/scripts/detect_anomalies.py "$WORK"
```

See `references/installation.md` for both paths.

What it does:

1. Reads `screenshot.png`, `dom.json`, `meta.json`.
2. Builds the **container set** (DOM bbox first; OpenCV contour fills gaps for image-only or DOM-invisible elements).
3. Builds the **text set** (DOM `innerText` bbox first; suspicious crops are passed to OCR if Tesseract is on PATH).
4. Maps each text to its smallest-containing parent.
5. Runs the rule engine to produce:
   - `layout.json` — full element + text + relations graph
   - `issues.json` — `confirmed` (overflow/overlap/escape) and `suspected` (vertical/clipping/padding/wrap)

The rule engine is documented in `references/geometry-rules.md`. Key thresholds (overridable via flags):

| Rule | Default threshold | Confidence |
|---|---|---|
| `text_overflow` | outside_area_ratio ≥ 0.10 | confirmed |
| `overlapping_text` | text-vs-text IoU ≥ 0.20, different parents | confirmed |
| `container_escape` | text center outside parent bbox | confirmed |
| `vertical_text_suspected` | writing-mode != horizontal-tb OR rotation 90/270 inside horizontal UI | suspected |
| `text_clipping_suspected` | text bbox touches parent edge AND (`overflow:hidden` or `text-overflow:ellipsis`) | suspected |
| `bad_padding_suspected` | left/right or top/bottom padding ratio > 4× | suspected |
| `bad_wrap_suspected` | button label wrapped to >1 line where single-line is expected | suspected |

Optional flags:
- `--no-ocr` to skip Tesseract even if installed
- `--ocr-conf 60` minimum OCR confidence (default 60)
- `--out-area 0.10` overflow threshold

### Step 4 — Render annotated screenshot

```bash
uv run .claude/skills/ui-text-audit/scripts/render_report.py "$WORK"
```

Or `python3` if you've installed Pillow manually.

Produces `$WORK/output/screenshot.annotated.png` using the colour convention from `docs/final.md`:

| Colour | Meaning |
|---|---|
| Green | button / input / card / generic container candidate |
| Blue | OCR or DOM text bbox |
| Yellow | group / section |
| Red | issue region |
| Purple | overflowed sub-region |

### Step 5 — Read OCR availability + summarise

After Step 3, before reporting, read `$WORK/output/issues.json`. If it contains an `ocr_unavailable` warning, surface that to the user in one short line — they may want to install Tesseract for tighter recall. See `references/ocr-fallback.md` for the install one-liner.

### Step 6 — Final report

Report in this shape:

```
Source: <url-or-image-path>
Mode: dom-first | image-only
Workspace: <artifact-dir>
Confirmed issues: N (text_overflow=A, overlapping_text=B, container_escape=C)
Suspected issues: M (vertical=D, clipping=E, padding=F, wrap=G)
OCR: tesseract@<version> | unavailable
Annotated PNG: <path>
layout.json: <path>
issues.json: <path>
```

Lead with the count, not the explanation. The annotated PNG is the user's first visual proof; offer to open it. If `image_only` mode was used, add one sentence noting that suspected/confirmed boundaries shifted toward suspected because DOM signals were absent.

## Confidence policy

Two-tier output is non-negotiable. Image-only inputs cannot prove design intent — vertical text might be intentional in a Korean/Japanese/Chinese layout, ellipsis clipping might be the correct UX. Therefore:

- **Confirmed** issues require *geometry-only* evidence: text bbox extends past parent, two text bboxes overlap with different parents, text center is outside parent.
- **Suspected** issues require additional human review and are emitted with the metric values that triggered them, so the reviewer can accept or reject quickly.

Never up-promote a suspected issue to confirmed without DOM/style evidence (e.g., explicit `overflow: hidden`, explicit `writing-mode: vertical-rl`). The detector script enforces this — do not patch around it.

## Why this pipeline shape

- **DOM beats pixels.** A model staring at a screenshot guesses; a model reading `dom.json` knows text content, intended writing-mode, and parent identity. We use OpenCV only where DOM is missing.
- **OCR on the full page is wasteful.** PaddleOCR on a 1440x4000 full-page image takes 30–90s on M-series CPU. Cropping to suspect regions (≤30 small boxes) takes 2–5s with Tesseract and is good enough for the confirm/suspect call.
- **No CUDA, no cloud.** The user's laptop is the worst-case environment, so the default path is what works there. Nvidia, PaddleOCR, and Cloud Vision are documented but not invoked.
- **Two-tier output mirrors human review.** Reviewers triage red issues first, suspected issues second. Conflating them creates noise that erodes trust.

## Bundled resources

Scripts:
- `scripts/capture_page.mjs` — Playwright capture (DOM bbox + computed style + viewport screenshot).
- `scripts/detect_anomalies.py` — OpenCV contour fallback + geometry rule engine + crop OCR orchestration.
- `scripts/ocr_crops.py` — Tesseract subprocess wrapper with graceful degrade.
- `scripts/render_report.py` — annotated PNG renderer (Pillow).

References:
- `references/geometry-rules.md` — full rule list + thresholds + decision diagrams.
- `references/output-schema.md` — `layout.json` + `issues.json` JSON schema.
- `references/installation.md` — Mac CPU-first install, optional Tesseract / PaddleOCR accuracy packs.
- `references/ocr-fallback.md` — when crop OCR helps, when it doesn't, language pack hints.

## Limitations to surface in the final report

- Lazy-loaded sections below the initial viewport are not analysed unless `--full-page` is set; even then, sticky headers/animation can stitch incorrectly.
- Iframes from cross-origin domains are not introspected (Playwright permission boundary).
- Image-only mode cannot distinguish intentional vertical/decorative text from broken vertical rendering — every such case is `vertical_text_suspected`.
- OCR confidence is language-dependent; install `tesseract-lang` for Korean/Japanese/Chinese coverage. See `references/ocr-fallback.md`.

If any of these apply to the run, include a one-line note in the final report.
