# DESIGN.md Spec Summary

Source: https://github.com/google-labs-code/design.md at commit `8ecd4645b957e6a683a05fb9c79cd6c9028873d0` observed 2026-04-30.

DESIGN.md combines optional YAML front matter with markdown prose. Tokens are normative. Prose explains how to apply them.

## Token Schema

```yaml
version: <string>          # optional, current: "alpha"
name: <string>
description: <string>      # optional
colors:
  <token-name>: <Color>
typography:
  <token-name>: <Typography>
rounded:
  <scale-level>: <Dimension>
spacing:
  <scale-level>: <Dimension | number>
components:
  <component-name>:
    <token-name>: <string | token reference>
```

Color values are sRGB hex strings like `"#1A1C1E"`.

Dimensions are numbers with `px`, `em`, or `rem`, such as `16px` or `-0.02em`.

Token references use `{path.to.token}`, such as `{colors.primary}`. Component references may point to composite values like `{typography.label-md}`.

Typography supports `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `fontFeature`, and `fontVariation`.

## Section Order

Known `##` sections may be omitted, but when present they should appear in this order:

1. Overview, alias Brand & Style
2. Colors
3. Typography
4. Layout, alias Layout & Spacing
5. Elevation & Depth, alias Elevation
6. Shapes
7. Components
8. Do's and Don'ts

Unknown section headings should be preserved and should not be treated as errors. Duplicate known section headings are invalid per the spec.

## Component Properties

Valid component sub-tokens:

- `backgroundColor`
- `textColor`
- `typography`
- `rounded`
- `padding`
- `size`
- `height`
- `width`

Variants such as hover or active states are represented as related component keys, for example `button-primary`, `button-primary-hover`, and `button-primary-active`.

## Default Lint Rules

- `broken-ref`, error: token references that do not resolve.
- `missing-primary`, warning: colors exist but `colors.primary` does not.
- `contrast-ratio`, warning: component `backgroundColor` and `textColor` fail WCAG AA 4.5:1.
- `orphaned-tokens`, warning: color tokens are defined but never referenced by components.
- `token-summary`, info: token count summary.
- `missing-sections`, info: spacing or rounded tokens are absent.
- `missing-typography`, warning: colors exist but typography tokens are absent.
- `section-order`, warning: known markdown sections are out of canonical order.

## CLI Commands

```bash
npx --yes @google/design.md lint --format json DESIGN.md
npx --yes @google/design.md diff DESIGN.before.md DESIGN.md --format json
npx --yes @google/design.md export --format tailwind DESIGN.md
npx --yes @google/design.md export --format dtcg DESIGN.md
npx --yes @google/design.md spec --rules
```

`lint` exits 1 when errors are found. `diff` exits 1 when the after file has more errors or warnings than the before file.
