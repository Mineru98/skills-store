# DESIGN.md Manual Review Checklist

Use this when the `@google/design.md` CLI is unavailable (offline, sandboxed, proxy blocked). It cannot replace the linter — contrast ratios and reference graphs are tedious to verify by hand — but it will catch the structural issues.

State clearly in your report that the result is a **manual review**, not a CLI lint.

---

## 1. Front matter shape

- [ ] Begins with a line containing exactly `---`, ends with another `---` line.
- [ ] Valid YAML between the fences (no tabs in indent, consistent spacing).
- [ ] `name:` is present and is a string.
- [ ] `version:` is omitted or set to `alpha` (current version).
- [ ] `description:` is omitted or a string.

## 2. Token groups

For each present group, check the inner shape:

### `colors`
- [ ] Map of `<name>: "#RRGGBB"`.
- [ ] Hex strings are 7 chars (`#` + 6 hex). 3-char shorthand `#fff` is **not** in spec.
- [ ] At least `primary` is defined (warning if missing).

### `typography`
- [ ] Map of `<name>: { fontFamily, fontSize, … }`.
- [ ] Every `fontSize` / `letterSpacing` value has a unit (`px`, `em`, `rem`).
- [ ] `lineHeight` is a Dimension (`24px`, `1.5rem`) **or** a unitless number (`1.6`); both are legal.
- [ ] `fontWeight` is a number — bare or quoted, both fine.
- [ ] `fontFeature` / `fontVariation` are strings if present.

### `rounded`
- [ ] Map of `<scale>: <Dimension>`. Common scales: `none`, `sm`, `md`, `lg`, `xl`, `full`.

### `spacing`
- [ ] Map of `<scale>: <Dimension | number>`. Unitless numbers are accepted (often used for column counts).

### `components`
- [ ] Map of `<component-name>: { ...properties }`.
- [ ] Allowed properties: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`. Unknown properties are accepted **with a warning**, not an error.
- [ ] Property values are either literals or token references.
- [ ] Variants follow the suffix convention: `button-primary`, `button-primary-hover`, `button-primary-active`.

## 3. Token references

For every `{path.to.token}` reference:
- [ ] The path resolves to a defined token in the front matter.
- [ ] Outside `components`, the path resolves to a **primitive** value (not a group).
- [ ] Inside `components`, references to composite values are allowed (`{typography.label-md}`).

## 4. Section order

Sections that are present must appear in this order. Missing sections are fine.

1. **Overview** (or **Brand & Style**)
2. **Colors**
3. **Typography**
4. **Layout** (or **Layout & Spacing**)
5. **Elevation & Depth** (or **Elevation**)
6. **Shapes**
7. **Components**
8. **Do's and Don'ts**

- [ ] No two `##` headings have the same name (duplicate = hard error).
- [ ] An optional `<h1>` at the very top is allowed and ignored.

## 5. Body / prose

- [ ] Each section has at least one paragraph or list of guidance.
- [ ] Color references in prose use a descriptive name *and* a hex (`Primary (#1A1C1E)`), so a reader can see both the brand label and the systematic value.
- [ ] Do's and Don'ts uses the imperative form (`Do …`, `Don't …`).

## 6. Contrast (best-effort by hand)

For each component with both `backgroundColor` and `textColor`:
- [ ] Resolve both to literal hex values (chase the references).
- [ ] Eyeball-compare against a reference: pure black on white is 21:1; mid-grey on white (`#777` on `#fff`) is roughly the 4.5:1 floor; light grey on white (`#aaa` on `#fff`) fails.
- [ ] If any pair looks marginal, flag it for a CLI re-check when connectivity returns.

Manual contrast review will miss subtle violations. Always re-run the CLI as soon as it's reachable.

## 7. Sanity

- [ ] No `TODO`, `XXX`, or `FIXME` markers in the prose.
- [ ] No placeholder color values (`#000000` for "fill in later", `#ff00ff` debug).
- [ ] Token names follow a consistent convention (kebab-case throughout, or camelCase throughout — not mixed).

---

When done, summarise findings in the same template used for the CLI report, but prefix the summary line with `**Manual review (CLI unavailable):**`.
