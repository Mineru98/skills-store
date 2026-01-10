# Delegation Patterns

Templates and patterns for effective subagent delegation.

## The 7-Section Delegation Structure (MANDATORY)

All delegation prompts MUST include these 7 sections:

```
1. TASK: Atomic, specific goal (one action per delegation)
2. EXPECTED OUTCOME: Concrete deliverables with success criteria
3. REQUIRED SKILLS: Which skill to invoke
4. REQUIRED TOOLS: Explicit tool whitelist (prevents tool sprawl)
5. MUST DO: Exhaustive requirements - leave NOTHING implicit
6. MUST NOT DO: Forbidden actions - anticipate and block rogue behavior
7. CONTEXT: File paths, existing patterns, constraints
```

**Why This Structure Matters**:
- **Atomic tasks**: Prevents scope creep and confusion
- **Concrete outcomes**: Subagent knows exactly what success looks like
- **Tool whitelist**: Prevents unauthorized tool usage
- **Exhaustive requirements**: Reduces ambiguity and iterations
- **Forbidden actions**: Anticipates and blocks problems before they occur
- **Context**: Helps subagent make better decisions

---

## Delegation Templates

### Explore Agent Template

```python
background_task(
    agent="explore",
    prompt="""
    1. TASK: Find all [X] implementations in [directory/module]
    2. EXPECTED OUTCOME: List of files containing [X], patterns used, and how they're interconnected
    3. REQUIRED SKILLS: explore
    4. REQUIRED TOOLS: Grep, Read, Glob
    5. MUST DO:
       - Search for pattern [Y] and variations [Z, W]
       - Identify how [X] is used across the codebase
       - List all files with [X] logic
       - Note any patterns or anti-patterns
    6. MUST NOT DO:
       - Don't modify any files
       - Don't run build/test commands
       - Don't make assumptions without reading code
    7. CONTEXT:
       - Working in ./[path] directory
       - Looking for [language/framework] patterns
       - Focus on [specific aspect]
    """
)
```

### Librarian Agent Template

```python
background_task(
    agent="librarian",
    prompt="""
    1. TASK: Find best practices and implementation examples for [library/framework feature]
    2. EXPECTED OUTCOME: Official documentation excerpts, real-world examples, and common patterns from production apps
    3. REQUIRED SKILLS: librarian
    4. REQUIRED TOOLS: GitHub CLI, Context7, Web Search, webfetch
    5. MUST DO:
       - Search official [library] documentation for [feature]
       - Find 2-3 production-grade examples from popular repositories
       - Identify common patterns and anti-patterns
       - Note any version-specific considerations
    6. MUST NOT DO:
       - Don't search for tutorials - only official docs and production code
       - Don't return examples from low-quality repos (<100 stars)
       - Don't assume - verify information from official sources
    7. CONTEXT:
       - Working with [library version]
       - Using [framework/language] integration
       - Need guidance on [specific scenario]
    """
)
```

### Oracle Agent Template

```python
task(
    agent="oracle",
    prompt="""
    1. TASK: Design architecture for [system/feature] with [constraints]
    2. EXPECTED OUTCOME: Architecture recommendation with tradeoff analysis, key decisions, and implementation guidance
    3. REQUIRED SKILLS: oracle
    4. REQUIRED TOOLS: (None specified - oracle determines)
    5. MUST DO:
       - Consider [X, Y, Z] requirements
       - Analyze tradeoffs between [options A, B, C]
       - Recommend specific technologies and patterns
       - Provide reasoning for each major decision
       - Suggest implementation phases if complex
    6. MUST NOT DO:
       - Don't over-engineer - match requirements
       - Don't ignore existing infrastructure if mentioned
       - Don't skip security/performance considerations
    7. CONTEXT:
       - Current tech stack: [list]
       - Team constraints: [e.g., size, expertise]
       - Scale requirements: [e.g., 10k users, 1M req/day]
       - Existing patterns: [relevant context]
    """
)
```

### Frontend-UI-UX-Engineer Agent Template

```python
task(
    agent="frontend-ui-ux-engineer",
    prompt="""
    1. TASK: Design and implement [component/page] with [visual requirements]
    2. EXPECTED OUTCOME: Working component with polished UI/UX, responsive design, and accessibility
    3. REQUIRED SKILLS: frontend-ui-ux-engineer
    4. REQUIRED TOOLS: (frontend-specific tools determined by agent)
    5. MUST DO:
       - Follow existing design system if specified
       - Ensure responsive design for [breakpoints]
       - Use [Tailwind/styling] patterns consistently
       - Include proper [hover/focus] states
       - Maintain accessibility (ARIA labels, keyboard navigation)
    6. MUST NOT DO:
       - Don't change component logic/behavior
       - Don't add business logic - only visual changes
       - Don't break existing functionality
    7. CONTEXT:
       - Component: [path/to/component]
       - Existing patterns: [relevant design tokens/colors]
       - Constraints: [e.g., mobile-first, dark mode support]
    """
)
```

---

## When to Create New Subagents

**Only create a new subagent type when**:

1. **Distinct Tooling**: The domain requires specialized tools not used elsewhere
2. **Clear Expertise**: The domain has deep domain knowledge that general LLMs lack
3. **Repeatable Pattern**: You're encountering the same type of task repeatedly
4. **Different Cost Model**: The task has different resource constraints (time, compute, API usage)

**Examples of Good New Subagents**:

| Subagent | Why It Works |
|----------|--------------|
| `pdf-specialist` | PDF processing requires specific libraries and error handling patterns |
| `database-optimizer` | Query optimization has deep domain knowledge and repeatable patterns |
| `security-auditor` | Security requires specialized knowledge and strict tool constraints |
| `legacy-migrator` | Legacy code translation has established patterns and tooling |

**Examples of Bad New Subagents** (use existing ones instead):

| Proposed | Better Approach | Reason |
|----------|-----------------|--------|
| `api-searcher` | Use `explore` with grep patterns | Just internal code search |
| `doc-finder` | Use `librarian` with Context7 | Already covered by reference search |
| `bug-fixer` | Try yourself first, then `oracle` | Not distinct expertise |
| `test-writer` | Use existing tools | Standard coding task |

---

## Subagent Definition Template

If creating a new subagent, document it with this structure:

```markdown
## [Subagent Name]

**Purpose**: [One-sentence description of what this subagent does]

**Cost**: [FREE/CHEAP/EXPENSIVE] and [why]

**When to Use**:

| Use This | Not This |
|----------|-----------|
| [Valid use case 1] | [Invalid use case 1] |
| [Valid use case 2] | [Invalid use case 2] |

**Use Cases**:
- "[Specific example 1]"
- "[Specific example 2]"

**Trigger Phrases**:
- "[Phrase 1]"
- "[Phrase 2]"

**Key Characteristics**:
- [Characteristic 1]
- [Characteristic 2]

**Tools Available**: [List of tools this subagent can use]

**Constraints**: [Any limitations or constraints]
```

---

## Parallel vs Sequential Delegation

**Default Rule**: Always fire multiple subagents in parallel when independent.

### Parallel Example (CORRECT)

```python
# Multiple independent searches - fire all at once
auth_search = background_task(
    agent="explore",
    prompt="[7-section structure for auth patterns]"
)
error_search = background_task(
    agent="explore",
    prompt="[7-section structure for error handling]"
)
config_search = background_task(
    agent="explore",
    prompt="[7-section structure for configuration]"
)

# Continue with other work...
# Collect results when needed
```

### Sequential Example (CORRECT)

```python
# Second task depends on first - run sequentially
result1 = background_task(agent="explore", prompt="Find API endpoints...")

# Wait for result1 before proceeding
endpoints = background_output(task_id=result1)

# Now use endpoints in second task
result2 = background_task(
    agent="explore",
    prompt=f"Find error handling for these endpoints: {endpoints}..."
)
```

---

## Delegation Checklist

Before delegating, verify:

- [ ] Task is atomic (one clear action)
- [ ] Subagent type matches the domain
- [ ] All 7 sections are present
- [ ] "MUST DO" and "MUST NOT DO" are exhaustive
- [ ] Tool whitelist is explicit (not "all tools")
- [ ] Context includes all relevant constraints
- [ ] Expected outcome is concrete and measurable

After delegation, verify:

- [ ] Received task_id (for background tasks)
- [ ] Result meets expected outcome criteria
- [ ] No unauthorized tools were used
- [ ] Delegated work integrates correctly
- [ ] Cancel background tasks before final answer
