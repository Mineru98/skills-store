#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["Pillow"]
# ///
"""Render the annotated screenshot from layout.json + issues.json.

Usage:
  python3 render_report.py <workdir>

Reads:
  <workdir>/screenshot.png
  <workdir>/output/layout.json
  <workdir>/output/issues.json

Writes:
  <workdir>/output/screenshot.annotated.png

Color convention (from docs/final.md):
  green   container / button candidate
  blue    text bbox (DOM or OCR)
  yellow  group / section
  red     issue region
  purple  overflowed sub-region
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont  # type: ignore
except ImportError as e:
    sys.stderr.write(
        "Missing dependency. Install with:\n"
        "  pip install Pillow\n"
        f"(original: {e})\n"
    )
    sys.exit(2)


COLORS = {
    "container": (40, 200, 80, 255),     # green
    "text":      (60, 130, 255, 255),    # blue
    "group":     (240, 200, 40, 255),    # yellow
    "issue":     (235, 70, 70, 255),     # red
    "overflow":  (170, 80, 220, 255),    # purple
    "shadow":    (0, 0, 0, 160),
}


def load_font(size: int = 14) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except OSError:
            continue
    return ImageFont.load_default()


def rect(draw: ImageDraw.ImageDraw, bbox: list[float], color: tuple[int, int, int, int],
         width: int = 2) -> None:
    x, y, w, h = bbox
    draw.rectangle([x, y, x + w, y + h], outline=color, width=width)


def label(draw: ImageDraw.ImageDraw, x: float, y: float, text: str,
          color: tuple[int, int, int, int], font: ImageFont.ImageFont) -> None:
    pad = 3
    bbox = draw.textbbox((x, y), text, font=font)
    bg = (255, 255, 255, 230)
    draw.rectangle([bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad], fill=bg)
    draw.text((x, y), text, fill=color, font=font)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 render_report.py <workdir>", file=sys.stderr)
        sys.exit(1)

    work = Path(sys.argv[1])
    img_path = work / "screenshot.png"
    layout_path = work / "output" / "layout.json"
    issues_path = work / "output" / "issues.json"

    if not img_path.exists():
        print(f"missing: {img_path}", file=sys.stderr)
        sys.exit(1)
    if not layout_path.exists():
        print(f"missing: {layout_path} (run detect_anomalies.py first)", file=sys.stderr)
        sys.exit(1)

    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    issues = json.loads(issues_path.read_text(encoding="utf-8")).get("issues", []) \
             if issues_path.exists() else []

    base = Image.open(img_path).convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = load_font(13)

    # Containers (green)
    for el in layout.get("elements", []):
        rect(draw, el["bbox"], COLORS["container"], width=2)

    # Texts (blue)
    for t in layout.get("texts", []):
        rect(draw, t["bbox"], COLORS["text"], width=1)

    # Issues (red, with type label)
    for iss in issues:
        if iss.get("type") == "ocr_unavailable":
            continue
        bbox = iss.get("bbox")
        if not bbox: continue
        is_overflow = iss.get("type") in {"text_overflow"}
        c = COLORS["overflow"] if is_overflow else COLORS["issue"]
        rect(draw, bbox, c, width=3)
        label_text = f'{iss["type"]} ({iss.get("confidence", "?")[:1]})'
        label(draw, bbox[0], max(0, bbox[1] - 18), label_text, c, font)

    out_img = Image.alpha_composite(base, overlay).convert("RGB")
    out_path = work / "output" / "screenshot.annotated.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_img.save(out_path, format="PNG")

    summary = {
        "ok": True,
        "annotated": str(out_path),
        "elements_drawn": len(layout.get("elements", [])),
        "texts_drawn": len(layout.get("texts", [])),
        "issues_drawn": sum(1 for i in issues if i.get("bbox")),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
