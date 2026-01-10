# Command Examples

This guide provides concrete examples of slash commands covering various use cases and patterns.

## Basic Examples

### Simple Review Command

**File**: `.claude/commands/review.md`

```yaml
---
description: Review code for bugs and improvements
---

Review this code for:
- Security vulnerabilities
- Performance issues
- Code style violations
- Potential bugs

Provide specific, actionable feedback with code examples.
```

**Usage**: `/review`

---

### Explain Code Command

**File**: `.claude/commands/explain.md`

```yaml
---
description: Explain code in simple terms
---

Explain how this code works in simple terms.

Use analogies where helpful and break down complex concepts.
```

**Usage**: `/explain`

---

### Git Status Command

**File**: `.claude/commands/git-status.md`

```yaml
---
allowed-tools: Bash(git status:*), Bash(git diff:*)
description: Show current git changes
---

## Current git status
!git status

## Detailed changes
!git diff

Provide a summary of what was changed and why.
```

**Usage**: `/git-status`

---

## Argument-Based Commands

### Commit with Message

**File**: `.claude/commands/commit.md`

```yaml
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a git commit
argument-hint: [message]
---

Create a git commit with message: "$ARGUMENTS"

Follow Conventional Commits format: type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
```

**Usage**:
- `/commit "feat(auth): add JWT login"`
- `/commit "fix(api): resolve timeout issue"`

---

### PR Review with Focus

**File**: `.claude/commands/review-pr.md`

```yaml
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

Focus areas: security, performance, style, tests, docs
```

**Usage**:
- `/review-pr 123 security`
- `/review-pr 456 performance`
- `/review-pr 789`

---

### Tag Management

**File**: `.claude/commands/tag.md`

```yaml
---
argument-hint: [action] [tagId] | list
description: Manage session tags
---

Tag management:

Actions:
- **add**: Tag current context with tagId
- **remove**: Remove tag from current context
- **list**: List all active tags

Usage:
- /tag add frontend
- /tag remove backend
- /tag list
```

**Usage**:
- `/tag add authentication`
- `/tag remove authentication`
- `/tag list`

---

## Git Workflow Commands

### Create Feature Branch

**File**: `.claude/commands/feature.md`

```yaml
---
allowed-tools: Bash(git:*)
description: Create a new feature branch
argument-hint: [feature-name]
---

## Current branch
!git branch --show-current

## Create and checkout feature branch
!git checkout -b feature/$1

Feature branch created: feature/$1
```

**Usage**: `/feature user-authentication`

---

### Prepare Release

**File**: `.claude/commands/prepare-release.md`

```yaml
---
allowed-tools: Bash(git:*), Bash(cat:*), Bash(npm:*)
argument-hint: [version-type] (major|minor|patch)
description: Prepare for release
---

## Current version
!cat package.json | grep version

## Current branch
!git branch --show-current

## Clean working tree check
!git diff --exit-code || echo "ERROR: Uncommitted changes" && exit 1

Steps for $1 release:
1. Update version in package.json
2. Update CHANGELOG.md
3. Create release commit
4. Tag: v<new-version>
5. Push to remote

Provide commands for each step.
```

**Usage**:
- `/prepare-release minor`
- `/prepare-release patch`

---

### Git Merge Workflow

**File**: `.claude/commands/merge.md`

```yaml
---
allowed-tools: Bash(git:*), Bash(bash:*)
description: Merge feature branch to main
argument-hint: [branch-name]
---

## Current branch
!git branch --show-current

## Update main
!git checkout main && git pull origin main

## Merge feature branch
!git merge $1 --no-ff -m "Merge branch '$1'"

## Push to remote
!git push origin main

## Delete feature branch (optional)
!git branch -d $1 && git push origin --delete $1

Review merge status above.
```

**Usage**: `/merge feature/user-authentication`

---

## Testing Commands

### Run All Tests

**File**: `.claude/commands/test.md`

```yaml
---
allowed-tools: Bash(npm:*), Bash(bash:*)
description: Run all tests
---

## Run tests
!npm test

## Check coverage
!npm run test:coverage || echo "Coverage not configured"

Review test results and coverage report.
```

**Usage**: `/test`

---

### Test Specific File

**File**: `.claude/commands/test-file.md`

```yaml
---
allowed-tools: Bash(npm:*)
argument-hint: [file-path]
description: Test specific file
---

Run tests for $1:

!npm test -- $1

Review test results and any failures.
```

**Usage**:
- `/test-file src/components/Button.test.tsx`
- `/test-file tests/api.test.js`

---

### Test Coverage Analysis

**File**: `.claude/commands/test-coverage.md`

```yaml
---
allowed-tools: Bash(npm:*), Bash(cat:*)
description: Analyze test coverage
---

## Generate coverage report
!npm run test:coverage

## Coverage summary
!cat coverage/coverage-summary.json || cat coverage/lcov-report/index.html | head -50

Analyze coverage and identify:
1. Uncovered files
2. Lines/branches with low coverage
3. Critical code lacking tests
4. Recommendations for improvement
```

**Usage**: `/test-coverage`

---

## Code Quality Commands

### Lint and Format

**File**: `.claude/commands/quality-check.md`

```yaml
---
allowed-tools: Bash(npm:*), Bash(bash:*)
description: Run code quality checks
---

## Run linter
!npm run lint || echo "⚠️ Linting issues found"

## Check formatting
!npm run format:check || echo "⚠️ Formatting issues found"

## Run type checks
!npm run type-check || echo "⚠️ Type errors found"

Review results above and provide specific fixes.
```

**Usage**: `/quality-check`

---

### Fix Linting Issues

**File**: `.claude/commands/fix-lint.md`

```yaml
---
allowed-tools: Bash(npm:*), Bash(git:*)
description: Fix linting issues
---

## Auto-fix linting issues
!npm run lint:fix

## Show remaining issues
!npm run lint

Review remaining issues and provide manual fixes.
```

**Usage**: `/fix-lint`

---

## Deployment Commands

### Deploy to Staging

**File**: `.claude/commands/deploy-staging.md`

```yaml
---
allowed-tools: Bash(git:*), Bash(npm:*), Bash(bash:*)
description: Deploy to staging environment
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-deploy.sh"
          once: true
---

## Current branch
!git branch --show-current

## Verify clean state
!git diff --exit-code || (echo "ERROR: Uncommitted changes" && exit 1)

## Run tests
!npm test

## Build application
!npm run build

## Deploy to staging
!npm run deploy -- staging

## Run smoke tests
!npm run smoke-test -- staging

Review deployment status above.
```

**Usage**: `/deploy-staging`

---

### Rollback Deployment

**File**: `.claude/commands/rollback.md`

```yaml
---
allowed-tools: Bash(git:*), Bash(npm:*)
description: Rollback to previous version
argument-hint: [environment] (staging|production)
---

## Current deployment
!echo "Current deployment: $1"

## Get previous commit
!git log --oneline -2 | tail -1

## Rollback to previous commit
!git revert HEAD --no-edit

## Redeploy
!npm run deploy -- $1

## Verify rollback
!npm run smoke-test -- $1

Review rollback status and confirm functionality.
```

**Usage**:
- `/rollback staging`
- `/rollback production`

---

## Documentation Commands

### Generate API Docs

**File**: `.claude/commands/api-docs.md`

```yaml
---
allowed-tools: Bash(npm:*)
description: Generate API documentation
---

## Generate docs
!npm run docs:generate

## Serve docs locally
!npm run docs:serve

Documentation generated and available at http://localhost:3000
```

**Usage**: `/api-docs`

---

### Update README

**File**: `.claude/commands/update-readme.md`

```yaml
---
allowed-tools: Bash(cat:*), Bash(git:*)
description: Update README with latest changes
---

## Current README structure
!cat README.md | grep -E "^#+ " | head -10

## Recent changes
!git log --oneline -5

Update README.md to include:
1. Latest feature additions
2. Updated installation instructions
3. New configuration options
4. Recent breaking changes
```

**Usage**: `/update-readme`

---

## Security Commands

### Security Review

**File**: `.claude/commands/security-review.md`

```yaml
---
description: Perform security review
---

Perform comprehensive security review:

1. **Injection attacks**
   - SQL injection
   - Command injection
   - NoSQL injection

2. **XSS vulnerabilities**
   - Stored XSS
   - Reflected XSS
   - DOM-based XSS

3. **Authentication/Authorization**
   - Session management
   - Password handling
   - Permission checks

4. **Data validation**
   - Input sanitization
   - Output encoding
   - Type checking

5. **Sensitive data**
   - Secrets in code
   - Logging sensitive data
   - Insecure storage

Provide specific findings with severity levels (Critical, High, Medium, Low).
```

**Usage**: `/security-review`

---

### Check for Secrets

**File**: `.claude/commands/check-secrets.md`

```yaml
---
allowed-tools: Bash(grep:*), Bash(git:*)
description: Scan for leaked secrets
---

## Scan for common secret patterns
!grep -rE "(api[_-]?key|secret|password|token)" src/ --exclude-dir=node_modules --exclude=*.min.js || echo "No obvious secrets found"

## Check git history for secrets
!git log --all -p -S 'api_key' -S 'secret' -S 'password' --grep='secret' || echo "No secrets in git history"

Review results above. If secrets are found:
1. Revoke all exposed credentials
2. Remove secrets from code
3. Rotate all affected keys
4. Commit with cleaned code
```

**Usage**: `/check-secrets`

---

## Performance Commands

### Performance Profiling

**File**: `.claude/commands/profile.md`

```yaml
---
allowed-tools: Bash(npm:*), Bash(node:*)
description: Profile application performance
---

## Start profiler
!npm run profile:build

## Run with profiling
!npm run profile:run

## Analyze results
!npm run profile:analyze

Analyze profiling data and identify:
1. Performance bottlenecks
2. Memory leaks
3. Slow rendering paths
4. Network request optimization opportunities

Provide specific optimization recommendations.
```

**Usage**: `/profile`

---

### Bundle Size Analysis

**File**: `.claude/commands/bundle-size.md`

```yaml
---
allowed-tools: Bash(npm:*), Bash(cat:*)
description: Analyze bundle size
---

## Build with bundle analysis
!npm run build:analyze

## Bundle size report
!cat .next/analyze/client.html || cat dist/stats.json

Identify:
1. Largest dependencies
2. Duplicate code
3. Unused imports
4. Tree-shaking opportunities
5. Code-splitting opportunities

Provide recommendations for reducing bundle size.
```

**Usage**: `/bundle-size`

---

## Multi-Step Workflows

### Complete Feature Workflow

**File**: `.claude/commands/feature-workflow.md`

```yaml
---
allowed-tools: Bash(git:*), Bash(npm:*)
description: Complete feature development workflow
argument-hint: [feature-name]
---

## Step 1: Create feature branch
!git checkout -b feature/$1

## Step 2: Verify branch created
!git branch --show-current

## Step 3: Run initial tests
!npm test

## Step 4: Set up development server
!npm run dev

Feature branch "feature/$1" created and ready for development.

Next steps:
1. Implement the feature
2. Add/update tests
3. Update documentation
4. Run /test to verify
5. Run /commit to save changes
```

**Usage**: `/feature-workflow user-dashboard`

---

### Hotfix Workflow

**File**: `.claude/commands/hotfix.md`

```yaml
---
allowed-tools: Bash(git:*), Bash(npm:*)
description: Create hotfix branch from main
argument-hint: [hotfix-name]
---

## Step 1: Checkout main
!git checkout main

## Step 2: Pull latest changes
!git pull origin main

## Step 3: Create hotfix branch
!git checkout -b hotfix/$1

## Step 4: Verify branch
!git branch --show-current

Hotfix branch "hotfix/$1" created from main.

Critical fix checklist:
- [ ] Identify root cause
- [ ] Write regression test
- [ ] Fix the issue
- [ ] Verify fix works
- [ ] Run all tests
- [ ] Update documentation
```

**Usage**: `/hotfix login-timeout-fix`

---

## Context-Aware Commands

### Contextual Help

**File**: `.claude/commands/context-help.md`

```yaml
---
allowed-tools: Bash(git:*), Bash(ls:*)
description: Show context-aware help
---

## Current directory structure
!ls -la | head -20

## Current git status
!git status --short

## Recent activity
!git log --oneline -3

Based on current context, suggest:
1. Relevant commands to run
2. Next logical steps
3. Common pitfalls to avoid
4. Resources to reference
```

**Usage**: `/context-help`

---

### Project-Specific Analysis

**File**: `.claude/commands/analyze-project.md`

```yaml
---
allowed-tools: Bash(cat:*), Bash(ls:*), Bash(grep:*), Bash(find:*)
description: Analyze project structure and tech stack
---

## Project structure
!ls -la

## Package information
!cat package.json | grep -E '"(name|version|dependencies|scripts)"'

## Configuration files
!ls -la | grep -E "\.(json|yaml|yml|toml|config)$"

## Source code organization
!find src -type d -maxdepth 3 2>/dev/null || find . -type d -name "src" -o -name "lib" -o -name "app" 2>/dev/null | head -10

Analyze and provide:
1. Technology stack identification
2. Project type (frontend, backend, fullstack)
3. Build system and tools
4. Architectural patterns used
5. Recommendations for improvements
```

**Usage**: `/analyze-project`

---

## Conditional Execution Commands

### Smart Git Status

**File**: `.claude/commands/smart-status.md`

```yaml
---
allowed-tools: Bash(git:*), Bash(bash:*), Bash(test:*)
description: Show intelligent git status
---

## Current branch
!git branch --show-current

## Branch summary
!git log --oneline -5

## Staged changes (if any)
!if git diff --cached --quiet; then echo "No staged changes"; else git diff --cached --stat; fi

## Unstaged changes (if any)
!if git diff --quiet; then echo "No unstaged changes"; else git diff --stat; fi

## Untracked files (if any)
!if git ls-files --others --exclude-standard | grep -q .; then git status --short; else echo "No untracked files"; fi

Provide analysis of changes and recommended actions.
```

**Usage**: `/smart-status`

---

### Conditional Test Runner

**File**: `.claude/commands/test-conditional.md`

```yaml
---
allowed-tools: Bash(npm:*), Bash(bash:*), Bash(test:*), Bash(grep:*)
description: Run tests based on changes
---

## Detect what changed
!git diff --name-only HEAD~1 | grep -E "\.(ts|tsx|js|jsx)$" > /tmp/changed-files.txt 2>/dev/null || echo ""

## Run tests if code changed
!if [ -s /tmp/changed-files.txt ]; then npm test; else echo "No code changes, skipping tests"; fi

## Run linting if any files changed
!if [ -s /tmp/changed-files.txt ]; then npm run lint; else echo "No files to lint"; fi
```

**Usage**: `/test-conditional`

---

## Summary Table

| Command | Type | Key Features |
|----------|-------|--------------|
| `review` | Basic | Code review checklist |
| `explain` | Basic | Simple explanations |
| `commit` | Arguments | Git commit with message |
| `review-pr` | Arguments | PR review with focus |
| `tag` | Arguments | Tag management |
| `feature` | Git Workflow | Create feature branch |
| `prepare-release` | Git Workflow | Release preparation steps |
| `test` | Testing | Run all tests |
| `test-file` | Testing | Test specific file |
| `quality-check` | Code Quality | Lint, format, type-check |
| `deploy-staging` | Deployment | Deploy with validation |
| `security-review` | Security | Comprehensive security audit |
| `profile` | Performance | Application profiling |
| `feature-workflow` | Multi-step | Complete feature process |
| `smart-status` | Conditional | Context-aware status |

## Usage Patterns

### 1. Simple One-Liners

For quick, repetitive tasks:

```yaml
---
description: Fix linting issues
---

!npm run lint:fix
```

### 2. With Arguments

For flexible, parameterized commands:

```yaml
---
argument-hint: [file]
description: Analyze file for issues
---

Analyze $1 for:
- Security vulnerabilities
- Performance issues
- Code style violations
```

### 3. Multi-Step Workflows

For complex processes:

```yaml
---
allowed-tools: Bash(git:*), Bash(npm:*)
description: Complete deployment workflow
---

## Step 1: Validate
!npm test

## Step 2: Build
!npm run build

## Step 3: Deploy
!npm run deploy

## Step 4: Verify
!npm run smoke-test
```

### 4. Conditional Logic

For smart, context-aware commands:

```yaml
---
allowed-tools: Bash(bash:*), Bash(git:*)
description: Smart action based on state
---

!if git diff --quiet; then echo "No changes"; else echo "Changes detected"; fi
```

### 5. With Hooks

For validation and cleanup:

```yaml
---
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
          once: true
---

Execute with pre-validation.
```
