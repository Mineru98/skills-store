---
name: design-md-validator
description: Validate, review, and compare DESIGN.md design-system files using the Google `@google/design.md` specification and CLI. Trigger this skill whenever the user asks to lint / validate / verify / check / review / diff a `DESIGN.md` (case-insensitive), mentions "design.md", "design system spec", "design tokens YAML", "WCAG contrast on tokens", or uses Korean phrases like "DESIGN.md 검증", "디자인 시스템 검사", "디자인 토큰 점검", "design.md 린트". Also fire when the user pastes a YAML front-matter block that looks like a design-token document (top-level `colors:` / `typography:` / `components:` keys) or when a DESIGN.md file appears in the workspace and the conversation turns to validating, comparing, or shipping it. Covers YAML front matter, markdown section order, token references, component property validity, WCAG contrast findings, missing primary colors or typography, orphaned tokens, and regressions between two DESIGN.md versions.
---

# DESIGN.md Validator

## Overview

Validate DESIGN.md files before using them as design-system source of truth. Prefer the bundled script for repeatable checks, then interpret the JSON findings into concrete fixes.

## Quick Start

Run the validator against one file:

```bash
node .codex/skills/design-md-validator/scripts/validate_design_md.mjs DESIGN.md
```

Scan the current tree for likely DESIGN.md files:

```bash
node .codex/skills/design-md-validator/scripts/validate_design_md.mjs --discover .
```

Compare two versions for regressions:

```bash
node .codex/skills/design-md-validator/scripts/validate_design_md.mjs DESIGN.md --diff-before DESIGN.old.md
```

The script is a Node/npx wrapper around `npx --yes @google/design.md`, so Node/npm must be available. It returns nonzero when errors exist, or when warnings exist with `--strict-warnings`.

## Workflow

1. Locate the target file. Use `--discover` when the user says "check design.md" without naming a path.
2. Run the bundled validator. Use raw `npx @google/design.md lint --format json <file>` only if the wrapper is unavailable.
3. Treat `summary.errors > 0` as blocking. Fix errors before addressing warnings.
4. Explain warnings as design-system quality risks, not syntax failures.
5. Re-run validation after edits and report the final error/warning/info counts.
6. For migrations or updates, run `--diff-before` and treat `regression: true` as blocking unless the user explicitly accepts it.

## Finding Triage

- `broken-ref` error: define the missing token or update the reference path.
- Unknown component sub-token warning: rename to one of `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, or `width`, unless preserving a domain-specific extension is intentional.
- `missing-primary` warning: add `colors.primary` or document why another color role is the main brand color.
- `missing-typography` warning: add at least one typography token with `fontFamily` and `fontSize`.
- `contrast-ratio` warning: adjust component `backgroundColor` or `textColor` to meet WCAG AA 4.5:1 for normal text.
- `section-order` warning: reorder known `##` sections to match the canonical sequence.
- `orphaned-tokens` warning: either reference the token from components or remove it if unused.

## Reference

- `references/design-md-spec-summary.md` — schema, canonical section order, accepted component properties, CLI command reference.
- `references/lint-rules.md` — per-rule fix recipes for each of the eight lint rules.
- `references/spec-checklist.md` — manual review checklist for offline / sandboxed environments where `npx` cannot reach the registry.

## Known CLI quirks

- The `summary` block keys observed from the live CLI are `errors`, `warnings`, and `infos` (plural). The upstream README documents this as `info` (singular). Read both keys defensively when parsing JSON directly: `summary.infos ?? summary.info ?? 0`.
- Color values inside `components.*` may be `rgba(...)` literals (used for glass surfaces). Don't treat these as broken — they're accepted there even though `colors.*` only allows `#RRGGBB`.
- `npx --yes @google/design.md` does the install on first run; expect a 5-30s delay on a cold cache. The bundled wrapper waits for completion; if a caller hits a fixed timeout, retry once before treating the CLI as unreachable.

## Output

When reporting results, include:

- File path checked.
- Error, warning, and info counts.
- The highest-severity findings with paths.
- Exact fixes made, if any.
- Verification command rerun after edits.
