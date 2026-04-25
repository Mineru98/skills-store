# Codex Rules

This folder contains the Codex rewrite of `.claude/rules/*.md`.

Codex rules are execution policy files, not general coding-style memory. Only
`.rules` files are interpreted by Codex, and they can control command prefixes
with `prefix_rule(...)`.

Files in this folder:

- `project-dev-workflow.rules`: safe local development and verification commands.
- `project-safety.rules`: prompts or blocks high-risk git, shell, Docker, and deployment commands.
- `project-coding-conventions.md`: compact human-readable rewrite of the Claude coding rules.

Source references:

- `.claude/rules/*.md`
- `docs/codex_rules.md`

Run a policy check with:

```shell
codex execpolicy check --pretty \
  --rules .codex/rules/project-dev-workflow.rules \
  --rules .codex/rules/project-safety.rules \
  -- yarn lint
```
