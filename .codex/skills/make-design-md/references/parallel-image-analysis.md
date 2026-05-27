# Parallel Image Analysis

Use this reference after the Playwright capture script writes `analysis.json` and `screenshots/viewport-*.png`.

## Preflight

Run:

```bash
codex login status
```

If logged in, use Codex-capable image analysis. If not logged in, continue with the best available local image analysis and record the limitation in the final report.

## Subagent Split

Use native subagents for screenshot analysis whenever available.

- 1-4 screenshots: one subagent per screenshot.
- 5-12 screenshots: group adjacent screenshots into 3-6 subagents.
- More than 12 screenshots: group by page region, such as hero, mid-page content, product/features, forms, footer.

Each group must be contiguous in scroll order. Do not mix unrelated page regions in the same group.

## Subagent Prompt Shape

Give each subagent:

- The URL.
- The artifact directory.
- The assigned screenshot image path or paths.
- The relevant `analysis.json` screenshot manifest entries.
- A narrow instruction: analyze visual layout evidence only.

Ask for:

- Layout bands and page regions.
- Typography hierarchy and casing.
- Main color roles and background/surface treatment.
- Repeated components and states.
- Spacing rhythm, max-width behavior, density.
- Shape language: radius, borders, dividers.
- Elevation/depth: shadows, overlays, blur, glass, layering.
- Asset and image treatment: aspect ratio, object-fit, crop/focal point, frames, overlays.
- Icon treatment: source/library clues, stroke/fill, size, color, alignment with labels.
- Motion and interaction cues: sticky regions, hover/focus/selected states, transition feel, reduced-motion risks.
- Decoration rules: gradients, patterns, dividers, background layers, texture, effects to avoid.
- Visual inconsistencies or responsive clues.
- Candidate DESIGN.md tokens inferred from the image.

Do not ask subagents to write the final `DESIGN.md`. The parent agent owns synthesis and validation.

## Merge Rules

After subagents return:

- Prefer CSS-computed values for exact tokens.
- Prefer image findings for hierarchy, layout feel, density, and visual emphasis.
- Resolve disagreements by checking the screenshot and `analysis.json`.
- Treat single-agent claims about assets, icons, motion, or decoration as hypotheses until confirmed by another screenshot chunk, DOM evidence, or computed-style evidence.
- Write a short repair note when a finding changes capture settings, analysis prompts, export templates, or comparison fixtures.
- Keep a short synthesis note in the artifact directory when useful, for example `visual-analysis-summary.md`.

The final `DESIGN.md` must reflect both machine evidence and visual evidence.
