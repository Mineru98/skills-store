# Advanced Features

This guide covers advanced features for slash commands including bash execution, hooks, and thinking mode.

## Bash Command Execution

Execute bash commands before the slash command runs using the `!` prefix. The output is included in the command's context.

### Basic Usage

```yaml
---
allowed-tools: Bash(git status:*), Bash(git diff:*)
description: Show current changes
---

## Git status
!git status

## Staged changes
!git diff --cached

## Unstaged changes
!git diff

Review these changes and provide feedback.
```

### Execution Flow

1. Claude Code parses frontmatter
2. Executes bash commands marked with `!`
3. Collects bash command output
4. Injects output into command context
5. Claude processes command with bash output available

### Output Format

Bash command output is included **verbatim** in the command context:

```
## Git status
M src/app.ts
A src/utils/helpers.ts

## Staged changes
+ export function helper() { ... }
```

Claude sees this exactly as if it were typed into the conversation.

### Multiple Bash Commands

You can execute multiple bash commands:

```yaml
---
allowed-tools: Bash(git:*), Bash(npm:*), Bash(python:*)
description: Pre-commit check
---

## Current branch
!git branch --show-current

## Run tests
!npm test

## Check linting
!npm run lint

## Check formatting
!npm run format:check

## Check Python type hints
!python -m mypy src/

Review results above. Confirm if all checks pass.
```

### Chained Bash Commands

You can chain bash commands using `&&` or `;`:

```yaml
---
allowed-tools: Bash(git:*)
description: Show commit history
---

## Last 5 commits on current branch
!git log --oneline -5

## Detailed diff of latest commit
!git show HEAD --stat
```

### Security Requirements

**IMPORTANT**: When using bash execution, you **must** include the relevant bash commands in `allowed-tools`:

```yaml
---
# REQUIRED for bash execution
allowed-tools: Bash(git status:*), Bash(git diff:*)
---

!git status
```

Without `allowed-tools`, bash execution will fail with permission error.

### Allowed Tools Patterns

```yaml
# Exact command match
allowed-tools: Bash(git status)

# Prefix match (allows git status with any args)
allowed-tools: Bash(git status:*)

# All git commands
allowed-tools: Bash(git:*)

# Multiple specific commands
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*)
```

### When to Use Bash Execution

**Good use cases**:
- Providing dynamic context (git status, file listings)
- Fetching up-to-date data from CLI tools
- Running validation scripts before main action
- Including environment-specific information

**Avoid when**:
- Hardcoding static values (use plain text instead)
- Commands with side effects (user should approve)
- Extremely long outputs (consider alternatives)

### Common Bash Patterns

#### Pattern 1: Git Context

```yaml
---
allowed-tools: Bash(git:*), Bash(git log:*)
description: Show git context
---

## Current branch and status
!git branch --show-current
!git status --short

## Recent commits
!git log --oneline -5

Analyze these changes and provide summary.
```

#### Pattern 2: Project Information

```yaml
---
allowed-tools: Bash(cat:*), Bash(ls:*)
description: Show project info
---

## Project structure
!ls -la

## Dependencies
!cat package.json | grep -A 20 '"dependencies"'

## Scripts available
!cat package.json | grep -A 10 '"scripts"'
```

#### Pattern 3: Environment Context

```yaml
---
allowed-tools: Bash(node:*), Bash(python:*), Bash(env:*)
description: Show environment
---

## Node version
!node --version
!npm --version

## Environment variables
!env | grep -i node

## Python version (if applicable)
!python --version 2>/dev/null || echo "Python not installed"
```

## Hooks

Hooks allow you to define actions that run at specific points during command execution. Hooks defined in a command are scoped to that command's execution and are automatically cleaned up when the command finishes.

### Hook Types

| Hook Type | When It Runs | Use Cases |
|------------|--------------|------------|
| `PreToolUse` | Before a tool is used | Validation, pre-conditions |
| `PostToolUse` | After a tool is used | Notifications, logging |
| `Stop` | When the command stops | Cleanup, final actions |

### Hook Structure

```yaml
---
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
          once: true
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/notify.sh"
  Stop:
    - type: command
      command: "./scripts/cleanup.sh"
---

Command content here
```

### Parameters

#### matcher

The tool type to match. Can be:
- `"Bash"`: Match all Bash tool uses
- `"Read"`: Match all Read tool uses
- `"Write"`: Match all Write tool uses
- `*`: Match all tool uses

#### type

The type of hook. Currently supports:
- `command`: Execute a shell command

#### command

The shell command to execute when the hook triggers.

#### once

Whether to run the hook only once per session:
- `true`: Run only on first match, then remove hook
- `false` or omitted: Run every time the hook matches

### PreToolUse Hook

Runs before a tool is used.

**Use cases**:
- Validation before sensitive operations
- Pre-deployment checks
- Security checks before file writes

**Example**:

```yaml
---
description: Deploy to production
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-deploy.sh"
          once: true
---

Deploy to production environment.
```

When this command runs, `validate-deploy.sh` is executed before any Bash tool is used. If validation fails, the deployment can be prevented.

### PostToolUse Hook

Runs after a tool is used.

**Use cases**:
- Notifications after operations
- Logging actions
- Triggering downstream processes

**Example**:

```yaml
---
description: Create release
hooks:
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/notify-team.sh"
---

Create a new release:
1. Bump version
2. Update CHANGELOG.md
3. Create release commit
4. Tag the commit
```

The `notify-team.sh` script runs after each Bash command execution, potentially notifying the team of progress.

### Stop Hook

Runs when the command stops (completes or is interrupted).

**Use cases**:
- Cleanup temporary files
- Restore environment state
- Log completion status

**Example**:

```yaml
---
description: Run database migration
hooks:
  Stop:
    - type: command
      command: "./scripts/cleanup-migration.sh"
---

Run database migrations:

1. Check current migration status
2. Apply pending migrations
3. Verify migration success
4. Update schema documentation
```

After the command finishes (successfully or not), `cleanup-migration.sh` runs to clean up any temporary resources.

### Multiple Hooks

You can define multiple hooks:

```yaml
---
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
          once: true
    - matcher: "Write"
      hooks:
        - type: command
          command: "./scripts/backup-before-write.sh"
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/log-operation.sh"
  Stop:
    - type: command
      command: "./scripts/cleanup.sh"
---

Critical operation with comprehensive checks.
```

### Hook Lifecycle

1. Command invoked
2. Hooks loaded from frontmatter
3. PreToolUse hooks run before tool execution
4. Tool executes
5. PostToolUse hooks run after tool execution
6. Steps 3-5 repeat for each tool use
7. Command completes or is interrupted
8. Stop hooks run
9. Hooks are cleaned up

### Hook Scoping

Hooks defined in a command:
- **Apply only** to that command's execution
- **Do not** persist after command completes
- **Do not** affect other commands or the main conversation

This makes hooks safe for temporary, command-specific validation and cleanup.

### Best Practices for Hooks

1. **Make hooks idempotent**: Hook should be safe to run multiple times
2. **Handle failures gracefully**: Hooks shouldn't break the main command
3. **Keep hooks fast**: Hooks should execute quickly
4. **Use `once: true`**: For one-time validation to avoid redundant execution
5. **Document hook behavior**: Explain what hooks do in comments

## Thinking Mode

Slash commands can trigger extended thinking by including extended thinking keywords in the command content.

### Extended Thinking Keywords

Keywords that trigger extended thinking:
- "think through"
- "analyze"
- "consider"
- "evaluate"
- "reason about"
- "break down"
- "step by step"

### Example

```markdown
---
description: Deep code analysis
---

Analyze this code thoroughly. Think through the following aspects:
1. Security vulnerabilities
2. Performance implications
3. Maintainability concerns
4. Edge cases
5. Integration points

Provide a comprehensive analysis with recommendations.
```

When this command runs, Claude will use extended thinking mode to provide deeper analysis.

### When Extended Thinking Helps

- Complex reasoning tasks
- Multi-step problem solving
- Analyzing trade-offs
- Code reviews with nuanced feedback
- Architectural decisions

### When Extended Thinking is Wasteful

- Simple code fixes
- Straightforward operations
- Quick lookups
- Well-defined, repetitive tasks

## Advanced Bash Techniques

### Conditional Execution

```yaml
---
allowed-tools: Bash(git:*), Bash(test:*), Bash(bash:*)
description: Smart git status
---

## Git status
!git status

## Detailed diff if changes exist
!if [ $(git status --short | wc -l) -gt 0 ]; then git diff; fi

## Recent commits if on a feature branch
!if git branch --show-current | grep -q "feature"; then git log --oneline -5; fi
```

### Output Parsing

```yaml
---
allowed-tools: Bash(git:*), Bash(awk:*), Bash(sed:*), Bash(grep:*)
description: Summarize git changes
---

## Commit count by author
!git log --pretty=format:"%an" | sort | uniq -c | sort -rn

## File type distribution
!git diff --name-only | sed 's/.*\.//' | sort | uniq -c | sort -rn

## Most recently modified files
!git status --short | awk '{print $2}'
```

### Error Handling

```yaml
---
allowed-tools: Bash(npm:*), Bash(bash:*)
description: Safe test run
---

## Run tests, continue even if they fail
!npm test || echo "Tests failed, continuing..."

## Check linting, report only failures
!npm run lint 2>&1 | grep -i error || echo "No lint errors"

## Try multiple formatters, fallback on failure
!npm run format:check 2>/dev/null || npm run format
```

## Complete Example: Deployment Command

```yaml
---
description: Deploy to staging with validation
argument-hint: [environment]
allowed-tools: Bash(git:*), Bash(npm:*), Bash(bash:*), Bash(test:*), Bash(sed:*), Bash(grep:*)
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-deploy.sh"
          once: true
  Stop:
    - type: command
      command: "./scripts/cleanup-deploy.sh"
---

## Current branch
!git branch --show-current

## Uncommitted changes check
!if [ -n "$(git status --porcelain)" ]; then echo "ERROR: Uncommitted changes"; git status --short; exit 1; fi

## Run tests
!npm test

## Build application
!npm run build

## Deploy to $1
!echo "Deploying to $1 environment..."
!npm run deploy -- $1

## Verify deployment
!npm run smoke-test -- $1

Review deployment status above.
```

This command demonstrates:
1. Bash execution for git status, tests, build, deployment
2. Conditional execution (check for uncommitted changes)
3. PreToolUse hook for validation
4. Stop hook for cleanup
5. Multiple tool uses in a single command
6. Error handling
