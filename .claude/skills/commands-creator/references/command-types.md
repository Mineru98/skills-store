# Command Types

Claude Code supports multiple types of slash commands, each serving different purposes.

## Built-in Commands

Built-in commands are provided by Claude Code and available in all sessions. They manage core functionality.

### Common Built-in Commands

| Command | Purpose |
|---------|---------|
| `/add-dir` | Add additional working directories |
| `/agents` | Manage custom AI subagents |
| `/bashes` | List and manage background tasks |
| `/bug` | Report bugs to Anthropic |
| `/clear` | Clear conversation history |
| `/compact [instructions]` | Compact conversation with optional focus |
| `/config` | Open Settings interface (Config tab) |
| `/context` | Visualize current context usage |
| `/cost` | Show token usage statistics |
| `/doctor` | Check Claude Code installation health |
| `/exit` | Exit the REPL |
| `/export [filename]` | Export conversation to file or clipboard |
| `/help` | Get usage help |
| `/hooks` | Manage hook configurations |
| `/ide` | Manage IDE integrations |
| `/init` | Initialize project with `CLAUDE.md` guide |
| `/install-github-app` | Set up Claude GitHub Actions |
| `/login` | Switch Anthropic accounts |
| `/logout` | Sign out from Anthropic account |
| `/mcp` | Manage MCP server connections |
| `/memory` | Edit `CLAUDE.md` memory files |
| `/model` | Select or change AI model |
| `/output-style [style]` | Set output style |
| `/permissions` | View or update permissions |
| `/plan` | Enter plan mode |
| `/plugin` | Manage Claude Code plugins |
| `/pr-comments` | View pull request comments |
| `/privacy-settings` | View privacy settings |
| `/release-notes` | View release notes |
| `/rename <name>` | Rename current session |
| `/remote-env` | Configure remote session environment |
| `/resume [session]` | Resume a conversation |
| `/review` | Request code review |
| `/rewind` | Rewind conversation and/or code |
| `/sandbox` | Enable sandboxed bash tool |
| `/security-review` | Complete security review of changes |
| `/stats` | Visualize daily usage and session history |
| `/status` | Open Settings interface (Status tab) |
| `/statusline` | Set up status line UI |
| `/teleport` | Resume remote session |
| `/terminal-setup` | Install Shift+Enter key binding |
| `/theme` | Change color theme |
| `/todos` | List current TODO items |
| `/usage` | Show plan usage limits |
| `/vim` | Enter vim mode |

### Characteristics
- Always available
- Cannot be overridden by custom commands
- Not available through the `Skill` tool
- Managed by Claude Code system

## Custom Commands

Custom commands are user-defined Markdown files that specify frequently used prompts.

### Project Commands

**Location**: `.claude/commands/`

**Characteristics**:
- Shared with your team via git
- Shown as `(project)` in `/help`
- Take precedence over personal commands with same name
- Version-controlled with your project

**When to use**:
- Project-specific workflows
- Team-standardized prompts
- Workflows that should be tracked with the project

**Example structure**:
```
.claude/commands/
├── review.md
├── deploy.md
└── frontend/
    ├── component.md
    └── test.md
```

### Personal Commands

**Location**: `~/.claude/commands/`

**Characteristics**:
- Available across all projects
- Shown as `(user)` in `/help`
- Overridden by project commands with same name
- Personal to your development style

**When to use**:
- General-purpose utilities
- Personal coding standards
- Prompts you use across multiple projects

**Example structure**:
```
~/.claude/commands/
├── explain.md
├── optimize.md
└── review.md
```

### Priority Rules

When both project and personal commands have the same name:
- Project command takes precedence
- Personal command is silently ignored
- No warning is shown

### Namespacing

Use subdirectories to organize related commands:

```
.claude/commands/
├── frontend/review.md    # Creates /review (project:frontend)
├── backend/review.md     # Creates /review (project:backend)
└── deploy.md             # Creates /deploy (project)
```

Both commands have the same name (`/review`) but are distinguished by their namespace in `/help`.

## Plugin Commands

Plugins can provide custom slash commands that integrate seamlessly with Claude Code.

**Location**: `commands/` directory in plugin root

**Characteristics**:
- Distributed through plugin marketplaces
- Automatically available when plugin is enabled
- Can be namespaced to avoid conflicts
- Support all command features (arguments, frontmatter, etc.)

**Invocation patterns**:
- Direct: `/command-name` (when no conflicts)
- Namespaced: `/plugin-name:command-name` (when needed for disambiguation)

**Example**:
```bash
# Direct invocation
/git-pr-create

# Namespaced invocation (if conflict)
/github:pr-create
```

**When to use**:
- Extending Claude Code with domain-specific functionality
- Providing command sets to other users
- Integrating external services

## MCP Commands

MCP (Model Context Protocol) servers can expose prompts as slash commands.

**Characteristics**:
- Dynamically discovered from connected MCP servers
- Format: `/mcp__<server-name>__<prompt-name>`
- Automatically available when MCP server is connected
- Managed via `/mcp` command

**Format**:
```
/mcp__<server-name>__<prompt-name> [arguments]
```

**Examples**:
```bash
# Without arguments
/mcp__github__list_prs

# With arguments
/mcp__github__pr_review 456
/mcp__jira__create_issue "Bug title" high
```

**Naming conventions**:
- Spaces and special characters become underscores
- Names are lowercase for consistency

**When to use**:
- Integrating external services via MCP
- Accessing server-specific functionality
- Dynamically discovering capabilities from connected servers

## Command Summary

| Type | Location | Discovery | Version Control | Customizable |
|------|----------|------------|-----------------|--------------|
| Built-in | System | Automatic | No | No |
| Project | `.claude/commands/` | Automatic | Yes (git) | Yes |
| Personal | `~/.claude/commands/` | Automatic | No (manual) | Yes |
| Plugin | Plugin directory | When enabled | Yes (plugin dist) | Yes |
| MCP | Server-provided | When connected | No (server) | No |

## Choosing the Right Command Type

| Use Case | Recommended Type |
|----------|------------------|
| Core Claude functionality | Built-in |
| Project-specific workflow | Project custom |
| Personal utility | Personal custom |
| Shareable extension | Plugin |
| External service integration | MCP |
