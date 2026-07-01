# loop — Technical Contract

> Derived from `scripts/loop.mjs` and `scripts/loop.test.mjs`. Documents the
> **actual** implementation; do not invent behavior. This skill supports ONLY
> the interval-repeat (`loop`) task kind. For cron / specific-time runs, use
> the separate `schedule` skill.

## Table of Contents

1. [State Layout](#1-state-layout)
2. [Lock Schema](#2-lock-schema)
3. [Interval Grammar](#3-interval-grammar)
4. [Command Contracts](#4-command-contracts)
5. [Safety Model](#5-safety-model)
6. [Cleanup Rules](#6-cleanup-rules)
7. [Local-Only Ignore Guidance](#7-local-only-ignore-guidance)

---

## 1. State Layout

All state lives under the directory passed as `--state-root` (no built-in
default; conventionally `.codex/loop/` relative to the project root).

```
<stateRoot>/
├── tasks.json                         # task registry
├── scheduled_tasks.lock/              # directory-based mutex (see §2)
│   └── owner.json
└── runs/
    └── <taskId>/
        ├── <fs-timestamp>.jsonl       # full codex exec stdout (JSON Lines)
        ├── <fs-timestamp>.last.txt    # last message written by codex
        └── <fs-timestamp>.stderr.txt  # stderr capture (written when non-empty)
```

The `<fs-timestamp>` format is the ISO-8601 date with `:` and `.` replaced by
`-` (e.g. `2026-07-02T10-15-00-000Z`), safe for all file systems.

### 1.1 `tasks.json` shape

```jsonc
{
  "version": 1,
  "tasks": [ /* Task[] */ ]
}
```

Missing `version` is treated as `1`. A missing or corrupt file is treated as
`{ version: 1, tasks: [] }`. Writes are atomic: a `.pid.tmp` sibling is
written and renamed into place.

### 1.2 Task object fields

All fields are always present on a stored loop task.

```
Field         Type             Notes
-----------   ---------------  -------------------------------------------
id            string           Format: t_<base36-ts+counter>_<hex-rand>
kind          "loop"           Always "loop" for this skill
prompt        string           Sent on stdin to codex exec
cwd           string           Absolute path (resolved at add time)
status        "active"         Will be run when due
              "cancelled"      Will not be run; terminal state
intervalMs    number           Repeat interval (milliseconds, ≥60000)
createdAt     string (ISO)     Creation timestamp
updatedAt     string (ISO)     Last mutation timestamp
nextRunAt     string (ISO)     Next scheduled execution time
lastRunAt     null | string    ISO of most recent run finish; null if never run
runs          Run[]            Chronological run records (see §1.3)
```

**Status transitions:**
- `add` → `active`
- `cancel` → `cancelled`

A loop task never self-terminates; it repeats until cancelled.

### 1.3 Run record fields

Appended to `task.runs[]` after every execution attempt.

```
Field             Type           Notes
---------------   ------------   ------------------------------------------
startedAt         string (ISO)
finishedAt        string (ISO)
exitCode          number         0 = success; otherwise the real codex exit code.
                                 127 is reserved for "codex binary not found"
                                 (spawn ENOENT). Other spawn-level errors map to 1.
status            "succeeded"    exitCode === 0
                  "failed"       exitCode !== 0
jsonlPath         string         Absolute path to the .jsonl file (stdout, streamed)
lastMessagePath   string         Absolute path to the .last.txt file
attempt           number         1-based count of run records for this task
spawnErrorCode    string?        Present only on a spawn-level failure; e.g.
                                 "ENOENT" (codex not found) or the underlying code.
                                 A normal non-zero codex exit does NOT set this.
backoffMs         number?        Failure only; exponential cap at 3 600 000 ms
nextRetryAt       string (ISO)?  Failure only; finishedAt + backoffMs
```

The child's stdout is streamed directly to `<fs-timestamp>.jsonl` through a file
descriptor, so there is **no buffer limit** — `codex exec --json` output larger
than Node's 1 MB `spawnSync` default is written verbatim and never truncated or
killed mid-run. A genuine >1 MB success therefore records `exitCode 0 /
succeeded` with a complete jsonl; only a true `ENOENT` records `127`.

**Backoff formula (failure only):**
```
backoffMs = min(3 600 000, 60 000 × 2^(attempt-1))
```
Caps at 60 minutes. Note: the runner does NOT auto-retry — `backoffMs` and
`nextRetryAt` are informational fields for callers to inspect. The next run is
still governed by the fixed interval (§3.5).

---

## 2. Lock Schema

### 2.1 Directory structure

The lock is the **directory** `<stateRoot>/scheduled_tasks.lock/`. Directory
creation is atomic on POSIX; that property is the mutex primitive.

```
<stateRoot>/scheduled_tasks.lock/
└── owner.json
```

`owner.json` fields:

```jsonc
{
  "pid":        12345,               // process.pid of the lock holder
  "procStart":  1719900000000,       // floor(Date.now() - process.uptime()*1000)
  "acquiredAt": "2026-07-02T10:00:00.000Z",
  "sessionId":  "12345"              // CODEX_LOOP_SESSION_ID env var or pid
}
```

### 2.2 Acquisition (`acquireLock`)

```
default retries : 20
default delay   : 25 ms between attempts
```

Algorithm per attempt:

1. `fs.mkdirSync(lockDir)` — if succeeds, write `owner.json`, done.
2. If `EEXIST` (already exists):
   a. Read `owner.json`.
   b. **Stale check** (see §2.3).
      - **stale** → **single-winner reclaim via atomic rename CAS**: attempt
        `fs.renameSync(lockDir, <lockDir>.stale.<pid>.<rand>)`. Directory rename
        is atomic, so exactly ONE concurrent racer wins the move; the winner
        deletes the staged dir. A loser's rename throws `ENOENT` (already moved)
        and it simply loops and re-evaluates — it never blindly `rm`+`mkdir`.
        The next loop iteration re-attempts the exclusive `mkdir`; if another
        racer re-acquired first, that iteration observes a live owner and is
        treated as busy. (If the captured dir turns out to hold a freshly
        re-acquired LIVE owner, it is restored, not deleted.)
      - **busy** (owner alive or `EPERM`) → sleep and retry.
   c. After all retries exhausted → throw `ContentionError("loop runner is
      busy: lock held (<path>)")`.

This atomic rename compare-and-swap is the invariant that prevents two
processes which both observed the same ESRCH-stale owner from both ending up
holding the single-runner lock.

### 2.3 Stale detection detail

A lock is **stale** when `owner.json` exists AND either:
- `process.kill(pid, 0)` throws `code === 'ESRCH'` (no such process), **or**
- the recorded `pid` equals **our** pid but the recorded `procStart` differs
  from this process's start marker — i.e. the pid was recycled to us and the
  original owner is gone (best-effort recycled-pid detection; without it a
  recycled pid would read as "alive" forever and stay permanently busy).

All other conditions (missing/unparseable `owner.json`, a live pid with matching
or unknown start, `EPERM`) are treated as **busy** — the runner never races
against an uncertain owner.

### 2.4 Guaranteed release

Release happens in a `try/finally` block wrapping every lock-holding
operation, and also via process-level hooks registered at module load:

```
process.on('exit', cleanupOwnedLocks)    // normal exit
process.on('SIGINT',  ...)               // exits with code 130
process.on('SIGTERM', ...)               // exits with code 143
```

`releaseLock` only removes the directory when the current process owns it
(matched by pid or tracked in the in-process `heldLocks` Set).

### 2.5 Which subcommands take the lock

```
Lock required       : add, cancel, run-due, daemon
Read-only (no lock) : list, status, parse-loop, doctor
```

`daemon` holds the lock for its entire lifetime. `run-due` acquires and
releases around the due-check pass (unless called from inside `daemon`, in
which case the lock is already held).

### 2.6 Concurrency model and limitations

The lock is designed for the **single-daemon model**: run at most ONE `daemon`
per state root. Under that model the invariant is fully upheld — including the
recovery case the lock exists for: one daemon (or one-shot `run-due`) starting
against a crash-left stale lock. The 2- and 3-actor reclaim races are fully
serialized by the atomic rename CAS (§2.2).

Known limitation (does not occur in the single-daemon model): if **multiple**
processes concurrently race to reclaim the **same** crash-left stale lock (a
≥4-actor interleaving where a fresh owner re-acquires inside another reclaimer's
rename window), reclaim is best-effort. The restore path is deliberately
**non-destructive** — it never `rm`s a live owner's lock — so the worst case is
a leftover `<lockDir>.stale.<pid>.<rand>` staging directory orphaned on disk,
not a deleted live lock. Such staging dirs are inert and safe to delete manually
(`rm -rf .codex/loop/scheduled_tasks.lock.stale.*`). Do not run multiple
concurrent daemons against one state root; use one daemon (or Codex app
Automations) as documented.

---

## 3. Interval Grammar

### 3.1 Token syntax

```
<positive-integer><unit>
unit : s (seconds) | m (minutes) | h (hours) | d (days)
```

Regex: `/^(\d+)([smhd])$/` — no spaces, no decimals.

Zero is rejected: `ValidationError("interval must be greater than zero: 0m")`.

Unknown unit is rejected: `ValidationError("unknown interval unit: x")`.

### 3.2 Seconds rounding

Seconds are rounded **up** to the nearest whole minute with a hard floor of
**60 000 ms** (1 minute):

```
effectiveMs = max(60000, ceil(n / 60) × 60000)
```

### 3.3 Conversion table

```
Input   Effective ms   Effective minutes
------  -------------  -----------------
1s      60 000         1
30s     60 000         1  (floor)
60s     60 000         1
61s     120 000        2  (ceil)
90s     120 000        2
1m      60 000         1
2m      120 000        2
10m     600 000        10
1h      3 600 000      60
1d      86 400 000     1440
```

### 3.4 Default interval

When `parse-loop` receives a spec whose first whitespace-delimited token does
**not** match `/^\d+[a-zA-Z]+$/`, no interval token is consumed and the
default is applied:

```
default intervalMs = 600 000  (10 minutes)
```

`add` requires an explicit `--interval` token — the 10m default applies only to
`parse-loop` spec parsing.

### 3.5 Post-run scheduling

After a successful or failed run, `nextRunAt` is advanced:
```
nextRunAt = finishedAt + intervalMs
```
The interval is measured from run completion, not from the previous
`nextRunAt`, preventing drift accumulation.

---

## 4. Command Contracts

All subcommands share the pattern:
```
node loop.mjs <subcommand> [flags] [positional...]
```

Flags use `--key value` or `--key=value`. Multi-value flags use repeated
`--codex-arg value`. Boolean flags: `--json`, `--all`, `--once`, `--help`.

### 4.1 `parse-loop`

**Purpose:** Parse and validate a loop spec without writing state.

**Flags:** positional arguments form the spec: `[interval] <prompt>`

**Output (stdout):** single JSON line
```json
{"kind":"loop","intervalMs":60000,"prompt":"say hi"}
```

**Effect:** none (read-only / no lock).

### 4.2 `add`

**Purpose:** Create a new loop task and persist it.

**Required flags:**
```
--state-root <dir>
--interval <token>     e.g. 5m (kind-required field)
--prompt <text>
--cwd <dir>
```

**Optional flags:**
```
--kind loop            optional; if present it MUST be "loop"
--next-run-at <ISO>    override computed nextRunAt (testing/backfill)
```

`add` is loop-only. `--kind` is not required; if given with any value other than
`loop` it is rejected with a `ValidationError`.

**Output (stdout):**
```
added t_<id> kind=loop status=active nextRunAt=<ISO> prompt=<text>
```

**Effect:** acquires lock, appends task to `tasks.json`, releases lock.

### 4.3 `list`

**Purpose:** Show all tasks.

**Required flags:** `--state-root <dir>`

**Optional flags:** `--json` (emit full JSON array)

**Output (stdout, text mode):**
```
<id>  kind=loop  status=active  nextRunAt=<ISO>  prompt=<text>
```
or `(no tasks)` if empty.

**Effect:** none (read-only / no lock). Reads `tasks.json` directly.

### 4.4 `cancel`

**Purpose:** Mark one or all tasks as cancelled.

**Required:** `--state-root <dir>` plus either `<id>` (positional) or `--all`.

**Output (stdout):**
```
cancelled <id|all> (<n> task(s) changed)
```

Missing id → `ValidationError`.

**Effect:** acquires lock, sets `status = "cancelled"`, writes `tasks.json`,
releases lock.

### 4.5 `status`

**Purpose:** Report aggregate counts and lock state.

**Required flags:** `--state-root <dir>`

**Optional flags:** `--json`

**Output (JSON mode):**
```json
{
  "stateRoot": "/abs/path",
  "total": 3,
  "active": 2,
  "cancelled": 1,
  "lockPresent": false,
  "lockStale": false
}
```

**Effect:** none (read-only / no lock). `lockStale` applies the same stale
detection as acquisition (ESRCH / recycled-pid check).

### 4.6 `run-due`

**Purpose:** Execute all tasks whose `nextRunAt ≤ now`.

**Required flags:** `--state-root <dir>`

**Optional flags:**
```
--codex-bin <path>     default: "codex" (resolved via PATH)
--codex-arg <arg>      repeatable; validated by the allowlist (§5.2)
--now <ISO>            override current time (testing/backfill)
```

**Codex invocation (exact):**
```sh
<codexBin> exec --cd <cwd> --json --output-last-message <p> [allowlisted --codex-arg ...] -
```
`task.prompt` is written to stdin. Allowlisted `--codex-arg` values (see §5.2)
are inserted **before** the `-` stdin sentinel so codex parses them as flags.
The child's stdout is streamed straight into the run's `.jsonl` file via a file
descriptor — unbounded, never truncated by a buffer limit.

**Output (stdout):**
```
run <id> succeeded
run <id> failed exit=<n>
run-due: no due tasks      (when none were due)
```

**Effect:** acquires lock; for each due task runs codex, writes run files
under `runs/<taskId>/`, updates task in `tasks.json`; releases lock.

### 4.7 `daemon`

**Purpose:** Polling loop that calls `run-due` repeatedly.

**Required flags:** `--state-root <dir>`

**Optional flags:**
```
--codex-bin <path>     default: "codex"
--codex-arg <arg>      repeatable
--poll-ms <n>          poll interval in ms (default: 5000)
--once                 fire one poll pass then exit
--max-runs <n>         exit after N total runs (across all tasks)
```

**Output (stdout):**
```
daemon: started (poll-ms=5000)
run <id> succeeded
...
daemon: exiting after <n> run(s)
```

**Effect:** acquires lock once at startup and holds it for the daemon's
entire lifetime (internal `run-due` passes use `alreadyLocked=true`). Lock
released in `finally` block on exit or signal.

### 4.8 `doctor`

**Purpose:** Health check with ignore guidance. Always prints local-only
guidance regardless of outcome.

**Required flags:** `--state-root <dir>`

**Optional flags:** `--codex-bin <path>` (default: `"codex"`)

**Output (stdout — always):**
```
Local-only state: add <stateRoot>/ to your .gitignore; do not commit these files (local-only).
state-root: missing (not created — doctor is read-only)   # only when absent
state-root writable: true|false
tasks: <n>
lock: present=false stale=false
codex: OK (/resolved/path)
```

**Output (stderr — on failure):**
```
doctor: codex binary not found or not executable (<name>); install codex or pass --codex-bin
```
Exit code non-zero when codex binary not found.

**Effect:** none (READ-ONLY). It does not acquire the lock and — unlike every
other state-mutating subcommand — it does **not** create the state root. If the
state root is missing, doctor reports it and leaves it uncreated.

---

## 5. Safety Model

### 5.1 Approval and sandbox defaults are never weakened

The script never emits flags that bypass Codex approval or sandbox policies.
The fixed codex invocation is:

```sh
codex exec --cd <cwd> --json --output-last-message <p> [allowlisted args] -
```

No `--dangerously-bypass-approvals-and-sandbox` or equivalent flags are added
automatically, and none can be smuggled in via `--codex-arg` (see §5.2).

### 5.2 `--codex-arg` pass-through validation (default-deny ALLOWLIST)

User-supplied extra args are validated by `sanitizeCodexArgs` before use. The
model is **default-deny**: an arg is dropped unless it is explicitly allowed.

**Allowlist (the only flags that pass):**
```
--model <value>   / -m <value>     model selection; may also be --model=<value>
```
`--model`/`-m` cannot relax the sandbox, approval policy, or config. Its value
token is consumed with the flag (and rejected if it looks like another flag, so
`--model --sandbox` cannot smuggle a second flag through).

**Everything else is rejected** with
`ValidationError("refusing codex arg not on allowlist: <arg>")`, including —
in both space- and `=`-joined forms — `--sandbox`/`-s`, `--ask-for-approval`/`-a`,
`--config`/`-c`, `--full-auto`, `--profile`,
`--dangerously-bypass-approvals-and-sandbox`, and `--yolo`.

**Character guard (applied to every token):**
```
/^[-A-Za-z0-9_.,:=/@+]+$/
```
Any token with other characters → `ValidationError("invalid codex arg: <arg>")`.
Shell-injection characters (`;`, `$`, spaces, quotes, etc.) are blocked.

**Ordering:** allowlisted args are placed **before** the `-` stdin sentinel in
the codex argv (see §4.6), so they are parsed as flags rather than as positional
input after `-`.

### 5.3 No OS-level hooks

The runner installs no OS cron jobs, launchd plists, systemd units, or any
global hook. All scheduling is internal state in `tasks.json`; the daemon or an
external caller of `run-due` must be running for tasks to fire.

---

## 6. Cleanup Rules

### 6.1 Lock cleanup on exit

Three handlers are registered at module load:

```js
process.on('exit', cleanupOwnedLocks)       // covers all exit paths
process.on('SIGINT',  () => { cleanup(); process.exit(130); })
process.on('SIGTERM', () => { cleanup(); process.exit(143); })
```

`cleanupOwnedLocks` iterates the in-process `heldLocks` Set, verifies each
entry is still owned by this pid, and calls `removeLockDir` (rmSync of
`owner.json` then rmdirSync of the directory).

`releaseLock` is also called explicitly in every `try/finally` block.

### 6.2 Recovering a stale lock manually

If the daemon was killed with SIGKILL (lock not cleaned up) and the stale
reclaim path doesn't fire automatically:

```sh
rm -rf <stateRoot>/scheduled_tasks.lock
```

This is safe when the original daemon process is confirmed dead. `acquireLock`
will auto-reclaim a stale lock on the next invocation when it detects ESRCH,
so in most cases no manual cleanup is needed. Any orphaned
`scheduled_tasks.lock.stale.*` staging directory (§2.6) is inert and can also be
removed manually.

### 6.3 Run log locality

Files under `runs/` are written to the local filesystem only. They are never
uploaded, synced, or referenced outside the local `stateRoot`. Each run
produces at most three files: `.jsonl` (always; codex stdout streamed verbatim
through a file descriptor, so it is unbounded and never truncated), `.last.txt`
(always, even if empty), and `.stderr.txt` (streamed to a fd during the run,
then kept only when stderr was non-empty — empty stderr files are removed).

---

## 7. Local-Only Ignore Guidance

The `doctor` subcommand **always** outputs this guidance:

```
Local-only state: add <stateRoot>/ to your .gitignore;
do not commit these files (local-only).
```

**Recommended `.gitignore` entry** (adjust path to match `--state-root`):

```gitignore
.codex/loop/
```

This covers `tasks.json`, `scheduled_tasks.lock/`, and all `runs/` logs.

**The runner does NOT auto-edit any `.gitignore` file.** Adding the ignore
entry is the operator's responsibility.
