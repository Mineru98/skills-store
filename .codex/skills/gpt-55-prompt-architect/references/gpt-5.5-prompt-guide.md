# GPT-5.5 Prompt Guide

GPT-5.5 works best with concise, outcome-first prompts.

Define the target result, success criteria, constraints, available evidence, and final output shape. Avoid carrying over large legacy prompt stacks that over-specify process unless each rule is truly required.

## Core Principles

- Start with the desired outcome.
- Keep instructions short and high signal.
- Use absolute words like `always`, `never`, and `must` only for true invariants.
- Give the model room to choose an efficient solution path.
- Add explicit stopping conditions for search, retries, and validation.
- Validate outputs with tools when validation is possible.

## Recommended Prompt Structure

Use this shape for complex prompts:

```text
Role: [1-2 sentences defining the assistant's job]

# Personality
[tone, collaboration style, and directness]

# Goal
[user-visible outcome]

# Success criteria
[what must be true before final answer]

# Constraints
[policy, safety, business, evidence, and side-effect limits]

# Output
[sections, length, style, and format]

# Stop rules
[when to retry, fallback, ask, or stop]
```

## Personality and Collaboration Style

Separate voice from workflow.

- Personality controls tone, warmth, formality, humor, empathy, and polish.
- Collaboration style controls when to ask questions, make assumptions, use tools, explain uncertainty, and check work.

Keep both short. Personality should shape the user experience. It should not replace goals, constraints, evidence rules, or validation requirements.

Good collaboration rules:

- Prefer progress over clarification when the request is clear enough.
- Ask only when missing information materially changes the result or creates risk.
- Be concise without being curt.
- Give enough context for trust, then stop.
- Correct errors directly and focus on the fix.

## Preambles for Tool-Heavy Work

For multi-step or tool-heavy workflows, start with a short visible update before tool calls.

A good preamble:

- acknowledges the request
- states the first concrete step
- stays within one or two sentences

This improves perceived responsiveness without adding unnecessary process text.

## Outcome-First Prompting

Describe the destination more than the path.

Prefer:

```text
Resolve the customer's issue end to end.

Success means:
- the eligibility decision is made from policy and account data
- any allowed action is completed before responding
- the final answer includes completed_actions, customer_message, and blockers
- if evidence is missing, ask for the smallest missing field
```

Avoid prompts that force every internal step unless each step is required for correctness or compliance.

## Stopping Conditions

Add stop rules so the model knows when enough work is enough.

Example:

```text
Resolve the query in the fewest useful tool loops, but do not let speed outrank correctness, citations, calculations, or required validation.

After each result, ask: Can I answer the core request now with useful evidence? If yes, answer.
```

Use missing-evidence behavior:

```text
Use the minimum evidence sufficient to answer correctly. Cite it precisely. If required evidence is missing, ask for the smallest missing field.
```

## Formatting Guidance

Let formatting serve comprehension.

- Use plain paragraphs for normal explanations and reports.
- Use headers, bullets, and numbered lists when they improve scanning.
- Preserve the user's requested structure and length.
- For senior business audiences, put the conclusion first and keep caveats short.
- For editing tasks, preserve the artifact, genre, structure, and claims before polishing style.

Avoid adding extra sections, unsupported claims, or a more promotional tone unless requested.

## Grounding and Retrieval Budgets

For grounded answers, define what needs evidence and when search should stop.

Default retrieval budget:

- Start with one broad search using short, discriminative keywords.
- Answer from top results if they support the core request.
- Search again only when a required fact, parameter, owner, date, ID, source, document, or code artifact is missing.
- Search again when the user asks for exhaustive coverage, comparison, or a comprehensive list.
- Do not search again just to improve phrasing or cite nonessential details.

Absence of evidence is not automatically evidence of absence. If evidence is missing, state the gap or ask for the smallest missing input.

## Creative Drafting Guardrails

Separate source-backed claims from creative wording.

For slides, launch copy, summaries, talk tracks, and narrative framing:

- Use provided or retrieved facts for concrete product, metric, roadmap, date, customer, and competitive claims.
- Do not invent names, metrics, customer outcomes, roadmap status, or product capabilities.
- If support is thin, write a useful generic draft with placeholders or labeled assumptions.

## Frontend and Visual Work

For frontend prompts, include product context and quality expectations.

Specify:

- target user and primary task
- [redacted] alignment
- first-screen priority
- expected loading, empty, error, and success states
- responsive behavior
- accessibility requirements
- visual defaults to avoid

Avoid generic generated-UI patterns such as decorative gradients without purpose, nested cards, instructional filler text, broken spacing, and layouts that only work at one viewport.

## Validation Loops

Ask the model to check work when tools are available.

For coding:

```text
After making changes, run the most relevant validation available:
- targeted tests for changed behavior
- type checks or lint checks when applicable
- build checks for affected packages
- a minimal smoke test when full validation is too expensive

If validation cannot run, explain why and describe the next best check.
```

For visual artifacts:

```text
Render the artifact before finalizing. Inspect layout, clipping, spacing, missing content, and consistency. Revise until it matches the requirements.
```

For implementation plans, include:

- requirements and where each is addressed
- named files, APIs, resources, or systems
- state transitions or data flow
- validation commands or checks
- failure behavior
- privacy and security considerations
- open questions that materially affect implementation

## Phase Handling for Responses Workflows

For long-running or tool-heavy Responses workflows, preserve assistant item phases when your API surface emits or accepts them during manual replay.

- Use `phase: "commentary"` for intermediate user-visible updates when supported.
- Use `phase: "final_answer"` for completed answers when supported.
- Preserve original phase values exactly when replaying assistant items.
- Do not add phase metadata to user messages.

## Migration Checklist from GPT-5.4 or Older Prompt Stacks

- Remove process-heavy legacy instructions that no longer change outcomes.
- Keep true invariants, safety rules, required output fields, and tool constraints.
- Re-test lower reasoning effort settings before escalating.
- Keep preambles for tool-heavy workflows.
- Preserve phase handling in manual assistant-item replay.
- Add retrieval budgets and validation loops where they improve correctness.

## Quick Template

```text
Role: You are a capable task-focused assistant for [domain].

# Personality
Direct, steady, and concise. Make progress when the request is clear enough. Ask only when missing information would materially change the result.

# Goal
[Describe the user-visible outcome.]

# Success criteria
- [Criterion 1]
- [Criterion 2]
- [Validation or evidence requirement]

# Constraints
- [True invariant]
- [Evidence or safety rule]
- [Side-effect limit]

# Output
[Format, length, sections, tone.]

# Stop rules
Stop once the core request is answered with sufficient evidence and required validation. If evidence is missing, ask for the smallest missing field.
```
