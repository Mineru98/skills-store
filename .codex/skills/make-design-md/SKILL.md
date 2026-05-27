---
name: make-design-md
description: Analyze a live webpage URL with Playwright, capture non-overlapping scroll screenshots, inspect HTML/CSS/layout evidence, run parallel subagent image analysis, synthesize a Google DESIGN.md design-system file, validate it with the design-md-validator skill, then guide Tailwind or DTCG export. Use when the user gives a webpage URL and asks to create, infer, generate, extract, validate, export, or rebuild a DESIGN.md/design.md/design system/design tokens file from that page, including Korean requests such as "URL로 DESIGN.md 만들어줘", "웹페이지 디자인 분석", "디자인 토큰 추출", "design.md 생성", or "디자인 토큰 export".
---

# Make DESIGN.md

## Overview

Create a validated, deterministic `DESIGN.md` from a webpage URL by collecting browser evidence, analyzing visual/layout screenshots in parallel, writing tokens and prose, running completeness and spec validation, then gating cross-agent reproduction with visual comparison and human approval before export.

## Workflow

Follow this order exactly.

1. Create an artifact directory under the current project, for example `.omx/artifacts/make-design-md/<slug>/`.
2. Analyze HTML, CSS, asset, icon, motion, decoration, and screenshot evidence with Playwright by running the capture script:

```bash
npx --yes -p playwright node .codex/skills/make-design-md/scripts/capture_webpage_design.mjs "https://example.com" .omx/artifacts/make-design-md/example
```

3. Confirm that the script captured layouts while slowly scrolling without overlap. Use the `screenshots` manifest in `analysis.json`; adjacent entries with the same viewport and state must not overlap (`previous.yEnd <= next.yStart`). Keep the generated `visual-verification.config.json`; it is the baseline for later pixel-diff gates.
4. Run `codex login status` before screenshot image analysis.
5. If Codex is logged in, use Codex-capable image analysis for the screenshot set. Split screenshots across multiple native subagents and run them in parallel whenever more than one screenshot exists. Each subagent receives only its assigned image paths plus `analysis.json` context and reports visual findings. See `references/parallel-image-analysis.md`.
6. If Codex is not logged in or Codex image analysis is unavailable, still analyze screenshots with the best available local image inspection surface, but record that Codex image analysis was not available.
7. Combine HTML/CSS evidence from `analysis.json`, `styles-summary.json`, and all subagent image-analysis findings.
8. Write `DESIGN.md` in the target location using `references/design-md-writing-guide.md`. The draft must include deterministic reproduction guidance for tokens, components, states, layouts, responsive behavior, assets/images, icons, motion, and decoration rules.
9. Run the deterministic completeness checklist before the Google validator:

```bash
node .codex/skills/make-design-md/scripts/validate_deterministic_design_md.mjs DESIGN.md
```

10. If the checklist reports missing categories, return to step 8 and repair `DESIGN.md`.
11. Run `$design-md-validator` on the generated `DESIGN.md`:

```bash
node .codex/skills/design-md-validator/scripts/validate_design_md.mjs DESIGN.md
```

12. If validation reports errors or non-intentional warnings, return to step 8, rewrite `DESIGN.md`, then rerun steps 9 and 11. Repeat until errors are zero and remaining warnings are intentional.
13. Run the visual consistency gate after a Claude and Codex reproduction fixture or mock page exists. Use the generated config and define thresholds per page, viewport, and state:

```bash
npx --yes -p pixelmatch -p pngjs node .codex/skills/make-design-md/scripts/compare_design_screenshots.mjs .omx/artifacts/make-design-md/example/visual-verification.config.json
```

14. If pixel diff fails, automatically repair the relevant artifacts named in the gate result: `DESIGN.md`, capture settings, analysis prompts, export templates, or comparison fixtures/mock pages. Then rerun steps 9, 11, and 13. Pixel diff failures are blocking until the gate passes or a human explicitly records an approved exception.
15. Record human visual approval as final or complementary verification in the artifact directory, for example `human-approval.json` with reviewer, timestamp, scope, and decision.
16. After validation and visual approval are clean enough to ship, inspect the current project environment and recommend an export path. See `references/export-next-steps.md`.
17. Ask the user how to export, accepting numeric answers:

```text
검증이 끝났습니다. 다음 추출 방식을 선택해주세요.
1. Tailwind - 웹/앱 개발에서 Tailwind 기반 CSS 작업에 사용합니다. React, Next.js, React Native, Tauri 등 Tailwind를 쓰는 환경이면 추천합니다.
2. DTCG - Figma나 디자인 툴로 토큰을 넘겨 작업할 때 추천합니다.

추천: <Tailwind 또는 DTCG> - <현재 프로젝트 근거>
번호로 답해도 됩니다: 1 또는 2
```

18. Interpret `1`, `tailwind`, `Tailwind`, or Korean equivalents as Tailwind. Interpret `2`, `dtcg`, `DTCG`, `figma`, or Korean equivalents as DTCG.
19. If the user chooses Tailwind, export immediately, prepare the development handoff, inspect available skills, and propose a sample-page prompt that combines the useful skills. If the user chooses DTCG, export the DTCG JSON and report the file path.

## Capture Script

`scripts/capture_webpage_design.mjs` accepts:

```bash
npx --yes -p playwright node .codex/skills/make-design-md/scripts/capture_webpage_design.mjs <url> <output-dir> [--viewport-width 1440] [--viewport-height 900] [--viewports desktop:1440x900,mobile:390x844] [--max-shots 12] [--wait 1500] [--states default,hover,focus]
```

The script writes:

- `analysis.json` — structured HTML/CSS/layout evidence.
- `screenshots/viewport-*.png` — non-overlapping viewport captures from top to bottom.
- `page.html` — rendered DOM snapshot.
- `styles-summary.json` — extracted token candidates and component samples.
- `visual-verification.config.json` — page, viewport, state, and pixel-threshold defaults for cross-agent screenshot comparison.

If browser installation is missing, run `npx --yes playwright install chromium` once, then retry the capture.

## Parallel Screenshot Analysis

Before image analysis:

```bash
codex login status
```

When logged in, delegate screenshot analysis to multiple native subagents in parallel:

- Use one subagent per screenshot for small pages.
- Group adjacent screenshots when there are many captures, keeping each group visually contiguous.
- Ask subagents to analyze only visual evidence, not draft the final `DESIGN.md`.
- Require each subagent to report layout bands, typography hierarchy, color roles, component patterns, spacing/radius/elevation cues, and any visual inconsistencies.
- Require each subagent to report image/asset treatment, icon style, motion cues, decoration/background rules, responsive differences, and visible states.
- Merge subagent outputs with the HTML/CSS evidence before drafting.

Do not skip parallel image analysis just because `analysis.json` already contains CSS data. The image pass is required to catch composition, density, overlap, hierarchy, and brand feel that CSS sampling misses.

## DESIGN.md Drafting Rules

- Use observed evidence first. Do not invent brand values that are not visible in the page.
- Normalize colors to semantic tokens: `primary`, `secondary`, `tertiary`, `neutral`, `surface`, `on-surface`, `error` when supported by evidence.
- Include typography tokens for at least headline, body, label/caption when visible.
- Include spacing and rounded tokens so layout and shape do not fall back to agent defaults.
- Add component tokens only for repeated or important UI elements: buttons, cards, nav, inputs, chips, tabs, badges, list items.
- Put known sections in canonical order: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts.
- Keep prose specific enough for another agent to recreate the page's visual identity, not just pass lint.

## Validation Loop

Use this loop until stable:

1. Generate or revise `DESIGN.md` from the merged evidence.
2. Validate deterministic completeness with `validate_deterministic_design_md.mjs`.
3. Validate spec compliance with `$design-md-validator`.
4. Fix all errors.
5. Review warnings and fix any that weaken downstream design reuse.
6. Revalidate both gates.
7. Run the pixel-diff gate with `compare_design_screenshots.mjs` when reproduced screenshots are available.
8. If static or pixel gates fail, repair the weakest artifact named by the failure: `DESIGN.md`, capture settings, analysis prompts, export templates, or comparison fixtures. Then rerun the gates.
9. Stop the validation loop only when static completeness passes, `summary.errors` is `0`, remaining warnings are intentional, pixel diffs are within configured thresholds or explicitly approved, and human visual approval is recorded.
10. Continue to the export decision step; validation success alone is not the final stopping point.

## Export Decision

After validation succeeds, inspect the project before asking the user:

- Read `package.json` when present.
- Look for `tailwind.config.*`, `postcss.config.*`, `next.config.*`, `vite.config.*`, `app/`, `pages/`, `src/`, `android/`, `ios/`, `tauri.conf.*`, and React/Next/React Native/Tauri dependencies.
- Look for Figma/design-token workflows such as `tokens.json`, `*.tokens.json`, Style Dictionary config, or explicit design-tool references.

Recommend Tailwind when the project appears to use Tailwind or a web/app stack where Tailwind setup is useful: React, Next.js, React Native, Tauri, Vite, Remix, Astro, or similar.

Recommend DTCG when the likely next step is Figma/design-token exchange, design tooling, or no implementation stack is visible.

Use these export commands:

```bash
npx --yes @google/design.md export --format tailwind DESIGN.md > design.tailwind.json
npx --yes @google/design.md export --format dtcg DESIGN.md > design.tokens.json
```

If the user selects Tailwind:

1. Export `design.tailwind.json`.
2. Inspect the current development environment and identify framework/package manager/config files.
3. Inspect the available skills by reading local skill metadata, especially `.codex/skills/*/SKILL.md`.
4. Identify useful skill combinations for building a sample page, normally including `frontend-design`, `playwright-cli`, and `design-md-validator`; add framework-specific or repo-specific skills if present.
5. Propose an example prompt that asks Codex to build a sample page using the generated `DESIGN.md` and Tailwind export.

If the user selects DTCG:

1. Export `design.tokens.json`.
2. Explain that DTCG is appropriate for Figma/design-tool token workflows.
3. Report the output path and validation status.

## Final Report

Report:

- Source URL.
- Artifact directory.
- Generated `DESIGN.md` path.
- `codex login status` result and whether Codex image analysis was used.
- Number of screenshot-analysis subagents and screenshot groups.
- Validation command and final counts.
- Deterministic checklist command and final counts.
- Pixel diff command, configured thresholds, final diff result, and any repair iterations.
- Human visual approval status or explicit reason it remains pending.
- Remaining warnings, if any, with rationale.
- Export recommendation and the project evidence behind it.
- User export choice, when selected.
- Exported token file path, when generated.
- For Tailwind, the proposed sample-page prompt and skill combination.
