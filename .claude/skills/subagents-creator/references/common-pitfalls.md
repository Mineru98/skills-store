# Common Pitfalls

Anti-patterns and how to avoid them when working with subagents.

## Vague Delegation Prompts

### The Problem

Vague prompts lead to subagent confusion, wrong outcomes, and wasted iterations.

### Examples

#### Bad: Too General

```python
# VAGUE - What does "auth stuff" mean?
background_task(
    agent="explore",
    prompt="Find auth stuff in the codebase"
)

# VAGUE - "Clean up" is subjective
task(
    agent="oracle",
    prompt="Clean up this function"
)

# VAGUE - No clear success criteria
background_task(
    agent="librarian",
    prompt="Find React best practices"
)
```

#### Good: Specific and Measurable

```python
# SPECIFIC - Clear what to find
background_task(
    agent="explore",
    prompt="""
    1. TASK: Find all authentication middleware and endpoint protection patterns
    2. EXPECTED OUTCOME: List of middleware files, protected endpoint patterns, and auth strategy used
    3. REQUIRED SKILLS: explore
    4. REQUIRED TOOLS: Grep, Read, Glob
    5. MUST DO: Search for 'auth', 'middleware', 'jwt', 'session'; identify protected routes; note auth strategy
    6. MUST NOT DO: Don't modify files; don't run tests
    7. CONTEXT: Express.js app in ./src
    """
)

# SPECIFIC - Clear objective
task(
    agent="oracle",
    prompt="""
    1. TASK: Refactor function to improve maintainability and reduce cyclomatic complexity
    2. EXPECTED OUTCOME: Refactored version with <10 complexity score, clear variable names, single responsibility
    3. REQUIRED SKILLS: oracle
    4. REQUIRED TOOLS: (oracle determines)
    5. MUST DO: Maintain identical behavior; improve testability; follow project conventions
    6. MUST NOT DO: Don't change function signature; don't add new features
    7. CONTEXT: Function in ./src/utils.js, needs to be more maintainable
    """
)

# SPECIFIC - Clear success criteria
background_task(
    agent="librarian",
    prompt="""
    1. TASK: Find React state management patterns for medium-to-large apps
    2. EXPECTED OUTCOME: 3-5 production examples with >1k stars, official docs excerpts, pattern comparison
    3. REQUIRED SKILLS: librarian
    4. REQUIRED TOOLS: GitHub CLI, Context7, Web Search
    5. MUST DO: Find patterns for local vs global state; note Redux/Context alternatives; include performance considerations
    6. MUST NOT DO: Don't include tutorials - only production code; don't return examples from repos with <100 stars
    7. CONTEXT: Building React 18 app, considering Context API vs Redux
    """
)
```

---

## Over-Delegating Trivial Tasks

### The Problem

Delegating simple tasks wastes tokens and slows down work.

### Examples

#### Bad: Delegating Trivial Tasks

```python
# BAD: This is one file - just read it directly
background_task(
    agent="explore",
    prompt="Find the error in this function"
)

# BAD: Simple grep - use direct tools
background_task(
    agent="explore",
    prompt="Find all console.log statements"
)

# BAD: Known location - no search needed
background_task(
    agent="explore",
    prompt="Look at the auth middleware"
)
```

#### Good: Use Direct Tools

```python
# GOOD: Known file - read directly
read(filePath="./src/auth.js")

# GOOD: Simple pattern - grep directly
grep(pattern="console\.log", path="./src")

# GOOD: Single pattern - ast_grep_search directly
ast_grep_search(pattern="console.log($MSG)", lang="javascript", paths=["./src"])
```

### Rule of Thumb

| Action | Use Direct Tools | Delegate |
|--------|------------------|----------|
| Known file location | ✅ | ❌ |
| Simple 1-line grep | ✅ | ❌ |
| Single pattern | ✅ | ❌ |
| Unknown location | ❌ | ✅ |
| Multiple patterns | ❌ | ✅ |
| Cross-module analysis | ❌ | ✅ |
| Unfamiliar structure | ❌ | ✅ |

---

## Missing Tool Whitelists

### The Problem

Subagents may use unauthorized tools, leading to unexpected behavior or security issues.

### Example

#### Bad: No Tool Constraints

```python
# BAD - Subagent can use any tool
background_task(
    agent="explore",
    prompt="""
    1. TASK: Find auth patterns
    2. EXPECTED OUTCOME: List of auth implementations
    3. REQUIRED SKILLS: explore
    4. REQUIRED TOOLS: (Missing - any tool allowed!)
    5. MUST DO: Search codebase
    6. MUST NOT DO: (Missing - no constraints)
    7. CONTEXT: ./src
    """
)
```

Subagent might:
- Modify files (should be read-only)
- Run build/test commands (should not)
- Use expensive tools unnecessarily

#### Good: Explicit Tool Whitelist

```python
# GOOD - Specific tools only
background_task(
    agent="explore",
    prompt="""
    1. TASK: Find auth patterns
    2. EXPECTED OUTCOME: List of auth implementations
    3. REQUIRED SKILLS: explore
    4. REQUIRED TOOLS: Grep, Read, Glob
    5. MUST DO: Search for 'auth', 'jwt', 'session'; list all middleware
    6. MUST NOT DO: Don't modify any files; don't run build/test; don't use Write/Edit tools
    7. CONTEXT: ./src
    """
)
```

Subagent is constrained to:
- **Only** search and read tools
- **Cannot** modify files
- **Cannot** run commands

---

## Not Verifying Delegated Work

### The Problem

Assuming delegated work is correct without verification leads to bugs and wasted time.

### Example

#### Bad: Blind Acceptance

```python
# BAD - Assumes result is correct without checking
task_id = background_task(agent="explore", prompt="Find all API endpoints...")
# ... continue working without verifying ...
# Later: "Why are we missing endpoints?"
```

#### Good: Verify Before Proceeding

```python
# GOOD - Verify the result
task_id = background_task(agent="explore", prompt="Find all API endpoints...")

# Collect and verify
result = background_output(task_id=task_id)

# Verify: Did we find what we expected?
if len(result.endpoints) < 10:
    # Found too few endpoints - investigate
    grep(pattern="@router", path="./src")  # Double-check manually
    # Maybe delegate again with better prompt

# Only proceed after verification
```

### Verification Checklist

After receiving delegated work:

- [ ] Result matches expected outcome criteria
- [ ] Success criteria are met
- [ ] No unexpected side effects
- [ ] File paths exist and are correct
- [ ] Code patterns match project conventions
- [ ] Tool usage was within allowed scope

---

## Using Wrong Subagent Type

### The Problem

Choosing the wrong subagent leads to ineffective results or wasted resources.

### Examples

#### Bad: Using Explore for External Docs

```python
# BAD - Explore searches YOUR codebase, not external docs
background_task(
    agent="explore",
    prompt="Find the official documentation for React hooks"
)
# Result: Nothing found (docs not in your codebase)
```

#### Good: Use Librarian for External Docs

```python
# GOOD - Librarian searches external resources
background_task(
    agent="librarian",
    prompt="""
    1. TASK: Find official React hooks documentation
    2. EXPECTED OUTCOME: Official docs excerpts, usage examples, best practices
    3. REQUIRED SKILLS: librarian
    4. REQUIRED TOOLS: Context7, Web Search
    5. MUST DO: Search react.dev for hooks docs; find useEffect, useState examples
    6. MUST NOT DO: Don't return tutorial sites - only official docs
    7. CONTEXT: Need to understand React hooks for new feature
    """
)
```

#### Bad: Using Oracle for Simple File Operations

```python
# BAD - Oracle is expensive, overkill for simple tasks
task(
    agent="oracle",
    prompt="Read this file and tell me what it does"
)
```

#### Good: Use Direct Tools for Simple Tasks

```python
# GOOD - Read the file directly
read(filePath="./src/component.js")
```

### Decision Tree

```
Need to find information?
├─ In YOUR codebase? → Use `explore`
├─ External docs/OSS? → Use `librarian`
└─ Complex reasoning? → Use `oracle` (last resort)

Need to make changes?
├─ Visual/UI? → Use `frontend-ui-ux-engineer`
├─ Simple code edit? → Use direct tools (Edit/Write)
└─ Complex refactor? → Try yourself, then `oracle` if stuck
```

---

## Forgetting to Cancel Background Tasks

### The Problem

Leaving background tasks running wastes resources and can cause confusion.

### Example

#### Bad: Never Canceling

```python
# BAD - Fire tasks but never cancel
task1 = background_task(agent="explore", prompt="Find X...")
task2 = background_task(agent="explore", prompt="Find Y...")

# ... work done, deliver answer ...

# Tasks still running in background, wasting resources!
```

#### Good: Cancel Before Final Answer

```python
# GOOD - Always cancel when done
task1 = background_task(agent="explore", prompt="Find X...")
task2 = background_task(agent="explore", prompt="Find Y...")

# ... work done ...

# BEFORE delivering final answer:
background_cancel(all=true)
```

### When to Cancel

- **ALWAYS**: Before delivering final answer to user
- **OPTIONAL**: After collecting results if no longer needed
- **OPTIONALLY**: When changing direction mid-task (cancel old tasks first)

---

## Anti-Pattern Summary

| Anti-Pattern | Impact | Fix |
|--------------|--------|-----|
| Vague prompts | Wrong outcomes, wasted iterations | Use 7-section structure with specifics |
| Over-delegating trivial tasks | Wasted tokens, slower | Use direct tools for simple tasks |
| Missing tool whitelists | Unexpected tool usage | Explicitly list allowed tools |
| Not verifying results | Bugs, wasted time | Always verify before proceeding |
| Wrong subagent type | Ineffective results | Match subagent to task domain |
| Forgetting to cancel tasks | Wasted resources | `background_cancel(all=true)` before answer |

---

## Quick Reference

### DO ✅

- Use 7-section structure for all delegation
- Be specific about tasks and outcomes
- Explicitly list allowed tools
- Verify delegated work before proceeding
- Cancel background tasks before final answer
- Choose subagent based on task type
- Fire multiple subagents in parallel when independent
- Use direct tools for simple, known tasks

### DON'T ❌

- Delegate one-file tasks
- Use vague language like "stuff", "things", "clean up"
- Omit tool whitelists
- Blindly accept delegated results
- Leave background tasks running
- Use `explore` for external searches
- Use `librarian` for internal searches
- Use `oracle` for simple tasks
- Delegate visual changes to non-visual subagents
