# Geometry Rules

Detailed rule specs and decision logic. Values cited as "default" can be overridden via `detect_anomalies.py` flags.

## Confidence tiers

The detector emits two confidence tiers. The split is non-negotiable because image-only signals can never prove design intent.

| Tier | Meaning | When |
|---|---|---|
| `confirmed` | Geometry alone proves the issue | text bbox extends past parent / two text bboxes overlap with different parents / text center outside parent |
| `suspected` | Issue is plausible but design intent could explain it | vertical writing-mode, ellipsis clipping, lopsided padding, multi-line wrap |
| `warning` | Tooling state, not a UI issue | OCR unavailable, image-only mode |

A `suspected` issue is **never** auto-promoted to `confirmed`. If the user wants automatic promotion (e.g., on CI), they must add explicit DOM/style evidence — the rule engine will not do it on its own.

## Rules

### `text_overflow` (confirmed)

**Trigger**: `outside_area_ratio(text, parent) >= out_area_thresh` (default 0.10).

`outside_area_ratio` = 1 − (intersection_area / text_area). The text box has at least 10% of its area outside the parent container.

**Metrics emitted**:
- `outside_area_ratio` — exact fraction
- `right_overflow_px` — pixels past the right edge (0 if not overflowing right)
- `bottom_overflow_px` — same for bottom

**Why this is confirmed**: Pixels are pixels. A label whose bbox sticks 30px past the right edge of its button is not a design choice; it's a layout failure. CSS `overflow: visible` does not change this — even if the parent is "OK" with overflow, the visible spillover is what the user sees.

**False-positive guard**: If the text element has `position: absolute` AND its parent's `overflow` is `visible`, this *might* be intentional (overlay tooltip). The current rule does not special-case this; if you start seeing tooltip false positives, add a filter on `position`.

### `container_escape` (confirmed)

**Trigger**: text bbox center `(cx, cy)` is outside the parent bbox.

**Why this is confirmed**: Center-out is a stronger signal than partial overflow. If the *center* of the text is outside the parent, the rendering is materially wrong; ellipsis won't save it.

**Note**: this rule overlaps with `text_overflow` for severe cases. Both fire and both are reported — the consumer can deduplicate by `text_element_id`.

### `overlapping_text` (confirmed)

**Trigger**: IoU(textA, textB) ≥ `overlap_iou` (default 0.20) **AND** the two texts have different parents.

The same-parent skip is critical: a button label is allowed to overlap an icon or a screen-reader-only span sharing the parent. We only flag when two distinct components stack on top of each other.

**Metrics emitted**: `iou` value, both text element IDs, the union bbox.

**Tuning**: 0.20 is conservative — you'll catch obvious collisions and miss the marginal cases. Lower to 0.10 if you want recall over precision; expect more decorative-overlap false positives.

### `vertical_text_suspected` (suspected)

**Trigger** (any of):
- `writing-mode != horizontal-tb`
- transform contains a 90°/270° rotation matrix
- bbox is much taller than wide AND narrow (`h > 2*w` and `w < 60`)

**Why suspected, not confirmed**: Korean/Japanese/Chinese pages legitimately use vertical text in callouts, decorative headings, and badges. We cannot tell from pixels alone whether vertical text is intentional. The metric package includes `writing_mode` and `transform` so the reviewer can decide in seconds.

**OCR boost**: If Tesseract is available, the detector OCRs the suspect crop and attaches `ocr.text` and `ocr.confidence`. Low OCR confidence on a "vertical" candidate strengthens the suspicion.

### `text_clipping_suspected` (suspected)

**Trigger**: text bbox edge is within 2px of the parent edge **AND** parent has clipping signals (`overflow: hidden` OR `overflow-x: hidden` OR `text-overflow: ellipsis`).

**Why suspected**: Ellipsis truncation is a designed pattern — it's not always a bug. The metric package includes `edge_distances` and the relevant CSS values so the reviewer can confirm.

**Image-only mode**: When DOM is missing, this rule cannot fire (no overflow/text-overflow signals). The detector falls back to `text_overflow` only. Add a `--strict-clip` future flag if you want geometry-only clipping detection.

### `bad_padding_suspected` (suspected)

**Trigger**: For an interactive element, `max(left, right) / max(min(left, right), 1) > 4` OR same for top/bottom.

A 5:1 left-vs-right padding ratio on a button usually means the layout broke (e.g., a sibling icon pushed text off-center). 1:1 to 3:1 ratios are common in real designs and are not flagged.

**Why suspected**: Asymmetric padding can be intentional (e.g., a button with a leading icon naturally has more left padding). Reviewer must confirm.

### `bad_wrap_suspected` (suspected)

**Trigger**: A text inside an interactive element has `bbox.height > line_height_px * 1.7`.

We compute the expected line height from the element's CSS (`line-height` and `font-size`). If the rendered text height exceeds ~1.7x the line height, it's likely wrapped to two or more lines. For most buttons, single-line is the design intent; multi-line indicates either a too-long label or a too-narrow button.

**Why suspected**: Some buttons (e.g., "Sign in with Google\nusing your work account") legitimately wrap. Reviewer must confirm.

## Element-detection precedence

The detector builds the element graph in this order, oldest source wins:

1. **DOM bbox** (Playwright `getBoundingClientRect`) — highest fidelity. Includes interactive flag and accessibility name.
2. **OpenCV contour** — only used when DOM is empty (image-only mode) or as a fill-in for canvas/svg-rendered widgets.
3. **OCR seed** — when no text exists in the DOM and Tesseract is available, OCR every contour box; results above `ocr_min_conf` (default 60) become text entries.

## Text-to-parent mapping

For each text element without a DOM-assigned parent:

1. Find all elements whose bbox contains ≥50% of the text bbox area.
2. Pick the smallest such element by area.
3. If no element passes, leave `parent_id` null and the rule engine skips overflow/escape/clipping rules for that text.

This is the "smallest containing container" heuristic from `docs/final.md`. It works because UI components are nested — the *innermost* container that holds the text is almost always the visually responsible one.

## Coordinate system notes

All bboxes are in **CSS pixels** with origin at the document top-left. Playwright's `getBoundingClientRect` returns viewport-relative coordinates; the capture script adds `window.scrollX/Y` to absolutize them. The screenshot is taken at the same scale as the viewport (or `device_scale * viewport` if `--device-scale > 1`), so pixels and bboxes line up 1:1 without further scaling.

If you change `device-scale` between capture and render, the annotation overlay will misalign. Don't.

## Tuning checklist

Before changing thresholds, ask:

- Is the user reporting too many false positives or too many misses?
- Is the failure mode in one rule, or several?
- Are there suspected issues that would have been caught by a confirmed-tier rule given DOM evidence?

If the answer is "false positives in vertical_text_suspected on a Korean page", the fix is to install `tesseract-lang` and let the OCR boost downvote the false positives, **not** to lower the threshold.
