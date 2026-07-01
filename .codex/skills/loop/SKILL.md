---
name: loop
description: Run a Codex prompt repeatedly on a fixed interval. Use for "/loop", "run this every N minutes/hours", "poll X every 5 minutes", "repeat this Codex prompt", or any recurring interval-based Codex job. This is the interval-repeat companion to the separate `schedule` skill (cron / specific-time). For a durable, always-on alternative that survives reboots and terminal exits, prefer Codex app Automations; this local CLI is a terminal fallback that only fires while its daemon process is running.
---

## Overview

`loop.mjs` is a dependency-free Node ESM runner that registers and fires `codex exec` jobs on a **fixed interval**. It manages task state in `.codex/loop/` and exposes 8 subcommands: `parse-loop`, `add`, `list`, `cancel`, `status`, `run-due`, `daemon`, `doctor`.

It supports only the interval-repeat (`loop`) task kind. For cron schedules or a one-shot run at a specific time, use the separate `schedule` skill instead.

## Durable Always-On: Use Automations First

**Codex app Automations** is the official, always-on surface for durable recurring runs — recommend it first. It persists across reboots and terminal exits without a running process.

The bundled local CLI is a **terminal fallback only**: nothing fires unless the `daemon` process is running. It is NOT an OS service and does not survive terminal exits.

## Local Fallback Usage

All state-mutating commands require `--state-root <dir>`. Conventional path: `--state-root .codex/loop`.

### Add a loop task

User says `/loop 1m check CI status`:

```sh
node scripts/loop.mjs add \
  --state-root .codex/loop \
  --interval 1m \
  --prompt "check CI status" \
  --cwd "$PWD"
```

- `add` is loop-only: `--kind` is optional and, if given, must be `loop`.
- `parse-loop` validates a `/loop [interval] <prompt>` spec and returns JSON without writing state.
- Default interval when omitted: 10m. Units: `s` (rounds up to nearest minute, min 1m), `m`, `h`, `d`.
- Optional `--next-run-at <ISO>` overrides the first computed run time (testing/backfill).

### Manage tasks

```sh
# list all tasks (append --json for machine-readable output)
node scripts/loop.mjs list --state-root .codex/loop

# cancel one task
node scripts/loop.mjs cancel <id> --state-root .codex/loop

# cancel all active tasks
node scripts/loop.mjs cancel --all --state-root .codex/loop

# show task counts and lock state (append --json for JSON output)
node scripts/loop.mjs status --state-root .codex/loop
```

### Start the runner

```sh
node scripts/loop.mjs daemon \
  --state-root .codex/loop \
  [--poll-ms 5000]       # check interval in ms, default 5000
  [--once]               # run one poll pass then exit
  [--max-runs N]         # exit after N total task fires
  [--codex-bin /path/to/codex]
```

The daemon holds a **single-runner lock** (`scheduled_tasks.lock/`). A second daemon against the same state root fails while the first is alive and reclaims only a provably stale lock (dead PID).

`run-due` does one on-demand due-check pass without occupying the daemon lock continuously — useful for CI triggers or manual testing. It accepts the same `--codex-bin` and repeatable `--codex-arg` flags.

### Verify setup

```sh
node scripts/loop.mjs doctor --state-root .codex/loop
```

Checks state-root writeability, task count, lock state, and codex binary reachability. It is read-only and never creates the state root.

## Daemon Requirement

**Nothing fires unless `daemon` (or `run-due`) is running.** Keep the daemon in a persistent terminal or tmux session. It exits cleanly on SIGINT/SIGTERM, releasing the lock.

After each run, a loop task's next run is recomputed as `finishedAt + intervalMs`, so the interval is measured from run completion and never drifts.

## Run Evidence

Each task run is recorded under `.codex/loop/runs/<taskId>/` with timestamped `.jsonl` (full codex stdout), `.last.txt` (last Codex message), and optionally `.stderr.txt` files.

## Safety Defaults

- `--codex-arg` pass-through uses a **default-deny allowlist**: only a small, vetted set of flags that cannot weaken the sandbox, approval policy, or config is permitted — currently `--model`/`-m` (with its value). Every other flag is rejected with a `ValidationError` naming the arg. This explicitly rejects sandbox/approval/config overrides such as `--sandbox`/`-s danger-full-access`, `--config`/`-c ...`, `--ask-for-approval`/`-a never`, `--full-auto`, `--profile`, `--dangerously-bypass-approvals-and-sandbox`, and `--yolo` (in both space- and `=`-joined forms). Args are additionally constrained to the `[-A-Za-z0-9_.,:=/@+]` character set.
- Allowed pass-through args are inserted **before** the `-` stdin sentinel so codex parses them as flags and still reads the prompt from stdin.
- The script never emits approval- or sandbox-bypassing flags to `codex exec`.
- Does not install OS cron, launchd, or any system service.

## Reference

Read `references/loop-contract.md` for the full state/lock schema, interval grammar specification, and complete per-command contracts.
