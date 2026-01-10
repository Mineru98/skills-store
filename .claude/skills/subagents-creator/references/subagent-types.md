# Subagent Types

This guide details when and how to use each subagent type.

## Explore Agent

**Purpose**: Contextual grep for codebases - internal pattern discovery

**Cost**: FREE

**When to Use**:

| Use This | Not This |
|----------|-----------|
| Finding how existing code works | Searching external resources |
| Pattern discovery across modules | Simple one-file lookups |
| Cross-layer analysis | Known file locations |
| Unfamiliar module structure | Obvious syntax errors |

**Use Cases**:
- "How does authentication work in this codebase?"
- "Find all error handling patterns"
- "Where is the database connection logic?"
- "What patterns are used for state management?"

**Key Characteristics**:
- Searches YOUR codebase only
- Works like grep on steroids - understands context and relationships
- Fire liberally - it's free and fast

---

## Librarian Agent

**Purpose**: Reference search for external resources - docs, OSS, web

**Cost**: CHEAP

**When to Use**:

| Use This | Not This |
|----------|-----------|
| Searching EXTERNAL resources | Searching YOUR codebase |
| Library documentation | Internal patterns |
| OSS implementation examples | How your code works |
| Official API references | Project-specific logic |

**Use Cases**:
- "How do I use [library] properly?"
- "What are the best practices for [framework]?"
- "Find examples of [pattern] in open source"
- "Why does [dependency] behave this way?"

**Trigger Phrases** (fire immediately):
- "How do I use [library]?"
- "What's the best practice for [framework feature]?"
- "Why does [external dependency] behave this way?"
- "Find examples of [library] usage"
- "Working with unfamiliar npm/pip/cargo packages"

**Key Characteristics**:
- Uses GitHub CLI, Context7, Web Search
- Searches OTHER codebases and docs
- CHEAP - use proactively for unfamiliar libraries

---

## Oracle Agent

**Purpose**: Deep reasoning for architecture and complex decisions

**Cost**: EXPENSIVE (GPT-5.2)

**When to Use**:

| Use This | Not This |
|----------|-----------|
| Complex architecture design | Simple file operations |
| Multi-system tradeoffs | First attempt at fixes |
| 2+ failed fix attempts | Questions answerable from code |
| Unfamiliar code patterns | Trivial decisions |
| Security/performance concerns | Things inferable from patterns |

**Use Cases**:
- "What's the best architecture for [X]?"
- "I've tried 3 approaches and nothing works"
- "This code pattern is unfamiliar - should I change it?"
- "Is there a security issue with [design]?"

**When NOT to Use**:
- Simple file operations (use direct tools)
- First attempt at any fix (try yourself first)
- Questions answerable from code you've read
- Trivial decisions (variable names, formatting)

**Key Characteristics**:
- High-quality reasoning model
- EXPENSIVE - use sparingly and strategically
- ALWAYS announce "Consulting Oracle for [reason]" before invocation

---

## Frontend-UI-UX-Engineer Agent

**Purpose**: Visual and UX-focused frontend development

**Cost**: CHEAP

**When to Use**:

| Use This (Visual) | Not This (Logic) |
|-------------------|------------------|
| Colors, spacing, layout | API calls, data fetching |
| Typography, icons | State management |
| Animation, transitions | Event handlers (non-visual) |
| Responsive breakpoints | Type definitions |
| Hover states, shadows | Utility functions |
| Borders, margins, padding | Business logic |

**Decision Gate**: Before touching frontend files, think:
> "Is this change about **how it LOOKS** or **how it WORKS**?"

- **LOOKS** (colors, sizes, positions, animations) → DELEGATE
- **WORKS** (data flow, API integration, state) → Handle directly

**Visual Keywords** (DELEGATE if any involved):
- style, className, tailwind
- color, background, border, shadow
- margin, padding, width, height
- flex, grid, animation, transition
- hover, responsive, font-size
- icon, svg

**Key Characteristics**:
- Designer-turned-developer
- Crafts stunning UI/UX even without design mockups
- Code may be messy, but visual output is excellent

---

## Summary Table

| Subagent | Cost | Primary Domain | Trigger |
|----------|------|----------------|---------|
| `explore` | FREE | Internal codebase patterns | "How does X work in this codebase?" |
| `librarian` | CHEAP | External references (docs, OSS) | "How do I use [library]?", "Best practices for [framework]" |
| `oracle` | EXPENSIVE | Complex reasoning/architecture | 2+ failed attempts, unfamiliar patterns |
| `frontend-ui-ux-engineer` | CHEAP | Visual/UI/UX changes | style, layout, colors, animation keywords |

---

## Parallel Execution Pattern

**Default Behavior**: Always fire explore and librarian agents in parallel via `background_task`, never wait synchronously.

```python
# CORRECT: Parallel, non-blocking
explore_task = background_task(agent="explore", prompt="Find auth patterns...")
librarian_task = background_task(agent="librarian", prompt="Find JWT best practices...")
# Continue working immediately
# Collect results when needed: background_output(task_id=...)

# WRONG: Sequential or blocking
result = task(agent="explore", ...)  # Never wait synchronously
```

---

## Background Result Collection

1. Launch parallel agents → receive task_ids
2. Continue immediate work
3. When results needed: `background_output(task_id="...")`
4. **BEFORE final answer**: `background_cancel(all=true)`
