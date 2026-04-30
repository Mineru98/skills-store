---
name: gpt-55-prompt-architect
description: Designs, migrates, and reviews GPT-5.5 prompts using outcome-first goals, retrieval budgets, concise style controls, validation loops, and explicit output shapes. Use this skill whenever creating a new GPT-5.5 prompt, converting older prompt stacks to GPT-5.5, reviewing agent/system/developer prompts, or tightening prompts for grounded tool use and evaluation.
---

# GPT-5.5 Prompt Architect

Use this skill to create, migrate, or review prompts so they work well with GPT-5.5.

Read `references/gpt-5.5-prompt-guide.md` when the task needs detailed guidance, migration rules, examples, or validation patterns. Treat it as the local source of truth.

## Mission

Produce prompts that define:

- the user-visible outcome
- concrete success criteria
- true constraints and side-effect limits
- evidence and retrieval rules
- validation or stopping conditions
- the expected output shape

## Core Rules

- Prefer outcome-first prompts over process-heavy prompt stacks.
- Keep instructions concise and high signal.
- Use `must`, `never`, `always`, and `only` only for real invariants.
- Use decision rules for judgment calls such as search depth, retries, escalation, and clarification.
- Separate personality from collaboration style.
- Add a short preamble requirement for multi-step or tool-heavy workflows.
- Define retrieval budgets for grounded answers.
- Require validation loops when tools can verify the result.
- Preserve `phase` metadata in Responses workflows that manually replay assistant items.

## Workflow

1. Identify the desired outcome and audience.
2. Extract success criteria, constraints, evidence needs, and side-effect limits.
3. Remove legacy process instructions that do not improve correctness.
4. Add retrieval budgets and stop rules for search-heavy prompts.
5. Add validation or evaluation checks when the result can be verified.
6. Return the prompt in the requested shape, or propose a ready-to-use replacement.

## Review Checklist

When reviewing a prompt, check:

1. Outcome: Is the target result explicit?
2. Success: Are completion criteria concrete and testable?
3. Constraints: Are hard rules limited to true invariants?
4. Evidence: Does the prompt say what needs sourcing or citation?
5. Retrieval: Is there a clear budget and stop condition?
6. Tools: Are tool use and validation rules specific but not over-scripted?
7. Output: Is format, verbosity, audience, and tone clear?
8. Risk: Are unsupported claims, invented facts, and unnecessary side effects blocked?

## Output Style

Return concise, actionable guidance.

For prompt rewrites, provide:

- a revised prompt
- why it is better for GPT-5.5
- validation or evaluation suggestions

For prompt reviews, provide:

- critical issues first
- recommended edits
- a ready-to-use replacement when feasible

## References

- `references/gpt-5.5-prompt-guide.md` - detailed GPT-5.5 prompt design guide and templates.
