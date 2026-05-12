#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["opencv-python-headless", "numpy", "Pillow"]
# ///
"""Detect UI text anomalies from a captured workdir.

Inputs (under <workdir>):
  screenshot.png   required
  dom.json         required (use {"meta":{"image_only":true},"elements":[],"texts":[]} for image-only)
  meta.json        optional (defaults pulled from dom.json.meta)

Outputs:
  <workdir>/output/layout.json
  <workdir>/output/issues.json

Run:
  python3 detect_anomalies.py <workdir> [--no-ocr] [--ocr-conf 60] [--out-area 0.10]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
except ImportError as e:
    sys.stderr.write(
        "Missing dependency. Install with:\n"
        "  pip install opencv-python-headless numpy\n"
        f"(original: {e})\n"
    )
    sys.exit(2)


# ---------- data models ---------- #

@dataclass
class BBox:
    x: float
    y: float
    w: float
    h: float

    @property
    def x2(self) -> float: return self.x + self.w
    @property
    def y2(self) -> float: return self.y + self.h
    @property
    def cx(self) -> float: return self.x + self.w / 2
    @property
    def cy(self) -> float: return self.y + self.h / 2
    @property
    def area(self) -> float: return max(0.0, self.w) * max(0.0, self.h)

    def to_list(self) -> list[float]:
        return [self.x, self.y, self.w, self.h]

    @classmethod
    def from_list(cls, lst: list[float]) -> "BBox":
        return cls(float(lst[0]), float(lst[1]), float(lst[2]), float(lst[3]))


def iou(a: BBox, b: BBox) -> float:
    ix1, iy1 = max(a.x, b.x), max(a.y, b.y)
    ix2, iy2 = min(a.x2, b.x2), min(a.y2, b.y2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    union = a.area + b.area - inter
    return inter / union if union > 0 else 0.0


def contains_ratio(child: BBox, parent: BBox) -> float:
    """Fraction of `child` inside `parent`."""
    ix1, iy1 = max(child.x, parent.x), max(child.y, parent.y)
    ix2, iy2 = min(child.x2, parent.x2), min(child.y2, parent.y2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    return (iw * ih) / child.area if child.area > 0 else 0.0


def outside_ratio(text: BBox, parent: BBox) -> float:
    return 1.0 - contains_ratio(text, parent)


def edge_distance(text: BBox, parent: BBox) -> dict[str, float]:
    return {
        "left":   text.x  - parent.x,
        "right":  parent.x2 - text.x2,
        "top":    text.y  - parent.y,
        "bottom": parent.y2 - text.y2,
    }


# ---------- OpenCV contour fallback ---------- #

def opencv_container_candidates(img_bgr: "np.ndarray", min_area: float = 800.0) -> list[BBox]:
    """Find rectangle-ish contours likely to be button/card/input.

    This is intentionally simple: it's a fallback for image-only mode and
    for DOM-invisible (canvas/svg) elements.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 60, 180)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes: list[BBox] = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w * h < min_area:
            continue
        if w < 12 or h < 12:
            continue
        # filter strip-like artifacts
        if min(w, h) / max(w, h) < 0.05:
            continue
        boxes.append(BBox(float(x), float(y), float(w), float(h)))
    return boxes


# ---------- OCR crop helper ---------- #

def tesseract_available() -> str | None:
    return shutil.which("tesseract")


def ocr_crop(img_bgr: "np.ndarray", bbox: BBox, lang: str = "eng+kor") -> dict[str, Any]:
    """OCR a single crop with Tesseract. Returns {text, confidence}."""
    bin_path = tesseract_available()
    if not bin_path:
        return {"text": "", "confidence": 0.0, "available": False}
    x = max(0, int(bbox.x))
    y = max(0, int(bbox.y))
    x2 = min(img_bgr.shape[1], int(bbox.x2))
    y2 = min(img_bgr.shape[0], int(bbox.y2))
    if x2 - x < 4 or y2 - y < 4:
        return {"text": "", "confidence": 0.0, "available": True}
    crop = img_bgr[y:y2, x:x2]
    # Tesseract prefers slightly upscaled, grayscale input
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    if gray.shape[0] < 32:
        scale = 32 / max(1, gray.shape[0])
        gray = cv2.resize(gray, (int(gray.shape[1] * scale), int(gray.shape[0] * scale)),
                          interpolation=cv2.INTER_CUBIC)
    _, png_buf = cv2.imencode(".png", gray)
    try:
        result = subprocess.run(
            [bin_path, "stdin", "stdout", "-l", lang, "--psm", "7", "tsv"],
            input=png_buf.tobytes(),
            capture_output=True,
            timeout=8,
        )
    except subprocess.TimeoutExpired:
        return {"text": "", "confidence": 0.0, "available": True, "timeout": True}
    if result.returncode != 0:
        # try eng-only fallback when language pack is missing
        if lang != "eng":
            return ocr_crop(img_bgr, bbox, lang="eng")
        return {"text": "", "confidence": 0.0, "available": True,
                "error": result.stderr.decode("utf-8", "replace")[:200]}
    lines = result.stdout.decode("utf-8", "replace").splitlines()
    words: list[str] = []
    confs: list[float] = []
    for ln in lines[1:]:
        parts = ln.split("\t")
        if len(parts) >= 12:
            txt = parts[11].strip()
            try:
                c = float(parts[10])
            except ValueError:
                continue
            if txt and c >= 0:
                words.append(txt)
                confs.append(c)
    text = " ".join(words).strip()
    conf = sum(confs) / len(confs) if confs else 0.0
    return {"text": text, "confidence": conf, "available": True}


# ---------- main pipeline ---------- #

def load_dom(workdir: Path) -> dict[str, Any]:
    with open(workdir / "dom.json", "r", encoding="utf-8") as f:
        return json.load(f)


def smallest_containing_parent(text_bbox: BBox, candidates: list[dict[str, Any]],
                               min_inside: float = 0.5) -> dict[str, Any] | None:
    best = None
    best_area = math.inf
    for cand in candidates:
        cb = BBox.from_list(cand["bbox"])
        if contains_ratio(text_bbox, cb) >= min_inside:
            if cb.area < best_area:
                best = cand
                best_area = cb.area
    return best


def parse_padding(style: dict[str, Any]) -> tuple[float, float, float, float]:
    def px(v: Any) -> float:
        if not v:
            return 0.0
        s = str(v).strip()
        if s.endswith("px"):
            try: return float(s[:-2])
            except ValueError: return 0.0
        try: return float(s)
        except ValueError: return 0.0
    return (px(style.get("padding_top")), px(style.get("padding_right")),
            px(style.get("padding_bottom")), px(style.get("padding_left")))


def line_height_px(style: dict[str, Any]) -> float | None:
    fs_s = str(style.get("font_size", "")).strip()
    lh_s = str(style.get("line_height", "")).strip()
    if not fs_s.endswith("px"):
        return None
    try:
        fs = float(fs_s[:-2])
    except ValueError:
        return None
    if lh_s == "normal":
        return fs * 1.2
    if lh_s.endswith("px"):
        try: return float(lh_s[:-2])
        except ValueError: return None
    try:
        return fs * float(lh_s)
    except ValueError:
        return None


# ---------- rules ---------- #

def run_rules(layout: dict[str, Any], img_bgr: "np.ndarray", *,
              out_area_thresh: float, overlap_iou: float, ocr_enabled: bool,
              ocr_min_conf: float) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    next_id = 1

    def issue(**fields):
        nonlocal next_id
        fields.setdefault("id", f"issue_{next_id:04d}")
        next_id += 1
        issues.append(fields)

    elements_by_id = {e["id"]: e for e in layout["elements"]}
    texts = layout["texts"]

    # 1. text_overflow + container_escape
    for t in texts:
        parent_id = t.get("parent_id")
        if not parent_id or parent_id not in elements_by_id:
            continue
        parent = elements_by_id[parent_id]
        tb, pb = BBox.from_list(t["bbox"]), BBox.from_list(parent["bbox"])
        out_area = outside_ratio(tb, pb)
        edges = edge_distance(tb, pb)
        if out_area >= out_area_thresh:
            issue(type="text_overflow", severity="high", confidence="confirmed",
                  target_element_id=parent["id"], text_element_id=t["id"],
                  bbox=tb.to_list(),
                  metrics={"outside_area_ratio": round(out_area, 4),
                           "right_overflow_px": round(-edges["right"], 2)
                                              if edges["right"] < 0 else 0,
                           "bottom_overflow_px": round(-edges["bottom"], 2)
                                              if edges["bottom"] < 0 else 0})
        # container_escape: text center outside parent bbox
        if not (pb.x <= tb.cx <= pb.x2 and pb.y <= tb.cy <= pb.y2):
            issue(type="container_escape", severity="high", confidence="confirmed",
                  target_element_id=parent["id"], text_element_id=t["id"],
                  bbox=tb.to_list(),
                  metrics={"text_center": [round(tb.cx, 1), round(tb.cy, 1)],
                           "parent_bbox": pb.to_list()})

    # 2. overlapping_text (different parents)
    for i, a in enumerate(texts):
        for b in texts[i + 1:]:
            if a.get("parent_id") and a.get("parent_id") == b.get("parent_id"):
                continue
            ab, bb = BBox.from_list(a["bbox"]), BBox.from_list(b["bbox"])
            score = iou(ab, bb)
            if score >= overlap_iou:
                issue(type="overlapping_text", severity="high", confidence="confirmed",
                      text_element_ids=[a["id"], b["id"]],
                      bbox=[min(ab.x, bb.x), min(ab.y, bb.y),
                            max(ab.x2, bb.x2) - min(ab.x, bb.x),
                            max(ab.y2, bb.y2) - min(ab.y, bb.y)],
                      metrics={"iou": round(score, 4)})

    # 3. vertical_text_suspected
    for t in texts:
        if t.get("orientation") == "vertical" or t.get("orientation") == "vertical_suspected":
            wm = (t.get("style") or {}).get("writing_mode", "horizontal-tb")
            issue(type="vertical_text_suspected", severity="medium", confidence="suspected",
                  text_element_id=t["id"], bbox=t["bbox"],
                  metrics={"writing_mode": wm,
                           "transform": (t.get("style") or {}).get("transform")})

    # 4. text_clipping_suspected
    for t in texts:
        parent_id = t.get("parent_id")
        if not parent_id or parent_id not in elements_by_id:
            continue
        parent = elements_by_id[parent_id]
        tb, pb = BBox.from_list(t["bbox"]), BBox.from_list(parent["bbox"])
        edges = edge_distance(tb, pb)
        touches_edge = any(0 <= v <= 2 for v in edges.values())
        ps = parent.get("style") or {}
        clip_signals = (ps.get("overflow") == "hidden" or
                        ps.get("overflow_x") == "hidden" or
                        ps.get("text_overflow") == "ellipsis")
        if touches_edge and clip_signals:
            issue(type="text_clipping_suspected", severity="medium", confidence="suspected",
                  target_element_id=parent["id"], text_element_id=t["id"],
                  bbox=t["bbox"],
                  metrics={"edge_distances": {k: round(v, 2) for k, v in edges.items()},
                           "overflow": ps.get("overflow"),
                           "text_overflow": ps.get("text_overflow")})

    # 5. bad_padding_suspected
    for el in layout["elements"]:
        if not el.get("is_interactive"):
            continue
        pt, pr, pb_, pl = parse_padding(el.get("style") or {})
        h_total, v_total = pl + pr, pt + pb_
        h_ok = h_total < 1 or (max(pl, pr) / max(min(pl, pr), 1) <= 4)
        v_ok = v_total < 1 or (max(pt, pb_) / max(min(pt, pb_), 1) <= 4)
        if not (h_ok and v_ok):
            issue(type="bad_padding_suspected", severity="low", confidence="suspected",
                  target_element_id=el["id"], bbox=el["bbox"],
                  metrics={"padding": {"top": pt, "right": pr,
                                        "bottom": pb_, "left": pl}})

    # 6. bad_wrap_suspected — interactive container with text taller than ~1 line
    for el in layout["elements"]:
        if not el.get("is_interactive"):
            continue
        eb = BBox.from_list(el["bbox"])
        own_texts = [t for t in texts if t.get("parent_id") == el["id"]]
        for t in own_texts:
            tb = BBox.from_list(t["bbox"])
            lh = line_height_px(t.get("style") or {})
            if lh and tb.h > lh * 1.7:
                issue(type="bad_wrap_suspected", severity="low", confidence="suspected",
                      target_element_id=el["id"], text_element_id=t["id"],
                      bbox=t["bbox"],
                      metrics={"text_height_px": round(tb.h, 1),
                               "line_height_px": round(lh, 1)})

    # 7. OCR-driven clipping confidence boost (suspected + low OCR conf -> still suspected,
    # but attach evidence). image-only mode also benefits.
    if ocr_enabled and tesseract_available():
        # OCR every "suspected" candidate region we already flagged
        suspect_targets = [iss for iss in issues
                           if iss["confidence"] == "suspected"
                           and iss["type"] in {"text_clipping_suspected",
                                               "vertical_text_suspected"}]
        for iss in suspect_targets:
            tb = BBox.from_list(iss["bbox"])
            res = ocr_crop(img_bgr, tb)
            iss.setdefault("metrics", {})["ocr"] = {
                "text": res["text"], "confidence": round(res["confidence"], 1),
                "available": res["available"],
            }
            if res.get("confidence", 0) >= ocr_min_conf:
                iss["metrics"]["ocr_high_confidence"] = True
    elif ocr_enabled and not tesseract_available():
        issues.append({
            "id": f"issue_{next_id:04d}",
            "type": "ocr_unavailable",
            "severity": "info",
            "confidence": "warning",
            "message": "tesseract not found on PATH; suspect-region OCR was skipped.",
            "remedy": "brew install tesseract && brew install tesseract-lang",
        })

    return issues


def main():
    p = argparse.ArgumentParser()
    p.add_argument("workdir")
    p.add_argument("--no-ocr", action="store_true")
    p.add_argument("--ocr-conf", type=float, default=60.0)
    p.add_argument("--out-area", type=float, default=0.10)
    p.add_argument("--overlap-iou", type=float, default=0.20)
    args = p.parse_args()

    work = Path(args.workdir)
    out_dir = work / "output"
    out_dir.mkdir(parents=True, exist_ok=True)

    img_path = work / "screenshot.png"
    if not img_path.exists():
        sys.stderr.write(f"missing screenshot: {img_path}\n")
        sys.exit(1)
    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None:
        sys.stderr.write(f"could not read image: {img_path}\n")
        sys.exit(1)

    dom = load_dom(work)
    image_only = bool(dom.get("meta", {}).get("image_only"))
    elements = list(dom.get("elements") or [])
    texts = list(dom.get("texts") or [])

    # Image-only fallback: synthesize containers from OpenCV contours
    if image_only or not elements:
        contour_boxes = opencv_container_candidates(img_bgr)
        for i, b in enumerate(contour_boxes):
            elements.append({
                "id": f"cv_{i:04d}",
                "tag": "unknown",
                "role": None,
                "accessible_name": None,
                "bbox": b.to_list(),
                "style": {},
                "is_interactive": False,
                "depth": -1,
                "parent_el_id": None,
                "source": "opencv_contour",
            })

    # If texts list is empty (image-only), do a coarse OCR sweep restricted to
    # contour boxes to seed the text set. Skip when --no-ocr.
    if not args.no_ocr and not texts and tesseract_available():
        seeded: list[dict[str, Any]] = []
        for i, el in enumerate(elements):
            if not el["bbox"]: continue
            res = ocr_crop(img_bgr, BBox.from_list(el["bbox"]))
            if res["text"] and res["confidence"] >= args.ocr_conf:
                seeded.append({
                    "id": f"otx_{i:04d}",
                    "parent_id": el["id"],
                    "bbox": el["bbox"],
                    "text": res["text"],
                    "style": {},
                    "orientation": "horizontal",
                    "source": "ocr_seed",
                })
        texts = seeded

    # Re-link orphan texts to smallest containing element when DOM didn't set parent
    for t in texts:
        if not t.get("parent_id"):
            tb = BBox.from_list(t["bbox"])
            parent = smallest_containing_parent(tb, elements)
            t["parent_id"] = parent["id"] if parent else None

    layout = {
        "image": {
            "width": int(img_bgr.shape[1]),
            "height": int(img_bgr.shape[0]),
            "image_only": image_only,
        },
        "elements": elements,
        "texts": texts,
        "relations": [
            {"parent": t["parent_id"], "child": t["id"], "relation": "contains"}
            for t in texts if t.get("parent_id")
        ],
    }

    issues = run_rules(layout, img_bgr,
                       out_area_thresh=args.out_area,
                       overlap_iou=args.overlap_iou,
                       ocr_enabled=not args.no_ocr,
                       ocr_min_conf=args.ocr_conf)

    with open(out_dir / "layout.json", "w", encoding="utf-8") as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    with open(out_dir / "issues.json", "w", encoding="utf-8") as f:
        json.dump({"issues": issues}, f, ensure_ascii=False, indent=2)

    confirmed = [i for i in issues if i.get("confidence") == "confirmed"]
    suspected = [i for i in issues if i.get("confidence") == "suspected"]
    summary = {
        "ok": True,
        "image_only": image_only,
        "ocr_available": bool(tesseract_available()) and not args.no_ocr,
        "elements": len(elements),
        "texts": len(texts),
        "confirmed": len(confirmed),
        "suspected": len(suspected),
        "by_type": {
            t: sum(1 for i in issues if i.get("type") == t)
            for t in sorted({i.get("type") for i in issues if i.get("type")})
        },
        "layout_path": str(out_dir / "layout.json"),
        "issues_path": str(out_dir / "issues.json"),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
