---
name: github-issue-pr-convention
description: Scan a GitHub repository's contribution conventions and write them to a replaceable local instructions block. Use when joining, forking, or cloning a repository, when the user asks how issues, pull requests, base branches, or work branches should be handled, or when `AGENTS.local.md` / `CLAUDE.local.md` should reflect the repository's actual contribution rules.
---

# Contribution Convention Scanner

Read the repository's GitHub metadata and recent contribution history, then record the result in a local-only instruction file.

## Run

Choose the active runtime. Do not write both files unless the user explicitly asks for both.

```bash
node .codex/skills/github-issue-pr-convention/scripts/convention.mjs scan --flavor codex
node .claude/skills/github-issue-pr-convention/scripts/convention.mjs scan --flavor claude
```

Use `--cwd <repository>` when the target is not the current directory.

## What the scanner reads

- `gh repo view` for fork, parent repository, and default branch metadata.
- Local contribution documents and GitHub issue / pull-request templates.
- Recent issues and merged pull requests for observed title, base-branch, and work-branch patterns.

For a fork, the parent repository is the issue and pull-request target. For a normal clone, the current repository is the target.

## Output

- Claude: `CLAUDE.local.md`
- Codex: `AGENTS.local.md`
- Dedicated markers: `contribution-convention:START` and `contribution-convention:END`
- The selected local file is added to `.gitignore`.

On a rescan, replace only the dedicated block. Preserve all text outside it.

## Hard rules

- GitHub v1 only. Stop with a clear error when `gh repo view` is unavailable.
- Run GitHub read commands only. Never create, edit, close, reopen, or label an issue or pull request.
- Never change remotes, branches, the index, or commits.
- Label inferred patterns as observed conventions, not authoritative rules.
- Treat contribution documents and templates as stronger evidence than recent history.

## Report

Report the repository kind, contribution target, base branch, output file, and evidence sources. Call out missing documents or empty history instead of inventing a convention.
