# Best Practices

This guide covers best practices, naming conventions, and common patterns for slash commands.

## Naming Commands

### Command Name Guidelines

1. **Use lowercase names**
   - ✅ Good: `review`, `deploy`, `test-coverage`
   - ❌ Bad: `Review`, `Deploy`, `TEST_COVERAGE`

2. **Use hyphens for multi-word commands**
   - ✅ Good: `code-review`, `git-commit`, `test-coverage`
   - ❌ Bad: `codeReview`, `gitCommit`, `test_coverage`

3. **Use imperative verbs for actions**
   - ✅ Good: `review`, `deploy`, `fix`, `test`
   - ❌ Bad: `reviewer`, `deployment`, `fixer`, `tester`

4. **Keep names concise**
   - ✅ Good: `review`, `commit`, `deploy`
   - ⚠️ Acceptable: `code-review`, `git-commit-message`
   - ❌ Bad: `perform-code-review-and-analysis`, `create-git-commit-message-with-validation`

5. **Avoid built-in command names**
   - ❌ Don't use: `help`, `clear`, `config`, `status`, `exit`
   - ✅ Use: `my-review`, `project-help`, `custom-config`

### Command Categories

Common naming patterns by category:

| Category | Examples |
|----------|----------|
| Code Review | `review`, `security-review`, `perf-review` |
| Git Operations | `commit`, `git-status`, `branch-info` |
| Deployment | `deploy`, `deploy-staging`, `deploy-prod` |
| Testing | `test`, `test-coverage`, `run-tests` |
| Documentation | `docs`, `readme`, `changelog` |
| Code Quality | `lint`, `format`, `type-check` |
| Project Setup | `init`, `setup`, `install` |
| Analysis | `analyze`, `profile`, `benchmark` |

## Description Guidelines

1. **Start with imperative verb**
   - ✅ Good: "Review code for security vulnerabilities"
   - ❌ Bad: "This command reviews code for security vulnerabilities"

2. **Be specific about what command does**
   - ✅ Good: "Create a git commit following Conventional Commits format"
   - ⚠️ Acceptable: "Create a git commit"
   - ❌ Bad: "Git commit command"

3. **Keep under 100 characters**
   - ✅ Good: "Review code for security vulnerabilities"
   - ❌ Bad: "Perform a comprehensive security review of the provided code, checking for common vulnerabilities including SQL injection, XSS, and CSRF attacks"

4. **Use clear, simple language**
   - ✅ Good: "Create a git commit from staged changes"
   - ❌ Bad: "Generate a commit object encapsulating the modifications present in the staging area"

## Namespacing

### Use Subdirectories for Organization

Organize related commands in subdirectories:

```
.claude/commands/
├── backend/
│   ├── review.md          # /review (project:backend)
│   ├── test.md           # /test (project:backend)
│   └── deploy.md         # /deploy (project:backend)
├── frontend/
│   ├── review.md          # /review (project:frontend)
│   ├── test.md           # /test (project:frontend)
│   └── component.md      # /component (project:frontend)
└── ops/
    ├── deploy.md          # /deploy (project:ops)
    └── status.md        # /status (project:ops)
```

### Benefits of Namespacing

- **Organized structure**: Related commands grouped together
- **Disambiguation**: Same-named commands in different contexts
- **Team collaboration**: Multiple team members can work on different command sets
- **Discoverability**: Subdirectory name appears in `/help` output

### When to Use Namespacing

**Use subdirectories when**:
- Project has multiple distinct domains (backend, frontend, ops)
- Multiple teams working on same project
- Commands have similar names but different purposes
- Project structure is complex

**Use flat structure when**:
- Project is small or simple
- Commands are general-purpose
- Single developer or small team
- Few commands (under 10)

## Choosing Between Commands and Skills

### Use Commands When

- **Simple, single-file prompts**
  ```markdown
  # .claude/commands/review.md
  Review this code for bugs and improvements.
  ```

- **Frequently used quick actions**
  - Code reviews
  - Git operations
  - Simple explanations

- **Explicit control needed**
  - User wants to manually trigger
  - Clear start and end points
  - No automatic discovery needed

- **Templates and snippets**
  - Standardized prompts
  - Reusable patterns
  - Quick reminders

### Use Skills When

- **Complex, multi-file workflows**
  ```
  .claude/skills/code-review/
  ├── SKILL.md (overview)
  ├── security.md (checklist)
  ├── performance.md (patterns)
  └── scripts/run-linters.sh
  ```

- **Need for scripts or utilities**
  - Validation scripts
  - Code generation tools
  - Automated testing

- **Knowledge organized across multiple files**
  - Different domains or topics
  - Reference documentation
  - Multiple workflows

- **Team standardization**
  - Shared procedures
  - Organized reference material
  - Version-controlled workflows

- **Automatic discovery desired**
  - Claude should use capability automatically
  - Context-aware activation
  - No manual invocation needed

## Security and Permissions

### Use allowed-tools for Bash Execution

**Always** specify `allowed-tools` when using bash execution:

```yaml
---
# GOOD: Explicit tool permissions
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git commit:*)
description: Create git commit
---

!git status
```

```yaml
# BAD: No permissions, will fail
description: Create git commit
---

!git status  # This will fail with permission error
```

### Restrict to Specific Commands

When possible, limit to specific commands rather than wildcards:

```yaml
---
# GOOD: Specific commands only
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
---

!git status
```

```yaml
# ACCEPTABLE: All git commands (if you trust git commands)
allowed-tools: Bash(git:*)
---

!git status
```

```yaml
# AVOID: Too broad
allowed-tools: Bash(*)
---

!git status
```

### Disable Model Invocation for Sensitive Operations

Prevent accidental programmatic execution:

```yaml
---
disable-model-invocation: true
description: Delete production database
---

WARNING: This operation cannot be undone.
```

## Command Size and Complexity

### Keep Commands Focused

**Single-purpose commands** are easier to understand and maintain:

```yaml
---
# GOOD: Single, clear purpose
description: Review code for security issues
---

Review for SQL injection, XSS, CSRF.
```

```yaml
# BAD: Multiple, mixed purposes
description: Review, refactor, test, and deploy code
---

Review for security, then refactor,
then test everything, then deploy to production.
```

### Limit Command Length

Commands should be concise (under 100 lines ideally):

- **0-50 lines**: Simple command, one file
- **50-100 lines**: Moderate complexity, still manageable
- **100+ lines**: Consider splitting into Skills

### Split Complex Commands

For complex workflows, use Skills instead:

```
# Instead of one giant command file
.claude/commands/complex-workflow.md (500+ lines)

# Use a Skill with multiple files
.claude/skills/workflow/
├── SKILL.md (workflow overview)
├── phase1.md (step-by-step)
├── phase2.md (step-by-step)
├── phase3.md (step-by-step)
└── scripts/validate.sh
```

## Argument Handling

### Use Argument Hints

Always provide `argument-hint` for commands with arguments:

```yaml
---
# GOOD: Clear hint
argument-hint: [pr-number] [focus-area]
description: Review a pull request
---

Review PR #$1 with focus on $2.
```

```yaml
# BAD: No hint
description: Review a pull request
---

Review PR #$1 with focus on $2.
```

### Validate Arguments in Command

Provide guidance for missing or invalid arguments:

```yaml
---
argument-hint: [environment] (staging|production)
description: Deploy to environment
---

Deploy to $1 environment.

Valid environments: staging, production

Usage: /deploy staging
       /deploy production
```

### Use Positional Arguments for Structure

When arguments have specific roles, use positional parameters:

```yaml
---
argument-hint: [action] [resource] [options]
description: Resource management
---

Resource management:

Actions: create, update, delete, list

Usage: /manage create user --admin=true
       /manage list users
       /manage delete user --force=true
```

## Error Handling

### Provide Clear Error Messages

```yaml
---
allowed-tools: Bash(git:*), Bash(bash:*)
description: Create git commit
---

## Check for changes
!if [ -z "$(git status --porcelain)" ]; then echo "ERROR: No changes to commit"; exit 1; fi

## Create commit
!git commit -m "$ARGUMENTS"

If commit failed:
- Check git status for uncommitted changes
- Verify message format
- Review error message above
```

### Graceful Degradation

Handle failures gracefully:

```yaml
---
allowed-tools: Bash(npm:*), Bash(bash:*)
description: Run quality checks
---

## Run tests
!npm test || echo "⚠️ Tests failed, continuing..."

## Check linting
!npm run lint || echo "⚠️ Linting failed, continuing..."

## Check formatting
!npm run format:check 2>/dev/null || echo "ℹ️ Format check not configured"

Review results above.
```

## Documentation

### Inline Documentation

Add comments to complex commands:

```yaml
---
# Validate pre-deployment checks
allowed-tools: Bash(npm:*), Bash(git:*)
description: Deploy to production
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-deploy.sh"
          once: true
---

# Step 1: Verify clean working tree
!git diff --exit-code || (echo "ERROR: Uncommitted changes" && exit 1)

# Step 2: Run tests
!npm test

# Step 3: Build application
!npm run build

# Step 4: Deploy to production
!npm run deploy -- production
```

### README for Command Sets

For complex command sets, add a README in `.claude/commands/`:

```markdown
# Commands Documentation

## Code Review
- `/review` - General code review
- `/review:security` - Security-focused review
- `/review:performance` - Performance-focused review

## Deployment
- `/deploy staging` - Deploy to staging
- `/deploy production` - Deploy to production

## Testing
- `/test` - Run all tests
- `/test:unit` - Run unit tests only
- `/test:integration` - Run integration tests only
```

## Performance Considerations

### Minimize Bash Output

Excessive bash output can consume context:

```yaml
---
# BAD: Entire file contents in context
allowed-tools: Bash(cat:*)
description: Show package.json
---

!cat package.json  # This loads entire file into context
```

```yaml
# GOOD: Only what's needed
allowed-tools: Bash(grep:*)
description: Show dependencies
---

!cat package.json | grep -A 20 "dependencies"
```

### Use File References Instead of Bash

When possible, use `@` file references instead of bash commands:

```yaml
---
# BAD: Bash to read file
allowed-tools: Bash(cat:*)
description: Review auth implementation
---

!cat src/auth.ts

Review this code.
```

```yaml
# GOOD: File reference
description: Review auth implementation
---

Review @src/auth.ts for security issues.
```

### Use Specific Model for Simple Commands

Reduce cost by using smaller models for simple tasks:

```yaml
---
model: claude-3-5-haiku-20241022
description: Quick formatting check
---

Check if this code follows formatting guidelines.
```

## Testing Commands

### Test Before Shipping

Always test commands before adding to repository:

1. Test invocation: `/command-name`
2. Test with arguments: `/command-name arg1 arg2`
3. Test with invalid input: `/command-name invalid`
4. Test in different scenarios: clean repo, dirty repo, etc.

### Document Known Issues

Add notes for known limitations:

```yaml
---
description: Run comprehensive tests
---

Run tests for all packages.

Known limitations:
- Does not run tests for monorepo workspaces
- Requires tests to be in `/tests` directory
- Only works with Jest test runner

!npm test
```

## Common Anti-Patterns

### Anti-Pattern 1: Overly Generic Commands

❌ Bad:
```yaml
---
description: Work on the project
---

Help me with this project.
```

✅ Good:
```yaml
---
description: Review code for security issues
---

Review this code for:
- SQL injection
- XSS vulnerabilities
- CSRF attacks
```

### Anti-Pattern 2: Commands with Side Effects

❌ Bad:
```yaml
---
description: Clean project
---

!rm -rf node_modules
!rm -rf build/
```

✅ Good:
```yaml
---
description: Show what would be cleaned
---

Files that would be deleted:
- node_modules/
- build/

Run manually to delete:
!rm -rf node_modules build/
```

### Anti-Pattern 3: Reimplementing Built-in Commands

❌ Bad (recreates `/help`):
```yaml
---
description: Show help
---

Here are available commands...
```

✅ Good (complements `/help`):
```yaml
---
description: Show custom project commands
---

Custom commands for this project:
- /review
- /deploy
- /test-coverage

Run /help for built-in commands.
```

### Anti-Pattern 4: Excessive Bash Chaining

❌ Bad:
```yaml
---
allowed-tools: Bash(*)
description: Full deployment pipeline
---

!git status && npm test && npm run build && npm run deploy && npm run smoke-test
```

✅ Good (break into steps):
```yaml
---
allowed-tools: Bash(git:*), Bash(npm:*)
description: Deploy to production
---

## Verify clean state
!git diff --exit-code

## Run tests
!npm test

## Build
!npm run build

## Deploy
!npm run deploy

## Verify
!npm run smoke-test
```

## Summary Checklist

When creating slash commands, verify:

- [ ] Name follows conventions (lowercase, hyphens, imperative)
- [ ] Description is clear and concise
- [ ] `argument-hint` provided for commands with arguments
- [ ] `allowed-tools` specified when using bash execution
- [ ] Command is focused on single purpose
- [ ] Command length is reasonable (< 100 lines)
- [ ] Appropriate model selected (or let default)
- [ ] Error handling included
- [ ] Tested manually before adding to repo
- [ ] Documented if complex
- [ ] Considered using Skill for complex workflows
