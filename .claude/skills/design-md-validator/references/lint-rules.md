# DESIGN.md Lint Rules

Per-rule detail for the eight rules run by `@google/design.md lint`. Each entry covers what the rule checks, why it matters, and the concrete fix.

> The rule IDs and severities below match the upstream CLI as of spec version `alpha`. If the CLI output disagrees with this doc, trust the CLI — it is the source of truth.

---

## error · `broken-ref`

**What** — A token reference like `{colors.primary-60}` that does not resolve to any token defined in the front matter.

**Why it matters** — Agents that consume DESIGN.md substitute these references at render time. A broken ref means an undefined value reaches the UI: either a runtime error, a literal string `{colors.primary-60}` shown as text, or a silent fallback that the designer did not approve.

**Common causes**
1. Typo in the path (`{color.primary}` instead of `{colors.primary}`).
2. The referenced token was renamed but the reference was not updated.
3. The reference points to a group, not a primitive (e.g. `{colors}` instead of `{colors.primary}`). References to composite values are only legal under `components.*`.

**Fix** — Either define the missing token, or update the reference to a token that exists. Ask the user which they intended; do not silently delete the reference.

---

## warning · `missing-primary`

**What** — `colors:` is defined but there is no `primary` color token.

**Why it matters** — Many agents auto-generate a `primary` if one isn't provided, and the auto-generated value is rarely what the brand wants. Defining `primary` explicitly removes that ambiguity.

**Fix** — Add `primary: "#…"` to `colors:`, choosing the brand's main accent. If the design genuinely uses a different naming scheme (e.g. Material's `primary-60`), you can leave it — the warning is informational. Tell the user this is a soft warning, not a blocker.

---

## warning · `contrast-ratio`

**What** — A component defines both a `backgroundColor` and a `textColor`, and the resolved pair has a contrast ratio below WCAG AA (4.5:1 for normal text).

**Why it matters** — Below 4.5:1, body text becomes hard to read for users with low vision. WCAG AA is the floor most regulated industries require.

**Fix**
1. Darken the text color or lighten the background until the ratio passes 4.5:1.
2. If the component is large display text (≥18pt regular or ≥14pt bold), 3:1 is acceptable — but the linter applies the stricter 4.5:1 by default. If you intentionally want the 3:1 floor, tell the user; do not silently dismiss the warning.
3. Use a contrast checker (e.g. `https://webaim.org/resources/contrastchecker/`) to find the smallest tweak that crosses the threshold.

Pure transparent / `rgba(...)` backgrounds (common in glassmorphism) cannot be checked deterministically — the linter may skip these or warn. Note the limitation in the report.

---

## warning · `orphaned-tokens`

**What** — A color token is defined in `colors:` but no component references it.

**Why it matters** — Orphans are dead code. They confuse future readers ("is this color reserved for something?") and bloat exports to Tailwind / DTCG.

**Fix**
1. If the orphan is intentional (reserved for a future component or used directly in prose), keep it and acknowledge the warning to the user.
2. If it's leftover from a refactor, remove it from `colors:`.
3. If a component should be using it but isn't, add the reference.

---

## warning · `missing-typography`

**What** — `colors:` is defined but `typography:` is empty or absent.

**Why it matters** — Agents fall back to default fonts (system stack, Times) when typography tokens are missing. Even a minimal `typography:` block (one `body-md`, one `headline-lg`) anchors the design.

**Fix** — Add at least `body-md` and one heading level. Choose a `fontFamily` the team has already settled on; don't invent one.

---

## warning · `section-order`

**What** — Markdown `##` sections appear in a different order than the canonical sequence.

**Canonical order**
1. Overview (alias: Brand & Style)
2. Colors
3. Typography
4. Layout (alias: Layout & Spacing)
5. Elevation & Depth (alias: Elevation)
6. Shapes
7. Components
8. Do's and Don'ts

**Why it matters** — Consistent order makes diffs across projects readable and lets agents locate sections deterministically.

**Fix** — Reorder the section blocks. Section content moves wholesale; do not split or merge sections to "fit" the order. An optional `<h1>` at the top is allowed and not parsed as a section.

---

## info · `missing-sections`

**What** — Optional sections (spacing, rounded, shapes, etc.) are absent.

**Why it matters** — Informational only — many designs don't need every section. Surface the list so the user can decide if anything important is missing.

**Fix** — Add the section if relevant; otherwise dismiss.

---

## info · `token-summary`

**What** — Counts of how many tokens are defined in each group: `colors: 12`, `typography: 6`, etc.

**Why it matters** — Sanity-check telemetry. A design with 60 colors and 2 typography levels is suspicious and worth a glance.

**Fix** — None. Use this to spot anomalies, not to "fix".

---

## Hard errors that reject the file (not in the rule list above)

Per the spec, the parser rejects (not just warns) when:
- A duplicate `##` section heading is present (e.g. two `## Colors`).
- The YAML front matter is malformed.
- A color value is not a `#RRGGBB` hex string and is not inside a component property where `rgba(...)` is allowed.

When the CLI reports a parse-level failure, the `findings` array may be incomplete — fix the parse error first, then re-lint.
