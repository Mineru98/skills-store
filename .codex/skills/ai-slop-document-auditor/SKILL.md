---
name: ai-slop-document-auditor
description: Check whether Korean document content feels AI-written across files such as PDF, Markdown, TXT, PPT/PPTX, HTML, DOCX, or pasted text by extracting text read-only, delegating to the Codex agents ai-slop-detector, ai-slop-guardrail, and optionally ai-slop-rewriter, then producing a concise audit verdict with evidence and remediation guidance. Use when asked to inspect arbitrary documents for AI-feel, AI slop, AI-written tone, generic AI business copy, or to produce a document-level AI-feel audit.
---

# AI-Slop Document Auditor

## Purpose

Use this skill to inspect Korean document content and decide whether it has an AI-written feel. This is an orchestration skill: extract document text, preserve source locations, run detector and guardrail, and use the rewriter only when rewrites are requested or replacement copy is part of the deliverable.

Primary Codex agents:

- `ai-slop-detector`: line-level AI-feel pattern tags.
- `ai-slop-guardrail`: forbidden expressions and risky structures.
- `ai-slop-rewriter`: optional rewrite of flagged Korean business copy.

## Inputs

Accept:

- File paths: `.pdf`, `.md`, `.txt`, `.ppt`, `.pptx`, `.html`, `.htm`, `.docx`, `.rtf`, `.csv`, `.json`.
- Pasted text.
- A directory of documents, when the user asks for batch review.

Treat source files as read-only. Do not modify, delete, move, or rewrite the original document unless the user explicitly asks for a separate output file.

Scope bridge: arbitrary documents can be ingested, but the calibrated judgment target is Korean business-copy-like text: headings, PPT titles, bullets, CTAs, section intros, executive summaries, product copy, and proposal copy. Treat long narrative body text as sampled supporting evidence, not as the primary detector target. Lower confidence when a prose-heavy document has only limited high-signal units.

## Workflow

### 1. Normalize the source

Extract text into stable units before judging style.

Each unit should keep enough location metadata for the final report:

```yaml
document_units:
  - unit_id: "u001"
    source_path: "path/to/file.pdf"
    page_or_slide: "p003"
    block_id: "p003-b002"
    role: "title|heading|bullet|cta|body|note|table_cell|unknown"
    text: "원문 텍스트"
```

Use deterministic IDs so repeated runs can be compared:

- PDF/DOCX/RTF pages: `docNN-p003-b002`.
- PPT/PPTX slides: `deckNN-s003-sh002-l001`.
- HTML headings/blocks: `htmlNN-h2-003` or `htmlNN-b014`.
- Pasted text: `pasteNN-b001`.

Extraction guidance:

- `.md`, `.txt`, `.json`, `.csv`: read directly.
- `.html` / `.htm`: prefer visible text. Ignore scripts, styles, metadata, nav boilerplate, cookie banners, and repeated footer text when obvious.
- `.ppt` / `.pptx`: preserve slide order and shape order. Keep slide IDs and line IDs stable.
- `.pdf`: preserve page order. Use available local tools such as `pdftotext`, `python`, or `textutil` only for read-only extraction.
- `.docx` / `.rtf`: use available local tools such as `textutil`, unzip/XML reading, or Python libraries only for read-only extraction.

If extraction quality is poor, report that as a confidence limit instead of guessing.

Keep a short extraction manifest in working notes and summarize it in `Limits` when relevant:

- Source path or paste label.
- Extractor/tool used.
- Pages, slides, or sections seen.
- Units included and skipped.
- Sampling rule.
- Extraction or OCR confidence limits.

### 2. Scope the audit

Classify units before delegating:

- High-signal units: headings, slide titles, bullets, CTA, section intros, executive summaries, product or proposal copy.
- Lower-signal units: legal boilerplate, tables of numbers, citations, code, bibliography, raw logs.

Prioritize high-signal units. Sampling must be deterministic: include all headings, bullets, CTAs, section intros, summaries, and proposal/product copy. For long prose sections, include the first paragraph, last paragraph, and every fifth paragraph, capped at five prose units per section unless the user asks for full coverage.

### 3. Delegate detection

Use the Codex native subagent surface with agent type `ai-slop-detector` for line-level tags.

Equivalent call shape on surfaces that expose a `task` helper:

```text
task(subagent_type="ai-slop-detector", load_skills=[], prompt="<delegation prompt>")
```

Delegation prompt shape:

```text
TASK: Identify AI-feel pattern tags in the supplied document units.
EXPECTED OUTCOME: Return only unit_id -> detector tags. No rewriting, scoring, or long explanation.
REQUIRED AGENT: ai-slop-detector.
REQUIRED TOOLS: Read-only analysis only.
MUST DO: Preserve unit_id. Judge only observable surface signals. Use Korean AI-feel detector rules.
MUST NOT DO: Do not rewrite text. Do not invent missing context. Do not drop units silently.
CONTEXT: <document_units>
```

If native subagent delegation is unavailable in the current surface, read `.codex/agents/ai-slop-detector.toml`, apply its `developer_instructions` in-context, and clearly note that no separate detector agent was launched.

### 4. Delegate guardrails

Use the Codex native subagent surface with agent type `ai-slop-guardrail` for a compact forbidden-expression and forbidden-structure list.

Equivalent call shape on surfaces that expose a `task` helper:

```text
task(subagent_type="ai-slop-guardrail", load_skills=[], prompt="<delegation prompt>")
```

Delegation prompt shape:

```text
TASK: Derive AI-feel guardrails from the supplied document units and detector findings.
EXPECTED OUTCOME: Return only forbidden expressions and risky structures, grouped by pattern.
REQUIRED AGENT: ai-slop-guardrail.
REQUIRED TOOLS: Read-only analysis only.
MUST DO: Preserve human-like compression as allowed. Make conditional bans when context matters.
MUST NOT DO: Do not rewrite text. Do not make blanket bans from ambiguous signals.
CONTEXT: <document_units + detector findings>
```

If native subagent delegation is unavailable in the current surface, read `.codex/agents/ai-slop-guardrail.toml`, apply its `developer_instructions` in-context, and clearly note that no separate guardrail agent was launched.

### 5. Optional rewrite

Use `ai-slop-rewriter` only when the user asks to improve the content or when the audit deliverable explicitly includes suggested replacements.

Equivalent call shape on surfaces that expose a `task` helper:

```text
task(subagent_type="ai-slop-rewriter", load_skills=[], prompt="<delegation prompt>")
```

Delegation prompt shape:

```text
TASK: Rewrite only the flagged Korean business-copy units to reduce AI-feel.
EXPECTED OUTCOME: Return revised text preserving unit_id, source order, facts, hierarchy, and intent.
REQUIRED AGENT: ai-slop-rewriter.
REQUIRED TOOLS: Read-only source analysis; write only the requested draft output.
MUST DO: Keep names, figures, claims, constraints, and document structure.
MUST NOT DO: Do not add new facts. Do not rewrite low-signal boilerplate.
CONTEXT: <flagged document_units + detector tags + guardrails>
```

If native subagent delegation is unavailable in the current surface, do not rewrite unless the user explicitly requested rewrite output. For requested rewrites, read `.codex/agents/ai-slop-rewriter.toml` and apply its `developer_instructions` in-context.

## Verdict Rules

Produce a document-level verdict from the evidence:

- `Likely AI-feel`: repeated detector tags across multiple high-signal units, generic benefit escalation, symmetric bullet rhythm, abstract CTA promises, or title/bullet/CTA redundancy.
- `Mixed / Needs review`: isolated AI-like signals, strong human-like anchors mixed with generic polish, or extraction/context uncertainty.
- `Low AI-feel`: few or no detector tags in high-signal units, concrete domain anchors, uneven but purposeful compression, and visible information progression.

Do not claim authorship certainty. The verdict is about surface writing signals, not whether AI was actually used.

## Output Contract

Return this shape:

```markdown
# AI-Feel Audit

Verdict: Likely AI-feel | Mixed / Needs review | Low AI-feel
Confidence: High | Medium | Low

## Evidence
- `<unit_id>`: `<short excerpt>` -> `<detector tags>`

## Repeated Patterns
- `<pattern>`: `<where it appears>`

## Guardrails
- `<forbidden expression or structure>`

## Recommended Fixes
- `<revision direction only; no replacement text unless rewrite was requested>`

## Limits
- `<extraction gaps, unsupported pages, OCR uncertainty, sampling limits, or unavailable subagent delegation>`
```

For batch audits, add one short verdict per file before the shared pattern summary.

If rewrites are requested, add:

```markdown
## Rewrite Draft
- `<unit_id>`: `<revised text>`
```

Keep the report concise. Prefer evidence-bearing bullets over long rationale.

## Stop Conditions

The audit is complete when:

- Text was extracted or a clear extraction blocker was reported.
- Detector findings are mapped back to source units.
- Guardrails are derived from the findings.
- The verdict includes confidence and limits.
- Optional rewrites preserve original facts and structure.
