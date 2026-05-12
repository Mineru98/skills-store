#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Build an improvement-plan prompt from layout.json + issues.json.

Reads:
  <workdir>/dom.json (for meta.url + meta.viewport + meta.image_only)
  <workdir>/output/layout.json
  <workdir>/output/issues.json

Writes:
  <workdir>/output/fix-prompt.md

The output is a deterministic markdown document written for a coding LLM
(Claude Code / Codex / Cursor) or a human engineer. It groups issues by
confidence, points each one back to the DOM element with its current style,
and proposes a primary fix candidate plus alternates.

This script intentionally avoids any LLM call. Same input -> same prompt.
"""

from __future__ import annotations

import datetime as _dt
import json
import sys
from pathlib import Path
from typing import Any

# ---------- helpers ---------- #

def fmt_bbox(b: list[float] | None) -> str:
    if not b: return "—"
    return f"[{b[0]:.0f}, {b[1]:.0f}, {b[2]:.0f}, {b[3]:.0f}]"


def style_summary(style: dict[str, Any] | None, keys: list[str]) -> str:
    style = style or {}
    parts = [f"`{k.replace('_', '-')}`: {style.get(k, '—')}" for k in keys]
    return "\n".join(f"- {p}" for p in parts)


def truncate(s: str, n: int = 80) -> str:
    s = s or ""
    return s if len(s) <= n else s[: n - 1] + "…"


# ---------- per-type fix recommender ---------- #

def primary_fix(issue: dict[str, Any], layout_index: dict[str, Any]) -> dict[str, Any]:
    """Return {primary, alternates: [...], note} based on issue type + style."""
    t = issue.get("type")
    el_id = issue.get("target_element_id")
    el = layout_index["elements"].get(el_id)
    style = (el or {}).get("style") or {}
    metrics = issue.get("metrics") or {}

    if t == "text_overflow":
        if style.get("white_space") == "nowrap":
            return {
                "primary": "부모 컨테이너 width 또는 max-width 를 늘려 한 줄 텍스트가 들어갈 공간을 확보한다 (`white-space: nowrap` 유지).",
                "alternates": [
                    "padding 을 줄여 텍스트 가용 공간을 확장.",
                    "라벨을 더 짧은 표현으로 축약 (디자인/카피 협의).",
                    "`white-space: nowrap` 을 `normal` 로 풀어 wrapping 허용 (높이 변경 영향 검토).",
                ],
                "note": f"우측 {metrics.get('right_overflow_px', 0):.0f}px / 하단 {metrics.get('bottom_overflow_px', 0):.0f}px 만큼 초과.",
            }
        return {
            "primary": "부모의 max-width 를 늘리거나 padding 을 줄여 wrapping 공간을 확보한다.",
            "alternates": [
                "라벨을 축약.",
                "font-size 를 한 단계 줄임 (다른 라벨과의 시각적 일관성 검토).",
            ],
            "note": f"outside_area={metrics.get('outside_area_ratio', 0):.1%}",
        }

    if t == "container_escape":
        return {
            "primary": "부모 컨테이너의 width/height 를 늘리거나 텍스트 라벨을 줄여 텍스트 중심점이 부모 안으로 들어오게 한다.",
            "alternates": [
                "텍스트를 별도 래퍼로 분리해 부모 밖에서 자유롭게 배치.",
                "`position: absolute` 로 의도된 오버레이라면 mapping 자체를 부모에서 제외.",
            ],
            "note": "텍스트 중심점이 부모 bbox 밖이므로 단순 padding 조정으로는 해결 안 됨.",
        }

    if t == "overlapping_text":
        return {
            "primary": "두 텍스트 노드 중 하나의 위치/z-index 를 조정한다 — 의도된 오버레이 배지가 아니면 한쪽을 옆으로 이동.",
            "alternates": [
                "두 컴포넌트가 같은 컨테이너에 잘못 겹쳐 있으면 grid/flex 로 재배치.",
                "한 쪽이 절대 위치라면 offset 재계산.",
            ],
            "note": f"IoU={metrics.get('iou', 0):.2f}, 서로 다른 부모.",
        }

    if t == "vertical_text_suspected":
        wm = metrics.get("writing_mode") or ""
        if "vertical" in str(wm):
            return {
                "primary": f"세로쓰기(`writing-mode: {wm}`)가 디자인 의도인지 확인한다. 의도가 아니면 `horizontal-tb` 로 되돌린다.",
                "alternates": [
                    "다국어 사이트라면 ko/ja/zh 라우팅에 따라 분기.",
                ],
                "note": "한·일·중 페이지에서는 의도적 세로쓰기일 가능성이 큼 — 사람 검토 필수.",
            }
        return {
            "primary": "회전 transform 이 의도된 디자인인지 확인한다. 아니면 transform 제거.",
            "alternates": ["회전 자체는 유지하되 텍스트만 wrapper 에서 빼낸다."],
            "note": metrics.get("transform") or "",
        }

    if t == "text_clipping_suspected":
        return {
            "primary": "ellipsis 가 의도된 truncation 인지 확인한다. 의도가 아니면 부모 width 를 늘리거나 `text-overflow: clip` 으로 변경.",
            "alternates": [
                "tooltip 또는 line-clamp 패턴으로 전체 텍스트 노출.",
                "라벨 자체를 짧게 (정보 손실 없는 표현으로).",
            ],
            "note": f"edge_distance={metrics.get('edge_distances')}, overflow={metrics.get('overflow')}, text-overflow={metrics.get('text_overflow')}",
        }

    if t == "bad_padding_suspected":
        p = metrics.get("padding") or {}
        return {
            "primary": "padding 을 균형있게 재조정한다. 아이콘+라벨 구성이면 padding 보정 대신 `gap` + flex 정렬을 사용.",
            "alternates": ["[redacted] (예: `--space-x-button`) 으로 통일."],
            "note": f"current padding {p}",
        }

    if t == "bad_wrap_suspected":
        return {
            "primary": "한 줄 디자인이라면 부모 width 를 늘리거나 라벨을 축약한다. 두 줄 디자인이라면 의도된 패턴인지 확인하고 무시.",
            "alternates": [
                "responsive breakpoint 별로 라벨 분기.",
                "label 옆 보조 텍스트를 sub-label 로 분리.",
            ],
            "note": f"text {metrics.get('text_height_px')}px / line {metrics.get('line_height_px')}px",
        }

    return {"primary": "사람 검토 필요.", "alternates": [], "note": ""}


# ---------- per-type style keys to surface ---------- #

STYLE_KEYS_BY_TYPE = {
    "text_overflow":            ["white_space", "overflow", "text_overflow", "padding_left", "padding_right"],
    "container_escape":         ["white_space", "overflow", "padding_left", "padding_right"],
    "overlapping_text":         ["display"],
    "vertical_text_suspected":  ["writing_mode", "transform", "direction"],
    "text_clipping_suspected":  ["overflow", "overflow_x", "text_overflow", "white_space"],
    "bad_padding_suspected":    ["padding_top", "padding_right", "padding_bottom", "padding_left"],
    "bad_wrap_suspected":       ["white_space", "line_height", "font_size"],
}


def render_issue(idx: int, issue: dict[str, Any], layout_index: dict[str, Any]) -> str:
    t = issue.get("type", "?")
    el_id = issue.get("target_element_id")
    text_id = issue.get("text_element_id")
    text_ids = issue.get("text_element_ids") or []
    el = layout_index["elements"].get(el_id) if el_id else None
    text = layout_index["texts"].get(text_id) if text_id else None
    fix = primary_fix(issue, layout_index)

    lines: list[str] = []
    head_target = el_id or (text_ids[0] if text_ids else text_id) or "?"
    lines.append(f"### [#{idx}] {t} — `{head_target}`")
    lines.append("")
    lines.append("| 항목 | 값 |")
    lines.append("| --- | --- |")
    lines.append(f"| confidence | `{issue.get('confidence', '?')}` |")
    lines.append(f"| severity | `{issue.get('severity', '?')}` |")
    if text:
        lines.append(f"| 텍스트 | {truncate(text.get('text', ''))} |")
    if text_ids:
        lines.append(f"| 텍스트 노드 | {' ↔ '.join(text_ids)} |")
    if el:
        tag = el.get("tag", "?")
        role = el.get("role")
        accname = el.get("accessible_name")
        ident = f"`<{tag}>`"
        if role: ident += f" role=`{role}`"
        if accname: ident += f" / aria-label “{truncate(accname, 40)}”"
        lines.append(f"| 부모 요소 | {ident} (`{el_id}`) |")
        lines.append(f"| 부모 bbox | {fmt_bbox(el.get('bbox'))} |")
    if issue.get("bbox"):
        lines.append(f"| 영향 bbox | {fmt_bbox(issue.get('bbox'))} |")

    metrics = issue.get("metrics") or {}
    if metrics:
        m_str = json.dumps(metrics, ensure_ascii=False, default=str)
        lines.append(f"| metrics | `{truncate(m_str, 120)}` |")
    lines.append("")

    style_keys = STYLE_KEYS_BY_TYPE.get(t, [])
    if el and style_keys:
        lines.append("**현재 CSS (부모):**")
        lines.append("")
        lines.append(style_summary(el.get("style"), style_keys))
        lines.append("")

    lines.append("**권장 수정:**")
    lines.append("")
    lines.append(f"1. {fix['primary']}")
    for j, alt in enumerate(fix["alternates"], start=2):
        lines.append(f"{j}. {alt}")
    lines.append("")
    if fix.get("note"):
        lines.append(f"_근거_: {fix['note']}")
        lines.append("")

    return "\n".join(lines)


# ---------- main ---------- #

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: build_fix_prompt.py <workdir>", file=sys.stderr)
        sys.exit(1)
    work = Path(sys.argv[1])
    out_dir = work / "output"
    out_dir.mkdir(parents=True, exist_ok=True)

    dom_path = work / "dom.json"
    layout_path = out_dir / "layout.json"
    issues_path = out_dir / "issues.json"

    if not layout_path.exists() or not issues_path.exists():
        print("missing layout.json or issues.json — run detect_anomalies.py first.",
              file=sys.stderr)
        sys.exit(1)

    dom = json.loads(dom_path.read_text(encoding="utf-8")) if dom_path.exists() else {}
    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    issues = json.loads(issues_path.read_text(encoding="utf-8")).get("issues", [])

    meta = dom.get("meta", {}) or {}
    url = meta.get("url") or "(image-only)"
    viewport = meta.get("viewport") or {}
    image_only = bool(meta.get("image_only"))

    # index for fast lookup
    layout_index = {
        "elements": {e["id"]: e for e in layout.get("elements", [])},
        "texts":    {t["id"]: t for t in layout.get("texts", [])},
    }

    confirmed = [i for i in issues if i.get("confidence") == "confirmed"]
    suspected = [i for i in issues if i.get("confidence") == "suspected"]
    warnings  = [i for i in issues if i.get("confidence") == "warning"]

    md: list[str] = []
    md.append("# UI Text Audit — 개선 방안 프롬프트")
    md.append("")
    md.append(f"_생성: {_dt.datetime.now().isoformat(timespec='seconds')}_")
    md.append("")
    md.append("> 이 문서는 `ui-text-audit` 스킬이 자동 생성한 **결정적 템플릿**입니다.")
    md.append("> 사람이 한 번 검토한 뒤 코딩 LLM(Claude Code / Codex / Cursor) 에 그대로 붙여 작업을 위임할 수 있습니다.")
    md.append("> 같은 입력에 대해 항상 같은 프롬프트가 생성됩니다.")
    md.append("")

    md.append("## 컨텍스트")
    md.append("")
    md.append(f"- 원본: `{url}`")
    if viewport:
        md.append(f"- Viewport: {viewport.get('width', '?')} × {viewport.get('height', '?')}")
    md.append(f"- 입력 모드: {'image-only (DOM 신호 없음)' if image_only else 'DOM-first'}")
    md.append(f"- Screenshot: `{(work / 'screenshot.png').as_posix()}`")
    md.append(f"- Annotated: `{(out_dir / 'screenshot.annotated.png').as_posix()}`")
    md.append(f"- layout.json: `{layout_path.as_posix()}`")
    md.append(f"- issues.json: `{issues_path.as_posix()}`")
    md.append("")

    md.append("## 요약")
    md.append("")
    md.append(f"- Confirmed: **{len(confirmed)}** (수정 권장)")
    md.append(f"- Suspected: **{len(suspected)}** (디자인 의도 확인 필요)")
    if warnings:
        md.append(f"- Warnings: **{len(warnings)}** ({', '.join({w.get('type', '?') for w in warnings})})")
    md.append("")

    md.append("## 작업 순서")
    md.append("")
    md.append("1. **Confirmed 먼저** — 시각 증거가 명확하므로 우선 수정.")
    md.append("2. **Suspected 검토** — 사람이 디자인 의도를 한 번 확인 후 결정.")
    md.append("3. 수정 후 같은 URL 로 스킬을 다시 돌려 회귀 여부 확인.")
    md.append("4. (선택) `tesseract` 미설치 경고가 있으면 `references/installation.md` 참고해 설치.")
    md.append("")

    if confirmed:
        md.append("## Confirmed issues (수정 권장)")
        md.append("")
        for i, iss in enumerate(confirmed, start=1):
            md.append(render_issue(i, iss, layout_index))
            md.append("---")
            md.append("")

    if suspected:
        md.append("## Suspected issues (검토 후 결정)")
        md.append("")
        for i, iss in enumerate(suspected, start=1):
            md.append(render_issue(i, iss, layout_index))
            md.append("---")
            md.append("")

    if warnings:
        md.append("## 경고")
        md.append("")
        for w in warnings:
            md.append(f"- **{w.get('type')}** — {w.get('message', '')}  ")
            if w.get("remedy"):
                md.append(f"  해결: `{w['remedy']}`")
        md.append("")

    md.append("## LLM 에게 작업 지시할 때 (예시 프롬프트)")
    md.append("")
    md.append("> 다음은 위 issues 를 코딩 LLM 에 그대로 붙여서 쓸 수 있는 예시 프롬프트입니다.")
    md.append("")
    md.append("```text")
    md.append("아래 UI Text Audit 결과의 Confirmed issue 들을 CSS 변경만으로 해결해주세요.")
    md.append("Suspected issue 는 건드리지 마세요 — 별도 디자인 검토 후 결정합니다.")
    md.append("")
    md.append(f"원본 URL: {url}")
    if viewport:
        md.append(f"Viewport: {viewport.get('width')}x{viewport.get('height')}")
    md.append("Annotated screenshot 와 layout.json/issues.json 을 함께 첨부합니다.")
    md.append("")
    md.append("작업 결과는 `git diff` 형태로 보여주세요. HTML 구조는 유지하고 CSS 만 변경합니다.")
    md.append("```")
    md.append("")

    out_path = out_dir / "fix-prompt.md"
    out_path.write_text("\n".join(md), encoding="utf-8")

    summary = {
        "ok": True,
        "fix_prompt": str(out_path),
        "confirmed": len(confirmed),
        "suspected": len(suspected),
        "warnings": len(warnings),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
