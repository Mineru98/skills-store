---
name: schedule
description: Run a Codex prompt on a cron schedule or at a specific future time. Codex app Automations is the official, always-on surface for durable recurring schedules — recommend it FIRST; this local skill is a terminal fallback that only fires while its daemon runs. Triggers include "/schedule", "cron", "every Monday 9am", "run this at 3pm", "schedule a codex prompt", "recurring codex task", and one-time future runs ("run once at 3pm", "remind me to check X tomorrow"). For fixed-interval repeats ("every N minutes"), use the separate `loop` skill instead.
---

## Overview

`schedule.mjs` is a dependency-free Node ESM scheduler that registers and fires `codex exec` jobs on a cron schedule or at a one-shot future time. It keeps task state under `.codex/schedule/` and exposes 8 subcommands: `parse-schedule`, `add`, `list`, `cancel`, `status`, `run-due`, `daemon`, `doctor`.

For fixed-interval repeats (`/loop 10m ...`), use the separate `loop` skill — this skill is cron/one-shot only.

## Durable Schedules: Use Automations First

**Codex app Automations** is the official, always-on surface for durable recurring schedules — recommend it first. It persists across reboots and terminal exits without a running process.

The bundled local CLI is a **terminal fallback only**: nothing fires unless the `daemon` process is running. It is NOT an OS service and does not survive terminal exits.

## Local Fallback Usage

All state-mutating commands require `--state-root <dir>`. Conventional path: `--state-root .codex/schedule`.

### Schedule: run on a cron expression

User says `/schedule --cron "0 9 * * 1" summarize open PRs`:

```sh
node scripts/schedule.mjs add \
  --state-root .codex/schedule \
  --cron "0 9 * * 1" \
  --prompt "summarize open PRs" \
  --cwd "$PWD"
```

- Standard 5-field cron: `minute hour day-of-month month day-of-week`.
- After each run, `nextRunAt` recomputes to the next cron time after the run finished.

### Once: run a single time at an absolute moment

User says `/schedule --at 2026-07-03T15:00:00Z check the deploy`:

```sh
node scripts/schedule.mjs add \
  --state-root .codex/schedule \
  --at "2026-07-03T15:00:00Z" \
  --prompt "check the deploy" \
  --cwd "$PWD"
```

- `--at` takes an ISO-8601 datetime. After it runs once, the task becomes `cancelled`.
- `parse-schedule --cron <expr> <prompt>` or `parse-schedule --at <ISO> <prompt>` validates without writing state.

### Manage tasks

```sh
# list all tasks (append --json for machine-readable output)
node scripts/schedule.mjs list --state-root .codex/schedule

# cancel one task
node scripts/schedule.mjs cancel <id> --state-root .codex/schedule

# cancel all active tasks
node scripts/schedule.mjs cancel --all --state-root .codex/schedule

# show task counts and lock state (append --json for JSON output)
node scripts/schedule.mjs status --state-root .codex/schedule
```

### Start the runner

```sh
node scripts/schedule.mjs daemon \
  --state-root .codex/schedule \
  [--poll-ms 5000]       # check interval in ms, default 5000
  [--once]               # run one poll pass then exit
  [--max-runs N]         # exit after N total task fires
  [--codex-bin /path/to/codex]
```

The daemon holds a **single-runner lock** (`scheduled_tasks.lock/`). A second daemon against the same state root fails while the first is alive and reclaims only a provably stale lock (dead PID).

`run-due --state-root .codex/schedule` does one on-demand due-check pass without occupying the daemon lock continuously — useful for CI triggers or manual testing.

### Verify setup

```sh
node scripts/schedule.mjs doctor --state-root .codex/schedule
```

Checks state-root writeability, task count, lock state, and codex binary reachability. `doctor` is read-only and never creates the state root.

## Daemon Requirement

**Nothing fires unless `daemon` (or `run-due`) is running.** Keep the daemon in a persistent terminal or tmux session. It exits cleanly on SIGINT/SIGTERM, releasing the lock.

## Run Evidence

Each task run is recorded under `.codex/schedule/runs/<taskId>/` with timestamped `.jsonl` (full codex stdout), `.last.txt` (last Codex message), and optionally `.stderr.txt` files.

## Safety Defaults

- `--codex-arg` pass-through uses a **default-deny allowlist**: only a small, vetted set of flags that cannot weaken the sandbox, approval policy, or config is permitted — currently `--model`/`-m` (with its value). Every other flag is rejected with a `ValidationError` naming the arg. This explicitly rejects sandbox/approval/config overrides such as `--sandbox`/`-s danger-full-access`, `--config`/`-c ...`, `--ask-for-approval`/`-a never`, `--full-auto`, `--profile`, `--dangerously-bypass-approvals-and-sandbox`, and `--yolo` (in both space- and `=`-joined forms). Args are additionally constrained to the `[-A-Za-z0-9_.,:=/@+]` character set.
- Allowed pass-through args are inserted **before** the `-` stdin sentinel so codex parses them as flags and still reads the prompt from stdin.
- The script never emits approval- or sandbox-bypassing flags to `codex exec`.
- Does not install OS cron, launchd, or any system service.

## Reference

Read `references/schedule-contract.md` for the full state/lock schema, cron/one-shot grammar specification, and complete per-command contracts.
