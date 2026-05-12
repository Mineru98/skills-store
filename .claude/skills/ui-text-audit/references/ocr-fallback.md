# OCR Fallback Strategy

OCR is **not** required for the skill to be useful. DOM-first runs catch the bulk of real overflow/escape/overlap issues using geometry alone. OCR helps in three specific situations:

1. **Image-only mode** — there is no DOM, so we have no text bboxes to compare against containers. OCR seeds the text set.
2. **Vertical-text confirmation** — a suspect "vertical" region with high OCR confidence is more likely a real label than a decorative graphic.
3. **Clipping severity** — a clipped region whose OCR text is suspiciously short (e.g., "결제 진..." vs. expected "결제 진행하기") is stronger evidence of a real bug.

For everything else (text_overflow, container_escape, overlapping_text), OCR adds nothing — the geometry of the DOM bbox already proves the issue.

## When OCR is enabled

The detector enables OCR if:

1. `--no-ocr` is not set, **and**
2. `tesseract` exists on PATH (`shutil.which("tesseract")`).

If both are true:

- Suspected vertical/clipping issues get an OCR pass on their region. The result is attached as `metrics.ocr.{text, confidence}` for the reviewer.
- Image-only runs OCR every OpenCV contour to seed `texts[]`.

If Tesseract is missing, the detector emits a one-time `ocr_unavailable` warning at the end of `issues.json`. It never crashes the run.

## Why crop-OCR, not full-page OCR

Full-page OCR with Tesseract on a 1440×4000 page takes 8–25 seconds on M-series CPU. PaddleOCR on the same image takes 30–90s. By the time it returns, you have a wall of text with bounding boxes — almost all of which the DOM already gave you.

Crop OCR (≤30 small regions, ~30–40 px tall each) takes 0.1–0.3s per crop. The total is usually under 5 seconds and you get OCR exactly where you need it: on the regions the geometry rules already flagged as suspicious.

This contract is enforced in code: `ocr_crop` only takes a single `BBox` and refuses to run on regions smaller than 4×4 px.

## Language packs

The detector tries `eng+kor` first because Korean is the dominant non-English language in this project's user base. If the requested pack isn't installed, Tesseract returns a non-zero exit, and the wrapper retries with `eng`.

To extend coverage:

```bash
brew install tesseract-lang
```

This pulls in Korean (`kor`, `kor_vert`), Japanese (`jpn`, `jpn_vert`), Chinese simplified/traditional (`chi_sim`, `chi_tra`), and many others. The skill picks them up automatically — no config change needed.

To use a different language explicitly, edit the `lang` parameter in `ocr_crop()` inside `detect_anomalies.py`. Don't add a CLI flag unless the user asks; multilingual auto-detection is rarely worth the latency.

## Confidence interpretation

Tesseract reports per-word confidence on a 0–100 scale. The detector's `--ocr-conf` flag defaults to 60.

- **≥80**: the OCR text is reliable. Use it as ground truth for clipping/vertical confirmation.
- **40–79**: useful as evidence but not as ground truth. Show the metric to the reviewer; don't auto-promote.
- **<40**: noise. Often happens on icon-only buttons, decorative glyphs, or sub-12px fonts. Treat as if OCR returned nothing.

The detector does not aggressively filter on confidence — it returns whatever Tesseract gives. Filtering decisions live in the rule engine and the consuming UI.

## What OCR cannot do

- Tell you whether vertical text is intentional (use DOM `writing-mode` for that).
- Tell you whether ellipsis truncation is the designed behavior (use DOM `text-overflow: ellipsis`).
- Recover text behind opacity/blur/transform — OCR is honest about what's on the pixel grid.

For all three, fall back to DOM signals or human review.

## Performance budget

On a 1440×900 viewport with ~30 suspect crops:

- Tesseract: ~2–4s total
- PaddleOCR (CPU): ~15–30s total

If your run exceeds these bounds by 2× or more, the most likely cause is full-page OCR slipping in. Re-read `detect_anomalies.py`'s OCR call sites — every `ocr_crop` call should pass a `BBox` from `issues[].bbox` or `elements[].bbox`, never the whole image.
