# Syntax and Arguments

This guide covers the syntax for invoking slash commands and how to handle arguments.

## Basic Syntax

```
/<command-name> [arguments]
```

- **Command name**: Derived from the Markdown filename (without `.md` extension)
- **Arguments**: Optional parameters passed to the command

### Example

Command file: `.claude/commands/review.md`

Invocation:
```bash
/review
```

## Arguments

Commands can accept arguments to make them more flexible and dynamic.

### All Arguments: $ARGUMENTS

The `$ARGUMENTS` placeholder captures **all** arguments passed to the command as a single string.

#### Command Definition

```markdown
# .claude/commands/fix-issue.md
---
argument-hint: [issue-number] [priority]
description: Fix a specific issue
---

Fix issue #$ARGUMENTS following our coding standards.
```

#### Usage

```bash
/fix-issue 123 high-priority
```

**Result**: `$ARGUMENTS` becomes `"123 high-priority"`

#### When to use
- Simple commands that don't need to parse arguments separately
- When all arguments should be treated as a single unit
- Quick commands where argument parsing overhead isn't needed

### Individual Arguments: $1, $2, etc.

Access specific arguments individually using positional parameters (similar to shell scripts).

#### Command Definition

```markdown
# .claude/commands/review-pr.md
---
argument-hint: [pr-number] [priority] [assignee]
description: Review pull request
---

Review PR #$1 with priority $2 and assign to $3.

Focus on:
- Security vulnerabilities
- Performance issues
- Code style violations
```

#### Usage

```bash
/review-pr 456 high alice
```

**Result**:
- `$1` becomes `"456"`
- `$2` becomes `"high"`
- `$3` becomes `"alice"`

#### When to use
- Need to access arguments individually in different parts of command
- Want to provide defaults for missing arguments
- Building structured commands with specific parameter roles
- Need to validate or process specific arguments

### Mixed: $ARGUMENTS with Positional

You can use both `$ARGUMENTS` and positional parameters together:

```markdown
---
argument-hint: [action] [tagId]
description: Tag management
---

Tag management action: $1

Additional arguments: $ARGUMENTS

If action is "add", use tagId $2 to tag the current context.
If action is "remove", use tagId $2 to remove the tag.
```

## File References

Include file contents in commands using the `@` prefix.

### Reference a Single File

```markdown
Review the implementation in @src/utils/helpers.js
```

### Reference Multiple Files

```markdown
Compare the old and new implementations:
- @src/old-version.js
- @src/new-version.js
```

### Reference Directories

```markdown
Review all tests in @tests/
```

### When to use file references
- Need Claude to analyze specific code
- Providing context for code review
- Comparing implementations
- Referencing documentation or config files

## Bash Command Execution

Execute bash commands before the slash command runs using the `!` prefix. The output is included in the command context.

### Basic Usage

```yaml
---
allowed-tools: Bash(git status:*), Bash(git diff:*)
description: Review staged changes
---

## Current git status
!git status

## Staged changes
!git diff --cached

Review these changes and provide feedback.
```

### Multiple Bash Commands

```yaml
---
allowed-tools: Bash(git:*), Bash(npm:*)
description: Create release commit
---

## Current branch
!git branch --show-current

## Version in package.json
!cat package.json | grep version

## Recent commits
!git log --oneline -5

Create a release commit message for version bump.
```

### Output Format

Bash command output is included **verbatim** in the command context that Claude receives. Claude will see the raw output as if it were typed into the conversation.

### Security and Permissions

**IMPORTANT**: When using bash execution in commands, you **must** specify `allowed-tools` in the frontmatter:

```yaml
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
---

# Command content
```

This prevents unauthorized command execution and ensures commands only use approved bash tools.

### When to use bash execution
- Need to provide dynamic context (git status, file listings)
- Want to include environment-specific information
- Running pre-command validation scripts
- Fetching up-to-date data from CLI tools

## Argument Hint

The `argument-hint` field in frontmatter provides guidance to users about expected arguments.

### Examples

```yaml
---
argument-hint: [message]
description: Create git commit
---
```

```yaml
---
argument-hint: [type] [description]
description: Create structured commit
---
```

```yaml
---
argument-hint: add [tagId] | remove [tagId] | list
description: Tag management
---
```

### Best Practices
- Use square brackets `[]` for optional arguments
- Use pipe `|` to show alternatives
- Keep hints concise and clear
- Show usage patterns when multiple options exist

## Complete Examples

### Example 1: Simple Review Command

```markdown
# .claude/commands/review.md
---
description: Review code for bugs and improvements
---

Review this code for:
- Security vulnerabilities
- Performance issues
- Code style violations
- Potential bugs

Suggest specific improvements for any issues found.
```

Usage: `/review`

### Example 2: Commit Command with Bash Execution

```yaml
# .claude/commands/commit.md
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a git commit
argument-hint: [message]
---

## Current git status
!git status

## Staged changes
!git diff --cached

## Unstaged changes
!git diff

Create a git commit with message: $ARGUMENTS

Use Conventional Commits format: type(scope): description
```

Usage: `/commit "feat(auth): add JWT authentication"`

### Example 3: PR Review with Multiple Arguments

```markdown
# .claude/commands/review-pr.md
---
argument-hint: [pr-number] [focus-area]
description: Review a pull request
---

Review PR #$1 with focus on $2.

If no focus area specified, review all aspects:
- Code quality and style
- Security vulnerabilities
- Performance implications
- Test coverage
- Documentation completeness

Provide specific, actionable feedback.
```

Usage: `/review-pr 456 security` or `/review-pr 789 performance`

### Example 4: Test Command with File Reference

```markdown
# .claude/commands/test-coverage.md
---
description: Analyze test coverage
---

Analyze test coverage for @src/components/Button.tsx

Check for:
- Uncovered lines
- Untested edge cases
- Missing unit tests
- Integration test needs

Recommend specific tests to add.
```

Usage: `/test-coverage`

## Common Patterns

### Pattern 1: Validation Before Action

```yaml
---
allowed-tools: Bash(npm:*), Bash(python:*)
description: Run tests before commit
---

## Run tests
!npm test

## Check for linting issues
!npm run lint

Review the results above. If tests pass and no lint errors, confirm ready to commit.
```

### Pattern 2: Context-Aware Analysis

```yaml
---
allowed-tools: Bash(git:*), Bash(ls:*)
description: Analyze current changes
---

## Current branch
!git branch --show-current

## Modified files
!git status --short

## Recent commits on this branch
!git log --oneline -5

Analyze these changes and provide:
1. Summary of what was changed
2. Potential issues or risks
3. Suggested improvements
```

### Pattern 3: Multi-Step Workflow

```yaml
---
allowed-tools: Bash(git:*), Bash(npm:*)
argument-hint: [version-type] (major|minor|patch)
description: Prepare release
---

## Check current version
!cat package.json | grep '"version"'

## Current git status
!git status

Steps to prepare for $1 release:
1. Update version in package.json
2. Update CHANGELOG.md
3. Create release commit
4. Tag the commit
5. Push to remote

Provide specific commands for each step.
```

Usage: `/prepare-release minor`
