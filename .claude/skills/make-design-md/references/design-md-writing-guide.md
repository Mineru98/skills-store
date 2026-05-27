# DESIGN.md Writing Guide From Webpage Evidence

Use this guide after Playwright capture has produced `analysis.json`, `styles-summary.json`, `visual-verification.config.json`, and screenshots.

## Evidence Mapping

- Page title, meta description, hero copy, and repeated headings inform `name`, `description`, and Overview.
- Most frequent readable text colors inform `on-surface`, `primary`, and `secondary`.
- Action colors on buttons and links inform `tertiary` or `primary`, depending on brand role.
- Large background colors inform `neutral` and `surface`.
- Font-family frequency and heading/body samples inform typography tokens.
- Repeated gap/padding measurements inform spacing tokens.
- Border radius samples inform rounded tokens.
- Buttons, nav, cards, forms, badges, and tabs inform component tokens.
- Image dimensions, object-fit, crop positions, alt text, and media containers inform asset rules.
- SVGs, icon fonts, masks, and inline icon samples inform icon rules.
- Transitions, animations, sticky regions, blur, overlays, gradients, background images, and pseudo-elements inform motion and decoration rules.

## Required Minimum

Write at least:

```yaml
---
version: alpha
name: <short page or brand name>
description: <one sentence>
colors:
  primary: "#000000"
  secondary: "#666666"
  neutral: "#ffffff"
  surface: "#ffffff"
  on-surface: "#111111"
typography:
  headline-lg:
    fontFamily: <observed heading font>
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
  body-md:
    fontFamily: <observed body font>
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 4px
  md: 8px
spacing:
  sm: 8px
  md: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.md}"
    padding: 12px
---
```

Replace placeholder values with observed values. Add tokens when the page clearly uses them. Include state variants (`-hover`, `-active`, `-focus`, `-disabled`, `-selected`) for every interactive component that appears in the source or will be used in reproduction fixtures.

## Prose Sections

Use canonical `##` sections in this order:

1. Overview
2. Colors
3. Typography
4. Layout
5. Elevation & Depth
6. Shapes
7. Components
8. Do's and Don'ts

Each section should describe what the page actually does:

- Overview: visual personality, audience, density, motion/static feel, product category.
- Colors: semantic role of major colors and when to use them.
- Typography: hierarchy, font pairings, weight, casing, rhythm.
- Layout: grid, max width, section rhythm, responsive rules by viewport, and state/page coverage used by screenshots.
- Elevation & Depth: shadows, borders, tonal layering, glass/blur effects, overlays, and depth restrictions.
- Shapes: radius scale, sharp vs soft geometry, icon/container treatment, and decorative geometry rules.
- Components: repeated UI atoms, variants, expected states, disabled/focus behavior, and density rules.
- Do's and Don'ts: concrete guardrails for recreating the same identity.

## Deterministic Reproduction Requirements

Every generated `DESIGN.md` must include enough concrete guidance for two agents to build materially equivalent output from the same file. Keep the guidance inside the canonical sections above instead of adding custom top-level sections.

Required coverage:

- **Tokens:** colors with semantic roles and hex values; typography with exact family/fallback, size, weight, line-height, and casing; spacing/radius/elevation scales.
- **Components:** structure, measurements, token references, variants, and states for buttons, nav, cards, forms, chips, tabs, badges, lists, and any page-specific repeated blocks.
- **Layouts:** named page regions, max-widths, grid/column rules, section spacing, alignment, responsive breakpoints, and overflow behavior.
- **Assets/images:** image aspect ratios, object-fit, crop/focal point, treatment, empty states, and when not to use stock or abstract imagery.
- **Icons:** library/source if visible, stroke/fill style, size, alignment, color role, and when text labels are required.
- **Motion:** durations, easing, hover/focus transitions, scroll effects, sticky behavior, entrance effects, and reduced-motion fallback.
- **Decoration:** gradients, patterns, borders, dividers, background layers, blur/glass, shadows, and explicit things to avoid.

For each category, cite the evidence source in prose when practical: `analysis.json` component sample, screenshot band, or visual-analysis chunk. Avoid qualitative words without numbers or token names.

## Visual Verification Contract

The `DESIGN.md` must name the intended comparison surfaces in prose:

- Pages or mock fixtures to compare.
- Viewports such as desktop, tablet, and mobile.
- States such as default, hover, focus, selected, disabled, and reduced-motion when relevant.
- Pixel diff thresholds per page, viewport, and state. Start with `maxDiffRatio <= 0.01` and `maxDiffPixels <= 2500` unless the source has animations or remote media that justify a looser threshold.
- Repair policy: failed diffs are blockers and should update the weakest artifact first (`DESIGN.md`, capture settings, analysis prompts, export templates, or comparison fixtures), then rerun static validation and pixel comparison.
- Human approval policy: record reviewer, date, compared surfaces, and decision after automated gates pass or when an approved exception is needed.

## Validation Fixes

- `broken-ref`: point component references to existing tokens.
- `missing-primary`: add `colors.primary`.
- `missing-typography`: add typography tokens.
- `contrast-ratio`: adjust component foreground/background token pair.
- `section-order`: reorder sections.
- `orphaned-tokens`: reference important colors from components or remove unused colors.
- `deterministic-missing-*`: add concrete prose and token/component details for the missing category, then rerun `validate_deterministic_design_md.mjs`.
- `pixel-diff-threshold`: tighten the `visual-verification.config.json` threshold or document why a specific page/viewport/state needs a wider gate.
