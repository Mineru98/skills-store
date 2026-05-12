# Output Schema

The detector writes two JSON files into `<workdir>/output/`. Both are intentionally human-readable so you can grep/jq them in CI without a parser.

## `layout.json`

```json
{
  "image": {
    "width": 1440,
    "height": 900,
    "image_only": false
  },
  "elements": [
    {
      "id": "el_0001",
      "tag": "button",
      "role": null,
      "accessible_name": "결제 진행하기",
      "bbox": [520, 318, 160, 48],
      "style": {
        "writing_mode": "horizontal-tb",
        "white_space": "nowrap",
        "overflow": "visible",
        "text_overflow": "clip",
        "padding_top": "12px",
        "padding_right": "16px",
        "padding_bottom": "12px",
        "padding_left": "16px",
        "line_height": "24px",
        "font_size": "14px"
      },
      "is_interactive": true,
      "depth": 4,
      "parent_el_id": null
    }
  ],
  "texts": [
    {
      "id": "tx_0001",
      "parent_id": "el_0001",
      "bbox": [548, 330, 184, 22],
      "text": "결제 진행하기",
      "style": { "writing_mode": "horizontal-tb", "white_space": "nowrap" },
      "orientation": "horizontal"
    }
  ],
  "relations": [
    { "parent": "el_0001", "child": "tx_0001", "relation": "contains" }
  ]
}
```

### Field reference

**`image`**
- `width`, `height`: pixel dimensions of `screenshot.png`.
- `image_only`: true when the run skipped Playwright (no DOM signals).

**`elements[]`**
- `id`: stable per-run id, prefixed `el_` (DOM) or `cv_` (OpenCV-only).
- `tag`: HTML tag name lower-cased; `unknown` when the source is OpenCV.
- `role`: ARIA role if set on the element.
- `accessible_name`: aria-label, aria-labelledby resolved, or input placeholder.
- `bbox`: `[x, y, w, h]` in CSS pixels, document coordinates.
- `style`: subset of computed styles relevant to text rendering.
- `is_interactive`: true for buttons/links/inputs/role-mapped controls.
- `depth`: DOM depth; -1 for OpenCV-derived nodes.
- `parent_el_id`: nearest ancestor in `elements[]`, or null.

**`texts[]`**
- `id`: prefixed `tx_` (DOM) or `otx_` (OCR-seeded).
- `parent_id`: smallest containing element id, or null if none found.
- `bbox`: `[x, y, w, h]`.
- `text`: visible text content (DOM) or OCR result.
- `style`: same shape as elements.style.
- `orientation`: `horizontal | vertical | vertical_suspected`.
- `source` (optional): `ocr_seed` when produced by OCR fallback.

**`relations[]`**
- Materialised parent→child mapping. Same info as `texts[].parent_id`, denormalised for downstream consumers that prefer edges.

## `issues.json`

```json
{
  "issues": [
    {
      "id": "issue_0001",
      "type": "text_overflow",
      "severity": "high",
      "confidence": "confirmed",
      "target_element_id": "el_0001",
      "text_element_id": "tx_0001",
      "bbox": [660, 330, 72, 22],
      "metrics": {
        "outside_area_ratio": 0.18,
        "right_overflow_px": 44,
        "bottom_overflow_px": 0
      }
    },
    {
      "id": "issue_0002",
      "type": "vertical_text_suspected",
      "severity": "medium",
      "confidence": "suspected",
      "text_element_id": "tx_0007",
      "bbox": [120, 200, 22, 88],
      "metrics": {
        "writing_mode": "vertical-rl",
        "transform": "none",
        "ocr": { "text": "메뉴", "confidence": 71.2, "available": true }
      }
    },
    {
      "id": "issue_0003",
      "type": "ocr_unavailable",
      "severity": "info",
      "confidence": "warning",
      "message": "tesseract not found on PATH; suspect-region OCR was skipped.",
      "remedy": "brew install tesseract && brew install tesseract-lang"
    }
  ]
}
```

### Issue types

| `type` | `confidence` | `severity` |
|---|---|---|
| `text_overflow` | confirmed | high |
| `container_escape` | confirmed | high |
| `overlapping_text` | confirmed | high |
| `vertical_text_suspected` | suspected | medium |
| `text_clipping_suspected` | suspected | medium |
| `bad_padding_suspected` | suspected | low |
| `bad_wrap_suspected` | suspected | low |
| `ocr_unavailable` | warning | info |

### `metrics` is type-specific

- `text_overflow`: `outside_area_ratio`, `right_overflow_px`, `bottom_overflow_px`
- `container_escape`: `text_center [x, y]`, `parent_bbox [x, y, w, h]`
- `overlapping_text`: `iou`
- `vertical_text_suspected`: `writing_mode`, `transform`, optional `ocr {text, confidence, available}`
- `text_clipping_suspected`: `edge_distances {left, right, top, bottom}`, `overflow`, `text_overflow`
- `bad_padding_suspected`: `padding {top, right, bottom, left}`
- `bad_wrap_suspected`: `text_height_px`, `line_height_px`

Don't treat `metrics` as a closed schema — new fields may appear when rules are tuned. Always read keys defensively.

## CI consumption hints

Common `jq` recipes:

```bash
# Fail the build on any confirmed issue
jq -e '.issues | map(select(.confidence=="confirmed")) | length == 0' \
   <workdir>/output/issues.json

# Count by type
jq '.issues | group_by(.type) | map({type: .[0].type, n: length})' \
   <workdir>/output/issues.json

# Get the worst three text-overflow offenders
jq '[.issues[] | select(.type=="text_overflow")] | sort_by(.metrics.outside_area_ratio) | reverse | .[0:3]' \
   <workdir>/output/issues.json
```

For a stricter gate, also require a non-empty `accessible_name` on every interactive element:

```bash
jq '[.elements[] | select(.is_interactive and (.accessible_name|not))] | length == 0' \
   <workdir>/output/layout.json
```
