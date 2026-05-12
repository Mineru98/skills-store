#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["opencv-python-headless", "numpy"]
# ///
"""Stand-alone Tesseract crop OCR helper.

Usage (from CLI, mostly for debugging — detect_anomalies.py imports the
underlying function directly):

  python3 ocr_crops.py <image.png> <bbox_json>

  bbox_json: '[[x,y,w,h], [x,y,w,h], ...]' — a JSON array of [x,y,w,h] crops

Behavior:
  - If `tesseract` is not on PATH, prints a JSON warning and exits 0 with
    available=false on every entry. Never fails the run.
  - Default language is 'eng+kor'. Falls back to 'eng' if the requested
    language pack is missing.
  - PSM 7 (single line of text) is used because button labels are usually
    single-line.

The detector pipeline imports `ocr_crop` from `detect_anomalies`. This
script is the public face for ad-hoc inspection (e.g., "is OCR working?").
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

try:
    import cv2  # type: ignore
except ImportError as e:
    sys.stderr.write(
        "Missing dependency. Install with:\n"
        "  pip install opencv-python-headless\n"
        f"(original: {e})\n"
    )
    sys.exit(2)

# Reuse the implementation from the detector to avoid drift.
THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS))
from detect_anomalies import BBox, ocr_crop, tesseract_available  # noqa: E402


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python3 ocr_crops.py <image.png> '<bbox_json>'", file=sys.stderr)
        sys.exit(1)

    img_path = Path(sys.argv[1])
    bbox_arg = sys.argv[2]

    img = cv2.imread(str(img_path))
    if img is None:
        print(json.dumps({"ok": False, "error": f"could not read {img_path}"}))
        sys.exit(1)

    boxes_raw = json.loads(bbox_arg)
    bin_path = tesseract_available()
    if not bin_path:
        print(json.dumps({
            "ok": True,
            "warning": "tesseract not on PATH",
            "remedy": "brew install tesseract && brew install tesseract-lang",
            "results": [{"bbox": b, "text": "", "confidence": 0.0,
                         "available": False} for b in boxes_raw],
        }, ensure_ascii=False, indent=2))
        return

    results = []
    for b in boxes_raw:
        bbox = BBox.from_list(b)
        res = ocr_crop(img, bbox)
        results.append({"bbox": b, **res})

    print(json.dumps({"ok": True, "tesseract": bin_path, "results": results},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
