# Installation

The skill is designed to run on a MacBook with **no Nvidia GPU** and **no CUDA**. Apple Silicon and Intel Mac are both supported. The default path uses CPU-only OpenCV, Playwright, and optional Tesseract.

The optional PaddleOCR accuracy pack is documented at the end. It is **not** part of the default skill path.

## Recommended path: `uv` + `npx`

The Python scripts ship with **PEP 723 inline script metadata**, which means `uv run` resolves and caches the dependencies automatically — no manual `pip install`, no venv to manage.

### One-time install: uv + Playwright Chromium

```bash
# uv (fast Python launcher / dep manager)
brew install uv
# or:  curl -LsSf https://astral.sh/uv/install.sh | sh

# Playwright Chromium binary (one-time download, ~150–250 MB)
npx --yes playwright install chromium
```

That's the entire setup. Subsequent `uv run` calls reuse a cached environment, so they start in milliseconds.

### Verify

```bash
uv run --with opencv-python-headless --with numpy --with Pillow \
  python -c "import cv2, numpy, PIL; print('uv_ok', cv2.__version__)"
node -e "import('playwright').then(p => p.chromium.launch().then(b => b.close()).then(() => console.log('playwright_ok')))"
```

If both lines print without error, the recommended path is ready.

### Why uv over plain pip

- **PEP 668 immune.** Homebrew Python on macOS rejects bare `pip install` to protect itself. uv handles venv creation transparently.
- **5–10× faster.** First-run dep resolution takes seconds, not minutes.
- **Inline metadata.** Each script declares its own deps at the top (`# /// script ... # ///`), so the dep set lives next to the code. No drift between docs and reality.
- **No activation dance.** `uv run script.py` is the whole command — no `source .venv/bin/activate` step.

## Fallback path: pip + venv

If `uv` is not available (CI image without it, locked-down environment), fall back to a standard venv. PEP 723 metadata is just a comment to plain Python, so the scripts run identically.

```bash
# Create an isolated venv anywhere convenient
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install opencv-python-headless numpy Pillow

# Use it
.venv/bin/python .claude/skills/ui-text-audit/scripts/detect_anomalies.py <workdir>
```

`opencv-python-headless` is preferred over `opencv-python`:

- **CI/headless safe**: no GUI dependencies, works in Docker, GitHub Actions, ssh shells.
- **Same API**: rule engine code is identical; only `cv2.imshow` is missing, and the skill never calls it.

OpenCV install reference: https://docs.opencv.org/4.x/db/dd1/tutorial_py_pip_install.html

### Why not `--user` or `--break-system-packages`?

Both work but pollute the system Python. The venv path keeps the install scoped, reproducible, and easy to delete. uv does the same thing automatically.

## OCR fallback (optional, recommended)

Tesseract runs CPU-only, installs in seconds, and is good enough for the suspect-crop role. The skill auto-detects it on PATH and emits an `ocr_unavailable` warning instead of crashing if absent.

```bash
brew install tesseract            # core engine
brew install tesseract-lang       # full language packs (Korean, Japanese, Chinese, ...)
```

Homebrew formula: https://formulae.brew.sh/formula/tesseract.html

Per-language guidance:

- **Korean / Japanese**: install `tesseract-lang` (includes `kor`, `kor_vert`, `jpn`, `jpn_vert`).
- **Chinese**: `tesseract-lang` ships `chi_sim` and `chi_tra`.
- **English-only**: core `tesseract` formula already includes `eng`. Skip `tesseract-lang`.

The detector tries `eng+kor` by default and falls back to `eng` if the language pack is missing.

## Optional: PaddleOCR accuracy pack

Use this only when Tesseract recall is insufficient on your specific surface (small fonts, tight spacing, dense Asian text). PaddleOCR CPU on Mac is **noticeably slower** than Tesseract — 5–15× depending on image size — so don't enable it for the bulk of runs.

With uv (preferred):

```bash
uv pip install --python .venv/bin/python paddlepaddle paddleocr
```

Or via plain pip into a venv:

```bash
.venv/bin/pip install paddlepaddle paddleocr
```

Apple Silicon and Intel Mac are both CPU-only for PaddlePaddle on macOS. Official notes:
- PaddlePaddle macOS install: https://paddlepaddle-static.cdn.bcebos.com/documentation/docs/en/install/pip/macos-pip_en.html
- PaddleOCR-VL on Apple Silicon: https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/PaddleOCR-VL-Apple-Silicon.html

This skill does **not** ship a PaddleOCR adapter. If you wire one in, follow the same crop-only contract — never run PaddleOCR on a full screenshot.

## Optional: experimental MLX / VLM

MLX is Apple Silicon's ML framework. It can host VLM workloads locally, but for this skill it's purely experimental — not part of any default path. Reference: https://opensource.apple.com/projects/mlx/

If you experiment with VLM-as-detector, treat it as a Phase 3 measurement add-on per `docs/final.md`. Phase 1 must keep working without it.

## What the skill explicitly does **not** require

- CUDA / Nvidia GPU
- A Cloud Vision API key
- A specific Mac model
- A specific browser version (Chromium that Playwright installs is what you get)
- An internet connection at run time, **except** the first time `npx playwright install` downloads Chromium and `uv run` warms its cache

If you find yourself needing any of these, you've left the Phase 1 path. Re-read `docs/final.md` "최종 권장안" before adding the dependency.
