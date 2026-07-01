#!/usr/bin/env node
// schedule.mjs — durable cron/one-shot scheduler for `codex exec` jobs.
// Safe by default: never emits approval/sandbox-weakening flags.
// Node ESM, no external dependencies.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.exitCode = 1;
  }
}
class ContentionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContentionError';
    this.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
function sleepSync(ms) {
  if (ms <= 0) return;
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
}

function fsSafeTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

// A per-process stable start marker. Differs after a real process restart
// because both Date.now() and process.uptime() reset per process launch.
const PROC_START = Math.round(Date.now() - process.uptime() * 1000);

// ---------------------------------------------------------------------------
// Cron parsing (standard 5-field)
// ---------------------------------------------------------------------------
function parseCronField(field, min, max) {
  const values = new Set();
  for (const part of field.split(',')) {
    let step = 1;
    let hasStep = false;
    let rangeStr = part;
    if (part.includes('/')) {
      const [r, s] = part.split('/');
      if (s === undefined || !/^\d+$/.test(s) || parseInt(s, 10) === 0) {
        throw new ValidationError(`cron field '${field}' has invalid step in '${part}'`);
      }
      step = parseInt(s, 10);
      hasStep = true;
      rangeStr = r;
    }
    let lo;
    let hi;
    if (rangeStr === '*') {
      lo = min;
      hi = max;
    } else if (rangeStr.includes('-')) {
      const [a, b] = rangeStr.split('-');
      if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) {
        throw new ValidationError(`cron field '${field}' has invalid range '${rangeStr}'`);
      }
      lo = parseInt(a, 10);
      hi = parseInt(b, 10);
    } else {
      if (!/^\d+$/.test(rangeStr)) {
        throw new ValidationError(`cron field '${field}' has invalid value '${rangeStr}'`);
      }
      lo = parseInt(rangeStr, 10);
      // crontab(5): a bare single value WITH a step ("5/15") means "from 5 to
      // the field max, stepping" (=> 5,20,35,50 for minutes). Without a step it
      // is just the single value.
      hi = hasStep ? max : lo;
    }
    if (lo < min || hi > max || lo > hi) {
      throw new ValidationError(`cron field '${field}' value out of range (allowed ${min}-${max})`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return values;
}

function parseCron(expr) {
  const raw = String(expr == null ? '' : expr).trim().split(/\s+/).filter(Boolean);
  if (raw.length !== 5) {
    throw new ValidationError(`cron must have exactly 5 fields, got ${raw.length}`);
  }
  return {
    minute: parseCronField(raw[0], 0, 59),
    hour: parseCronField(raw[1], 0, 23),
    dom: parseCronField(raw[2], 1, 31),
    month: parseCronField(raw[3], 1, 12),
    dow: parseCronField(raw[4], 0, 6),
    domRestricted: raw[2] !== '*',
    dowRestricted: raw[4] !== '*',
  };
}

function cronMatches(cron, d) {
  if (!cron.minute.has(d.getMinutes())) return false;
  if (!cron.hour.has(d.getHours())) return false;
  if (!cron.month.has(d.getMonth() + 1)) return false;
  const domOk = cron.dom.has(d.getDate());
  const dowOk = cron.dow.has(d.getDay()); // 0=Sun..6=Sat
  // Standard cron: when both dom and dow are restricted, either may match.
  if (cron.domRestricted && cron.dowRestricted) return domOk || dowOk;
  return domOk && dowOk;
}

// Next run time at-or-after `fromDate`. Iterates minute-by-minute.
function nextRunAt(cronExpr, fromDate) {
  const cron = parseCron(cronExpr);
  const d = new Date(fromDate.getTime());
  d.setSeconds(0, 0);
  if (d.getTime() < fromDate.getTime()) d.setMinutes(d.getMinutes() + 1);
  const horizonMinutes = 366 * 24 * 60;
  for (let i = 0; i < horizonMinutes; i++) {
    if (cronMatches(cron, d)) return new Date(d.getTime());
    d.setMinutes(d.getMinutes() + 1);
  }
  throw new ValidationError(`no matching cron time within horizon for '${cronExpr}'`);
}

// ---------------------------------------------------------------------------
// Task id
// ---------------------------------------------------------------------------
let idCounter = Math.floor(Math.random() * 1e6);
function genId() {
  idCounter += 1;
  const counter = (Date.now().toString(36) + idCounter.toString(36));
  const rand = crypto.randomBytes(3).toString('hex');
  return `t_${counter}_${rand}`;
}

// ---------------------------------------------------------------------------
// State store (tasks.json)
// ---------------------------------------------------------------------------
function tasksPath(stateRoot) {
  return path.join(stateRoot, 'tasks.json');
}

function readTasks(stateRoot) {
  const p = tasksPath(stateRoot);
  if (!fs.existsSync(p)) return { version: 1, tasks: [] };
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) {
    throw new ValidationError(`corrupt tasks.json at ${p}`);
  }
  if (data.version == null) data.version = 1;
  return data;
}

function writeTasksAtomic(stateRoot, data) {
  fs.mkdirSync(stateRoot, { recursive: true });
  const tmp = path.join(stateRoot, `tasks.json.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, tasksPath(stateRoot));
}

// ---------------------------------------------------------------------------
// Lock discipline (directory-based lock)
// ---------------------------------------------------------------------------
function lockDirPath(stateRoot) {
  return path.join(stateRoot, 'scheduled_tasks.lock');
}
function ownerPath(stateRoot) {
  return path.join(lockDirPath(stateRoot), 'owner.json');
}

const heldLocks = new Set(); // resolved stateRoots this process currently owns

function readOwner(stateRoot) {
  try {
    return JSON.parse(fs.readFileSync(ownerPath(stateRoot), 'utf8'));
  } catch {
    return null;
  }
}

// STALE iff owner.json present AND the original owner is provably gone.
// Missing/unparseable owner OR a live/uncertain owner => not stale (BUSY).
function isStale(owner) {
  if (!owner || typeof owner.pid !== 'number') return false;
  // procStart strengthening (best-effort, cross-platform for our own pid):
  // if the recorded pid is OUR pid but the recorded process-start differs from
  // ours, the original owner is gone and its pid was recycled to us => stale.
  // (Without this, a recycled pid would read as "alive" — permanently busy.)
  if (owner.pid === process.pid
      && typeof owner.procStart === 'number'
      && owner.procStart !== PROC_START) {
    return true;
  }
  try {
    process.kill(owner.pid, 0);
    return false; // alive => busy
  } catch (e) {
    if (e.code === 'ESRCH') return true; // dead => stale
    return false; // EPERM etc. => cannot prove dead => busy
  }
}

function removeLockDir(stateRoot) {
  try {
    fs.rmSync(ownerPath(stateRoot), { force: true });
  } catch { /* ignore */ }
  try {
    fs.rmdirSync(lockDirPath(stateRoot));
  } catch {
    try {
      fs.rmSync(lockDirPath(stateRoot), { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

// Single-winner reclaim of a stale lock via an atomic rename compare-and-swap.
// `fs.renameSync` on a directory is atomic: only ONE racer can move `lockDir`
// to its unique staged name; every other concurrent racer's rename throws
// ENOENT (the dir was already moved) and MUST loop/re-evaluate instead of
// blindly rm+mkdir. This is what prevents two processes that both observed the
// same ESRCH-stale owner from double-acquiring the single-runner lock.
//
// Returns true iff THIS caller won the CAS (and has discarded the stale dir).
// Returns false if another racer moved it first, OR if the captured dir turned
// out to hold a live (freshly re-acquired) owner — in which case it is restored
// and NOT deleted.
function reclaimStaleLock(lockDir) {
  const staged = `${lockDir}.stale.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
  try {
    fs.renameSync(lockDir, staged); // atomic: single winner
  } catch (err) {
    if (err.code === 'ENOENT') return false; // another racer already moved it
    throw err;
  }
  // Re-verify what we captured. If a fresh, LIVE owner slipped in between the
  // stale check and this rename, put it back — never delete a live lock.
  let capturedOwner = null;
  try {
    capturedOwner = JSON.parse(fs.readFileSync(path.join(staged, 'owner.json'), 'utf8'));
  } catch { capturedOwner = null; }
  if (capturedOwner && !isStale(capturedOwner)) {
    // The captured owner is actually LIVE — it re-acquired between acquireLock's
    // stale check and our rename. Restore it ONLY if the slot is still free.
    // If the restore rename fails (a third racer already re-took lockDir), leave
    // `staged` as an orphan (inert; safe to delete manually — see contract §2.6)
    // rather than rmSync-deleting a live owner's lock. Never destroy a live lock.
    try {
      fs.renameSync(staged, lockDir); // atomic restore; throws if slot re-taken
    } catch { /* slot re-taken: keep staged as an orphan, do not delete a live lock */ }
    return false;
  }
  // Confirmed stale (or empty/unreadable) — discard the captured dir.
  try {
    fs.rmSync(staged, { recursive: true, force: true });
  } catch { /* ignore */ }
  return true;
}

function acquireLock(stateRoot, opts = {}) {
  const retries = opts.retries == null ? 20 : opts.retries;
  const delayMs = opts.delayMs == null ? 25 : opts.delayMs;
  fs.mkdirSync(stateRoot, { recursive: true });
  const lockDir = lockDirPath(stateRoot);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      fs.mkdirSync(lockDir); // atomic exclusive create
      const owner = {
        pid: process.pid,
        procStart: PROC_START,
        acquiredAt: new Date().toISOString(),
        sessionId: process.env.CODEX_SCHEDULE_SESSION_ID || String(process.pid),
      };
      fs.writeFileSync(ownerPath(stateRoot), JSON.stringify(owner));
      heldLocks.add(path.resolve(stateRoot));
      return owner;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const owner = readOwner(stateRoot);
      if (isStale(owner)) {
        // Atomic single-winner reclaim (NOT an unconditional rm). Whether we
        // win or lose the CAS, we simply loop and re-attempt the exclusive
        // mkdir; if another racer re-acquired first, the next iteration will
        // observe a live owner and treat it as busy.
        reclaimStaleLock(lockDir);
        if (attempt < retries) sleepSync(delayMs);
        continue;
      }
      // BUSY: cannot prove owner dead
      if (attempt < retries) {
        sleepSync(delayMs);
        continue;
      }
      throw new ContentionError(`scheduler is busy: lock held (${lockDir})`);
    }
  }
  throw new ContentionError(`scheduler is busy: lock held (${lockDir})`);
}

function releaseLock(stateRoot) {
  const resolved = path.resolve(stateRoot);
  const owner = readOwner(stateRoot);
  // Only remove a lock this process owns.
  if (!owner || owner.pid === process.pid || heldLocks.has(resolved)) {
    removeLockDir(stateRoot);
  }
  heldLocks.delete(resolved);
}

function cleanupOwnedLocks() {
  for (const sr of heldLocks) {
    const owner = readOwner(sr);
    if (!owner || owner.pid === process.pid) {
      try {
        removeLockDir(sr);
      } catch { /* ignore */ }
    }
  }
  heldLocks.clear();
}
process.on('exit', cleanupOwnedLocks);
process.on('SIGINT', () => {
  cleanupOwnedLocks();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanupOwnedLocks();
  process.exit(143);
});

// ---------------------------------------------------------------------------
// Codex arg safety
// ---------------------------------------------------------------------------
// DEFAULT-DENY ALLOWLIST. Only a small, vetted set of flags that cannot weaken
// the sandbox, approval policy, or config may pass through to `codex exec`.
// Everything else is rejected by name. When in doubt, a flag is EXCLUDED.
//
// Permitted: `--model` / `-m` (with its value) — selects the model only; it
// cannot relax sandboxing or approvals. All sandbox/approval/config flags
// (`--sandbox`/`-s`, `--ask-for-approval`/`-a`, `--config`/`-c`, `--profile`,
// `--full-auto`, `--dangerously-*`, `--yolo`, ...) are NOT on the list and are
// therefore rejected.
const ALLOWED_VALUE_FLAGS = new Set(['--model', '-m']);
// Additional guard: characters permitted in any pass-through token.
const ARG_CHARSET = /^[-A-Za-z0-9_.,:=/@+]+$/;

function sanitizeCodexArgs(argsArr) {
  const src = Array.isArray(argsArr) ? argsArr : [];
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const a = src[i];
    if (typeof a !== 'string') {
      throw new ValidationError(`invalid codex arg: ${String(a)}`);
    }
    // Guard first: reject shell-injection / unexpected characters.
    if (!ARG_CHARSET.test(a)) {
      throw new ValidationError(`invalid codex arg: ${a}`);
    }
    // For "--flag=value" forms, the allowlist decision is made on the flag name.
    const eq = a.indexOf('=');
    const name = a.startsWith('-') && eq > 0 ? a.slice(0, eq) : a;

    if (ALLOWED_VALUE_FLAGS.has(name)) {
      if (eq > 0) {
        // --model=value : value must be present (charset already validated).
        if (!a.slice(eq + 1)) {
          throw new ValidationError(`codex arg missing value: ${a}`);
        }
        out.push(a);
      } else {
        // --model value : consume the following token as the value so it can
        // never be re-interpreted as an independent (possibly unsafe) flag.
        const value = src[i + 1];
        if (typeof value !== 'string') {
          throw new ValidationError(`codex arg ${a} requires a value`);
        }
        if (!ARG_CHARSET.test(value)) {
          throw new ValidationError(`invalid codex arg: ${value}`);
        }
        if (value.startsWith('-')) {
          // A dash-led value would smuggle a second flag past the allowlist.
          throw new ValidationError(`refusing codex arg not on allowlist: ${value}`);
        }
        out.push(a, value);
        i += 1; // skip the consumed value
      }
      continue;
    }
    // Default deny: not explicitly allowed.
    throw new ValidationError(`refusing codex arg not on allowlist: ${a}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Task building
// ---------------------------------------------------------------------------
function computeNextRun(kind, { cron, at, forced, now }) {
  if (forced) {
    const d = new Date(forced);
    if (isNaN(d.getTime())) throw new ValidationError(`invalid --next-run-at: ${forced}`);
    return d.toISOString();
  }
  if (kind === 'schedule') return nextRunAt(cron, now).toISOString();
  if (kind === 'once') return new Date(at).toISOString();
  throw new ValidationError(`unknown kind: ${kind}`);
}

function buildTask({ kind, prompt, cwd, cron, at, forcedNextRun }) {
  if (!prompt) throw new ValidationError('missing --prompt');
  if (!cwd) throw new ValidationError('missing --cwd');
  const now = new Date();
  let cronExpr;
  let atIso;
  if (kind === 'schedule') {
    if (!cron) throw new ValidationError('schedule kind requires --cron');
    parseCron(cron); // validate
    cronExpr = cron;
  } else if (kind === 'once') {
    if (!at) throw new ValidationError('once kind requires --at');
    const d = new Date(at);
    if (isNaN(d.getTime())) throw new ValidationError(`invalid --at ISO-8601: ${at}`);
    atIso = d.toISOString();
  } else {
    throw new ValidationError(`unknown kind: ${kind} (expected schedule|once)`);
  }

  const nextRun = computeNextRun(kind, {
    cron: cronExpr, at: atIso, forced: forcedNextRun, now,
  });

  const task = {
    id: genId(),
    kind,
    prompt,
    cwd: path.resolve(cwd),
    status: 'active',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    nextRunAt: nextRun,
    lastRunAt: null,
    runs: [],
  };
  if (kind === 'schedule') task.cron = cronExpr;
  if (kind === 'once') task.at = atIso;
  return task;
}

// ---------------------------------------------------------------------------
// Running a task
// ---------------------------------------------------------------------------
function createRunFiles(stateRoot, task) {
  const startedAt = new Date();
  const ts = fsSafeTimestamp(startedAt);
  const runDir = path.join(stateRoot, 'runs', task.id);
  fs.mkdirSync(runDir, { recursive: true });
  return {
    startedAt,
    jsonlPath: path.join(runDir, `${ts}.jsonl`),
    lastPath: path.join(runDir, `${ts}.last.txt`),
    stderrPath: path.join(runDir, `${ts}.stderr.txt`),
  };
}

function removeEmptyFile(filePath) {
  try {
    if (fs.statSync(filePath).size === 0) fs.rmSync(filePath, { force: true });
  } catch { /* ignore */ }
}

function resultFromExit(startedAt, jsonlPath, lastPath, exitCode, spawnErrorCode = null) {
  const finishedAt = new Date();
  const status = exitCode === 0 ? 'succeeded' : 'failed';
  return { startedAt, finishedAt, exitCode, status, jsonlPath, lastPath, spawnErrorCode };
}

function runTaskViaCodexExec(stateRoot, task, codexBin, codexArgs) {
  const { startedAt, jsonlPath, lastPath, stderrPath } = createRunFiles(stateRoot, task);
  // Allowlisted pass-through args go BEFORE the `-` stdin sentinel so codex
  // reads the prompt from stdin and the extra flags are parsed as flags.
  const preArgs = ['exec', '--cd', task.cwd, '--json', '--output-last-message', lastPath];
  const extraArgs = sanitizeCodexArgs(codexArgs);
  const allArgs = [...preArgs, ...extraArgs, '-'];

  // Stream the child's stdout straight into the .jsonl file via a file
  // descriptor: there is NO buffer limit, so `codex exec --json` output larger
  // than Node's 1 MB spawnSync default is written verbatim — never truncated,
  // never SIGTERM-killed mid-run. stderr is likewise streamed to its own file.
  const stdoutFd = fs.openSync(jsonlPath, 'w');
  let stderrFd;
  try {
    stderrFd = fs.openSync(stderrPath, 'w');
  } catch (err) {
    // If the second open fails (EMFILE/ENOSPC), close the first fd before
    // rethrowing so it never leaks.
    try { fs.closeSync(stdoutFd); } catch { /* ignore */ }
    throw err;
  }
  let res;
  try {
    res = spawnSync(codexBin, allArgs, {
      input: task.prompt, // prompt on stdin (overrides stdio[0])
      stdio: ['pipe', stdoutFd, stderrFd],
    });
  } finally {
    try { fs.closeSync(stdoutFd); } catch { /* ignore */ }
    try { fs.closeSync(stderrFd); } catch { /* ignore */ }
  }

  // Preserve the historical contract: keep .stderr.txt only when non-empty.
  removeEmptyFile(stderrPath);
  // codex writes the last message file; ensure it exists for a faithful contract.
  if (!fs.existsSync(lastPath)) fs.writeFileSync(lastPath, '');

  // Distinguish a genuine spawn failure from a codex run failure.
  let exitCode;
  let spawnErrorCode = null;
  if (res.error && res.error.code === 'ENOENT') {
    // codex binary not found — a distinct, reported condition (not a run failure).
    spawnErrorCode = 'ENOENT';
    exitCode = 127;
  } else if (res.error) {
    // Some other spawn-level error; do NOT reuse 127 (which means "not found").
    spawnErrorCode = res.error.code || 'SPAWN_ERROR';
    exitCode = 1;
  } else if (res.status == null) {
    // Terminated by a signal without an exit code.
    exitCode = 1;
  } else {
    exitCode = res.status; // real codex exit code (0 on success, else the actual code)
  }

  return resultFromExit(startedAt, jsonlPath, lastPath, exitCode, spawnErrorCode);
}

function runSpawnStep(bin, args, { input, cwd } = {}) {
  const res = spawnSync(bin, args, { encoding: 'utf8', input, cwd });
  if (res.error && res.error.code === 'ENOENT') {
    return { ok: false, exitCode: 127, errorCode: 'ENOENT', stderr: `${bin} not found (ENOENT)` };
  }
  if (res.error) {
    return { ok: false, exitCode: 1, errorCode: res.error.code || 'SPAWN_ERROR', stderr: res.error.message };
  }
  const exitCode = res.status == null ? 1 : res.status;
  return {
    ok: exitCode === 0,
    exitCode,
    errorCode: null,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

function runTaskViaTmuxSend(stateRoot, task, { tmuxBin, tmuxTarget }) {
  if (!tmuxTarget) throw new ValidationError('tmux-send runner requires --tmux-target or TMUX_PANE');
  const { startedAt, jsonlPath, lastPath, stderrPath } = createRunFiles(stateRoot, task);
  const bufferName = `codex-schedule-${task.id}-${fsSafeTimestamp(startedAt)}`;
  const steps = [
    ['set-buffer', '-b', bufferName, '--', task.prompt],
    ['show-buffer', '-b', bufferName],
    ['send-keys', '-t', tmuxTarget, 'C-u'],
    ['paste-buffer', '-t', tmuxTarget, '-b', bufferName, '-p', '-d'],
    ['send-keys', '-t', tmuxTarget, 'Enter'],
  ];
  const evidence = [];
  for (const args of steps) {
    const res = runSpawnStep(tmuxBin, args);
    evidence.push({ command: [tmuxBin, ...args], exitCode: res.exitCode, stdout: res.stdout, stderr: res.stderr });
    if (!res.ok) {
      fs.writeFileSync(jsonlPath, evidence.map((e) => JSON.stringify(e)).join('\n') + '\n');
      fs.writeFileSync(lastPath, `tmux-send failed while running: ${args[0]}\n`);
      fs.writeFileSync(stderrPath, res.stderr || `tmux step failed: ${args[0]}\n`);
      return resultFromExit(startedAt, jsonlPath, lastPath, res.exitCode, res.errorCode);
    }
    if (args[0] === 'show-buffer' && res.stdout.replace(/\n$/, '') !== task.prompt) {
      fs.writeFileSync(jsonlPath, evidence.map((e) => JSON.stringify(e)).join('\n') + '\n');
      fs.writeFileSync(lastPath, 'tmux-send failed: buffer verification mismatch\n');
      fs.writeFileSync(stderrPath, 'tmux buffer verification mismatch\n');
      return resultFromExit(startedAt, jsonlPath, lastPath, 1);
    }
  }
  fs.writeFileSync(jsonlPath, evidence.map((e) => JSON.stringify(e)).join('\n') + '\n');
  fs.writeFileSync(lastPath, `tmux-send injected prompt into ${tmuxTarget}\n`);
  removeEmptyFile(stderrPath);
  return resultFromExit(startedAt, jsonlPath, lastPath, 0);
}

function runTaskViaResumeCommand(stateRoot, task, { resumeCommand, resumeArgs }) {
  if (!resumeCommand) throw new ValidationError('resume-command runner requires --resume-command');
  const { startedAt, jsonlPath, lastPath, stderrPath } = createRunFiles(stateRoot, task);
  const stdoutFd = fs.openSync(jsonlPath, 'w');
  let stderrFd;
  try {
    stderrFd = fs.openSync(stderrPath, 'w');
  } catch (err) {
    try { fs.closeSync(stdoutFd); } catch { /* ignore */ }
    throw err;
  }
  let res;
  try {
    res = spawnSync(resumeCommand, resumeArgs, {
      input: task.prompt,
      cwd: task.cwd,
      stdio: ['pipe', stdoutFd, stderrFd],
    });
  } finally {
    try { fs.closeSync(stdoutFd); } catch { /* ignore */ }
    try { fs.closeSync(stderrFd); } catch { /* ignore */ }
  }
  removeEmptyFile(stderrPath);
  let exitCode;
  let spawnErrorCode = null;
  if (res.error && res.error.code === 'ENOENT') {
    spawnErrorCode = 'ENOENT';
    exitCode = 127;
  } else if (res.error) {
    spawnErrorCode = res.error.code || 'SPAWN_ERROR';
    exitCode = 1;
  } else if (res.status == null) {
    exitCode = 1;
  } else {
    exitCode = res.status;
  }
  if (!fs.existsSync(lastPath)) {
    const message = exitCode === 0 ? 'resume-command completed\n' : `resume-command failed exit=${exitCode}\n`;
    fs.writeFileSync(lastPath, message);
  }
  return resultFromExit(startedAt, jsonlPath, lastPath, exitCode, spawnErrorCode);
}

function runTaskOnce(stateRoot, task, runnerOptions) {
  let runner = runnerOptions.runner;
  if (runner === 'auto') {
    if (runnerOptions.tmuxTarget) {
      runner = 'tmux-send';
    } else if (runnerOptions.resumeCommand) {
      runner = 'resume-command';
    } else {
      runner = 'codex-exec';
    }
  }
  switch (runner) {
    case 'codex-exec':
      return runTaskViaCodexExec(stateRoot, task, runnerOptions.codexBin, runnerOptions.codexArgs);
    case 'tmux-send':
      return runTaskViaTmuxSend(stateRoot, task, runnerOptions);
    case 'resume-command':
      return runTaskViaResumeCommand(stateRoot, task, runnerOptions);
    default:
      throw new ValidationError(`unknown runner: ${runnerOptions.runner}`);
  }
}

function applyRunResult(task, result) {
  const attempt = task.runs.length + 1;
  const record = {
    startedAt: result.startedAt.toISOString(),
    finishedAt: result.finishedAt.toISOString(),
    exitCode: result.exitCode,
    status: result.status,
    jsonlPath: result.jsonlPath,
    lastMessagePath: result.lastPath,
    attempt,
  };
  if (result.spawnErrorCode) record.spawnErrorCode = result.spawnErrorCode;
  if (result.status === 'failed') {
    const backoffMs = Math.min(60 * 60000, 60000 * Math.pow(2, attempt - 1));
    record.backoffMs = backoffMs;
    record.nextRetryAt = new Date(result.finishedAt.getTime() + backoffMs).toISOString();
  }
  task.runs.push(record);
  task.lastRunAt = result.finishedAt.toISOString();
  task.updatedAt = new Date().toISOString();

  if (task.kind === 'schedule') {
    task.nextRunAt = nextRunAt(task.cron, result.finishedAt).toISOString();
  } else if (task.kind === 'once') {
    task.status = 'cancelled'; // one-shot done
  }
  return record;
}

// Core due-check pass. `alreadyLocked` => caller holds the lock (daemon).
function runDuePass(stateRoot, {
  runner = 'auto',
  codexBin = 'codex',
  codexArgs = [],
  tmuxBin = 'tmux',
  tmuxTarget = process.env.TMUX_PANE || '',
  resumeCommand = '',
  resumeArgs = [],
  now = new Date(),
} = {}, alreadyLocked = false) {
  const doPass = () => {
    const data = readTasks(stateRoot);
    const nowMs = now.getTime();
    const due = data.tasks.filter(
      (t) => t.status === 'active' && new Date(t.nextRunAt).getTime() <= nowMs,
    );
    const summaries = [];
    for (const task of due) {
      const result = runTaskOnce(stateRoot, task, {
        runner,
        codexBin,
        codexArgs,
        tmuxBin,
        tmuxTarget,
        resumeCommand,
        resumeArgs,
      });
      applyRunResult(task, result);
      if (result.status === 'succeeded') {
        summaries.push(`run ${task.id} succeeded`);
      } else if (result.spawnErrorCode === 'ENOENT') {
        summaries.push(`run ${task.id} failed: codex binary not found (ENOENT) exit=${result.exitCode}`);
      } else {
        summaries.push(`run ${task.id} failed exit=${result.exitCode}`);
      }
    }
    if (due.length) writeTasksAtomic(stateRoot, data);
    return summaries;
  };

  if (alreadyLocked) return doPass();
  acquireLock(stateRoot);
  try {
    return doPass();
  } finally {
    releaseLock(stateRoot);
  }
}

// ---------------------------------------------------------------------------
// Codex binary resolution
// ---------------------------------------------------------------------------
function resolveCodexBin(bin) {
  if (bin.includes('/') || bin.includes(path.sep)) {
    try {
      fs.accessSync(bin, fs.constants.X_OK);
      return path.resolve(bin);
    } catch {
      return null;
    }
  }
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    const full = path.join(dir, bin);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return full;
    } catch { /* keep looking */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const BOOL_FLAGS = new Set(['json', 'all', 'once', 'help']);
const MULTI_FLAGS = new Set(['codex-arg', 'resume-arg']);

function parseArgv(argv) {
  const flags = {};
  const positional = [];
  const multi = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      let key = a.slice(2);
      const eq = key.indexOf('=');
      if (eq >= 0) {
        const val = key.slice(eq + 1);
        key = key.slice(0, eq);
        if (MULTI_FLAGS.has(key)) (multi[key] ||= []).push(val);
        else flags[key] = val;
        continue;
      }
      if (BOOL_FLAGS.has(key)) {
        flags[key] = true;
        continue;
      }
      const val = argv[++i];
      if (MULTI_FLAGS.has(key)) (multi[key] ||= []).push(val);
      else flags[key] = val;
    } else {
      positional.push(a);
    }
  }
  return { flags, positional, multi };
}

function getFlag(args, k) {
  const v = args.flags[k];
  return v === true ? undefined : v;
}
function hasFlag(args, k) {
  return args.flags[k] !== undefined;
}
function requireFlag(args, k) {
  const v = args.flags[k];
  if (v === undefined || v === true) throw new ValidationError(`missing --${k}`);
  return v;
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------
function cmdParseSchedule(args) {
  const cron = getFlag(args, 'cron');
  const at = getFlag(args, 'at');
  const prompt = args.positional.join(' ').trim();
  if (cron && at) throw new ValidationError('provide only one of --cron or --at');
  if (!cron && !at) throw new ValidationError('provide --cron or --at');
  if (!prompt) throw new ValidationError('prompt is empty');
  if (cron) {
    parseCron(cron); // validate
    process.stdout.write(JSON.stringify({ kind: 'schedule', cron, prompt }) + '\n');
  } else {
    const d = new Date(at);
    if (isNaN(d.getTime())) throw new ValidationError(`invalid --at ISO-8601: ${at}`);
    process.stdout.write(JSON.stringify({ kind: 'once', at, prompt }) + '\n');
  }
}

function cmdAdd(args) {
  const stateRoot = requireFlag(args, 'state-root');
  const prompt = requireFlag(args, 'prompt');
  const cwd = requireFlag(args, 'cwd');
  const cron = getFlag(args, 'cron');
  const at = getFlag(args, 'at');
  // Kind is inferred: --cron => schedule, --at => once. Exactly one required.
  if (cron && at) throw new ValidationError('provide only one of --cron or --at');
  if (!cron && !at) throw new ValidationError('provide --cron or --at');
  const kind = cron ? 'schedule' : 'once';
  const task = buildTask({
    kind,
    prompt,
    cwd,
    cron,
    at,
    forcedNextRun: getFlag(args, 'next-run-at'),
  });
  acquireLock(stateRoot);
  try {
    const data = readTasks(stateRoot);
    data.tasks.push(task);
    writeTasksAtomic(stateRoot, data);
  } finally {
    releaseLock(stateRoot);
  }
  process.stdout.write(
    `added ${task.id} kind=${task.kind} status=${task.status} nextRunAt=${task.nextRunAt} prompt=${task.prompt}\n`,
  );
}

function cmdList(args) {
  const stateRoot = requireFlag(args, 'state-root');
  const data = readTasks(stateRoot);
  if (hasFlag(args, 'json')) {
    process.stdout.write(JSON.stringify(data.tasks, null, 2) + '\n');
    return;
  }
  if (data.tasks.length === 0) {
    process.stdout.write('(no tasks)\n');
    return;
  }
  for (const t of data.tasks) {
    process.stdout.write(
      `${t.id}  kind=${t.kind}  status=${t.status}  nextRunAt=${t.nextRunAt}  prompt=${t.prompt}\n`,
    );
  }
}

function cmdCancel(args) {
  const stateRoot = requireFlag(args, 'state-root');
  const all = hasFlag(args, 'all');
  const id = args.positional[0];
  if (!all && !id) throw new ValidationError('cancel requires <id> or --all');
  acquireLock(stateRoot);
  try {
    const data = readTasks(stateRoot);
    let count = 0;
    for (const t of data.tasks) {
      if (all || t.id === id) {
        if (t.status !== 'cancelled') {
          t.status = 'cancelled';
          t.updatedAt = new Date().toISOString();
          count += 1;
        }
      }
    }
    if (!all && count === 0 && !data.tasks.some((t) => t.id === id)) {
      throw new ValidationError(`no task with id ${id}`);
    }
    writeTasksAtomic(stateRoot, data);
    process.stdout.write(`cancelled ${all ? 'all' : id} (${count} task(s) changed)\n`);
  } finally {
    releaseLock(stateRoot);
  }
}

function cmdStatus(args) {
  const stateRoot = requireFlag(args, 'state-root');
  const data = readTasks(stateRoot);
  const total = data.tasks.length;
  const active = data.tasks.filter((t) => t.status === 'active').length;
  const cancelled = data.tasks.filter((t) => t.status === 'cancelled').length;
  const lockPresent = fs.existsSync(lockDirPath(stateRoot));
  const lockStale = lockPresent ? isStale(readOwner(stateRoot)) : false;
  const out = {
    stateRoot: path.resolve(stateRoot),
    total,
    active,
    cancelled,
    lockPresent,
    lockStale,
  };
  if (hasFlag(args, 'json')) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return;
  }
  process.stdout.write(`state-root: ${out.stateRoot}\n`);
  process.stdout.write(`tasks: total=${total} active=${active} cancelled=${cancelled}\n`);
  process.stdout.write(`lock: present=${lockPresent} stale=${lockStale}\n`);
}

function cmdRunDue(args) {
  const stateRoot = requireFlag(args, 'state-root');
  const runner = getFlag(args, 'runner') || 'auto';
  const codexBin = getFlag(args, 'codex-bin') || 'codex';
  const codexArgs = args.multi['codex-arg'] || [];
  const tmuxBin = getFlag(args, 'tmux-bin') || 'tmux';
  const tmuxTarget = getFlag(args, 'tmux-target') || process.env.TMUX_PANE || '';
  const resumeCommand = getFlag(args, 'resume-command') || '';
  const resumeArgs = args.multi['resume-arg'] || [];
  const nowFlag = getFlag(args, 'now');
  let now = new Date();
  if (nowFlag) {
    now = new Date(nowFlag);
    if (isNaN(now.getTime())) throw new ValidationError(`invalid --now: ${nowFlag}`);
  }
  const summaries = runDuePass(stateRoot, {
    runner,
    codexBin,
    codexArgs,
    tmuxBin,
    tmuxTarget,
    resumeCommand,
    resumeArgs,
    now,
  });
  if (summaries.length === 0) {
    process.stdout.write('run-due: no due tasks\n');
  } else {
    for (const s of summaries) process.stdout.write(s + '\n');
  }
}

function cmdDaemon(args) {
  const stateRoot = requireFlag(args, 'state-root');
  const runner = getFlag(args, 'runner') || 'auto';
  const codexBin = getFlag(args, 'codex-bin') || 'codex';
  const codexArgs = args.multi['codex-arg'] || [];
  const tmuxBin = getFlag(args, 'tmux-bin') || 'tmux';
  const tmuxTarget = getFlag(args, 'tmux-target') || process.env.TMUX_PANE || '';
  const resumeCommand = getFlag(args, 'resume-command') || '';
  const resumeArgs = args.multi['resume-arg'] || [];
  const pollMs = getFlag(args, 'poll-ms') ? parseInt(getFlag(args, 'poll-ms'), 10) : 5000;
  const once = hasFlag(args, 'once');
  const maxRuns = getFlag(args, 'max-runs') ? parseInt(getFlag(args, 'max-runs'), 10) : Infinity;

  acquireLock(stateRoot); // hold for the daemon's entire lifetime
  let fired = 0;
  let stop = false;
  const onStop = () => {
    stop = true;
  };
  process.on('SIGINT', onStop);
  process.on('SIGTERM', onStop);
  try {
    process.stdout.write(`daemon: started (poll-ms=${pollMs}${once ? ' once' : ''})\n`);
    for (;;) {
      const summaries = runDuePass(stateRoot, {
        runner,
        codexBin,
        codexArgs,
        tmuxBin,
        tmuxTarget,
        resumeCommand,
        resumeArgs,
        now: new Date(),
      }, true);
      for (const s of summaries) process.stdout.write(s + '\n');
      fired += summaries.length;
      if (once) break;
      if (fired >= maxRuns) break;
      if (stop) break;
      sleepSync(pollMs);
      if (stop) break;
    }
  } finally {
    releaseLock(stateRoot);
  }
  process.stdout.write(`daemon: exiting after ${fired} run(s)\n`);
}

function cmdDoctor(args) {
  const stateRoot = requireFlag(args, 'state-root');
  const codexBin = getFlag(args, 'codex-bin') || 'codex';

  // ALWAYS print local-ignore guidance (contains: ignore, git, local-only).
  process.stdout.write(
    `Local-only state: add ${stateRoot}/ to your .gitignore; do not commit these files (local-only).\n`,
  );

  // doctor is READ-ONLY: it must never create the state root as a side effect.
  const stateRootExists = fs.existsSync(stateRoot);
  let writable = false;
  if (stateRootExists) {
    try {
      fs.accessSync(stateRoot, fs.constants.W_OK);
      writable = true;
    } catch { /* not writable */ }
  } else {
    process.stdout.write('state-root: missing (not created — doctor is read-only)\n');
  }

  let taskCount = 0;
  try {
    taskCount = readTasks(stateRoot).tasks.length;
  } catch { /* ignore */ }

  const lockPresent = fs.existsSync(lockDirPath(stateRoot));
  const lockStale = lockPresent ? isStale(readOwner(stateRoot)) : false;

  process.stdout.write(`state-root writable: ${writable}\n`);
  process.stdout.write(`tasks: ${taskCount}\n`);
  process.stdout.write(`lock: present=${lockPresent} stale=${lockStale}\n`);

  const resolved = resolveCodexBin(codexBin);
  if (!resolved) {
    process.stderr.write(
      `doctor: codex binary not found or not executable (${codexBin}); install codex or pass --codex-bin\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`codex: OK (${resolved})\n`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main(argv) {
  const [sub, ...rest] = argv;
  const args = parseArgv(rest);
  try {
    switch (sub) {
      case 'parse-schedule': return cmdParseSchedule(args);
      case 'add': return cmdAdd(args);
      case 'list': return cmdList(args);
      case 'cancel': return cmdCancel(args);
      case 'status': return cmdStatus(args);
      case 'run-due': return cmdRunDue(args);
      case 'daemon': return cmdDaemon(args);
      case 'doctor': return cmdDoctor(args);
      default:
        process.stderr.write(`unknown subcommand: ${sub || '(none)'}\n`);
        process.stderr.write(
          'usage: schedule.mjs <parse-schedule|add|list|cancel|status|run-due|daemon|doctor> [flags]\n',
        );
        process.exitCode = 2;
        return undefined;
    }
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exitCode = e.exitCode || 1;
    return undefined;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2));
}

export {
  parseCron,
  parseCronField,
  nextRunAt,
  genId,
  readTasks,
  writeTasksAtomic,
  acquireLock,
  releaseLock,
  isStale,
  reclaimStaleLock,
  lockDirPath,
  ownerPath,
  sanitizeCodexArgs,
  buildTask,
  runDuePass,
  resolveCodexBin,
  PROC_START,
};
