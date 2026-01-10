# Frontmatter Reference

Command files support YAML frontmatter for specifying metadata about the command.

## Frontmatter Structure

Frontmatter is placed at the top of a command file, between triple-dash lines:

```yaml
---
field1: value1
field2: value2
---

# Command content here
```

## Available Fields

| Field | Required | Default | Description |
|-------|----------|----------|-------------|
| `description` | No | First line of prompt | Brief description of what the command does |
| `allowed-tools` | No | Inherits from conversation | List of tools the command can use |
| `argument-hint` | No | None | The arguments expected for the slash command |
| `model` | No | Inherits from conversation | Specific model string to use |
| `disable-model-invocation` | No | `false` | Whether to prevent Skill tool from calling this command |
| `hooks` | No | None | Hooks scoped to this command's execution |

## Field Details

### description

**Purpose**: Brief description of what the command does. This is shown to users when auto-completing the slash command.

**Default**: First line from the prompt body if not specified.

**Examples**:

```yaml
---
description: Review code for security vulnerabilities
---
```

```yaml
---
description: Create a git commit with proper formatting
---
```

**Best practices**:
- Keep descriptions concise (under 100 characters)
- Use imperative language ("Review", "Create", "Fix")
- Be specific about what the command does
- Avoid technical jargon unless necessary

### allowed-tools

**Purpose**: List of tools the command can use. This is a security feature to prevent commands from executing unauthorized actions.

**Default**: Inherits from the conversation's current permissions.

**Syntax**:

```yaml
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
---
```

**Wildcard support**:

- Exact match: `Bash(git status)`
- Prefix match: `Bash(git status:*)`
- All git commands: `Bash(git:*)`

**Multiple tools**:

```yaml
---
allowed-tools:
  - Bash(git add:*)
  - Bash(git status:*)
  - Bash(git commit:*)
  - Read
  - Write
---
```

**When to specify**:
- Using bash execution with `!` prefix
- Want to restrict command to specific tools
- Security-sensitive operations
- Commands that should only read (not write) files

**IMPORTANT**: When using bash execution in commands, you **must** include the relevant bash commands in `allowed-tools`:

```yaml
---
# Without allowed-tools, bash execution will fail
allowed-tools: Bash(git status:*), Bash(git diff:*)
---

## Get git status
!git status
```

### argument-hint

**Purpose**: The arguments expected for the slash command. This hint is shown to the user when auto-completing the slash command.

**Syntax**: Text describing expected arguments, using square brackets `[]` for optional items and pipe `|` for alternatives.

**Examples**:

```yaml
---
argument-hint: [message]
---
```

```yaml
---
argument-hint: [pr-number] [focus-area]
---
```

```yaml
---
argument-hint: add [tagId] | remove [tagId] | list
---
```

**Usage in autocomplete**:
```
/command-name [message]
/command-name [pr-number] [focus-area]
/command-name add [tagId] | remove [tagId] | list
```

**Best practices**:
- Use consistent naming conventions
- Show alternatives clearly with `|`
- Mark optional items with `[]`
- Keep hints under 100 characters

### model

**Purpose**: Specify a particular model to use for executing this command.

**Default**: Inherits from the conversation's current model.

**Syntax**:

```yaml
---
model: claude-3-5-haiku-20241022
---
```

**Common model strings**:
- `claude-sonnet-4-5-20250929`
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`

**When to use**:
- Command is simple and doesn't need powerful model
- Want faster execution for quick tasks
- Specific model behavior needed
- Cost optimization for frequently-used commands

**Example**:

```yaml
---
model: claude-3-5-haiku-20241022
description: Create a simple git commit
argument-hint: [message]
---

Create a git commit with message: $ARGUMENTS
```

### disable-model-invocation

**Purpose**: Whether to prevent the `Skill` tool from calling this command programmatically.

**Default**: `false`

**Values**: `true` or `false`

**When to use**:
- Command should only be invoked manually by user
- Security-sensitive operations
- Commands with side effects you want explicit control over
- Debugging or destructive operations

**Example**:

```yaml
---
disable-model-invocation: true
description: Dangerous cleanup operation
---

Delete all temporary files and clear cache.
```

**Note**: When set to `true`, the command's metadata is also removed from the `Skill` tool's context.

### hooks

**Purpose**: Define hooks that run during the command's execution. Hooks are scoped to that command's execution and are automatically cleaned up when the command finishes.

**Default**: None

**Syntax**:

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

Deploy to staging environment.
```

**Hook types**:
- `PreToolUse`: Run before a tool is used
- `PostToolUse`: Run after a tool is used
- `Stop`: Run when the command stops

**Matcher**: The tool type to match (e.g., "Bash", "Read", "Write")

**Options**:
- `once: true`: Run the hook only once per session

**When to use**:
- Pre-deployment validation
- Post-operation notifications
- Cleanup after command completion
- Security checks before sensitive operations

## Complete Examples

### Example 1: Simple Review Command

```yaml
---
description: Review code for security vulnerabilities
---

Review this code for security vulnerabilities:
- SQL injection
- XSS
- Authentication/authorization issues
- Input validation problems
```

### Example 2: Commit Command with Bash and Tools

```yaml
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Read
description: Create a git commit from staged changes
argument-hint: [message]
---

## Current git status
!git status

## Staged changes
!git diff --cached

Create a git commit with message: $ARGUMENTS
```

### Example 3: Model-Specific Command

```yaml
---
model: claude-3-5-haiku-20241022
description: Quick code format check
argument-hint: [file]
---

Check the formatting of $1 or current file if not specified.

Report:
- Line length violations
- Indentation issues
- Missing semicolons
- Style guide violations
```

### Example 4: Secure Command with Hooks

```yaml
---
allowed-tools: Bash(git:*), Read
description: Deploy to staging
argument-hint: [environment]
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

Deploy to $1 environment.

Steps:
1. Run tests
2. Build application
3. Deploy to staging
4. Run smoke tests
5. Rollback if tests fail
```

### Example 5: Manual-Only Command

```yaml
---
disable-model-invocation: true
description: Delete all temporary files
---

Delete all files in:
- /tmp/myapp/*
- ./cache/*
- ./logs/*

WARNING: This operation cannot be undone.
```

## Frontmatter Validation

Claude Code automatically validates command frontmatter. Common errors:

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid YAML | Syntax error in YAML | Check for proper indentation and quotes |
| Unknown field | Invalid frontmatter field | Use only documented fields |
| Invalid model | Model string not recognized | Use valid model identifier |
| Invalid allowed-tools | Tool syntax error | Check tool and wildcard syntax |

## Best Practices

1. **Always include description**: Even for simple commands, a description improves discoverability
2. **Specify allowed-tools with bash execution**: Prevents unauthorized command execution
3. **Use argument-hint for complex commands**: Helps users understand expected input
4. **Consider model for simple commands**: Using Haiku for simple tasks can reduce cost
5. **Set disable-model-invocation for sensitive operations**: Prevents accidental programmatic execution
6. **Keep frontmatter concise**: Only include necessary fields
7. **Use hooks sparingly**: Hooks add complexity; only use when necessary
