// Tests for loop.mjs — Node built-in test runner only.
// Run: node --test loop.test.mjs
// Never calls a real codex binary — every run uses a fake bash script.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_URL = new URL('./loop.mjs', import.meta.url);
const SCRIPT_PATH = fileURLToPath(SCRIPT_URL);

// ---- helpers -------------------------------------------------------------
const TMP_DIRS = [];
function mkTmp(prefix = 'codex-loop-') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(d);
  return d;
}
after(() => {
  for (const d of TMP_DIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

async function loadMod() {
  return import(SCRIPT_URL.href);
}

function runCli(args, opts = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    input: opts.input,
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}) },
  });
}

function writeFake(dir, body, name = 'fake-codex.sh') {
  const p = path.join(dir, name);
  fs.writeFileSync(p, body);
  fs.chmodSync(p, 0o755);
  return p;
}

function fakeSuccess(captureFile) {
  return `#!/usr/bin/env bash\necho '{"type":"turn.completed"}'\ncat > ${JSON.stringify(captureFile)}\nexit 0\n`;
}
function fakeFail() {
  return `#!/usr/bin/env bash\necho "boom fail happened" >&2\ncat > /dev/null\nexit 42\n`;
}

function readTasksFile(sr) {
  return JSON.parse(fs.readFileSync(path.join(sr, 'tasks.json'), 'utf8'));
}

// ---- parse-loop ----------------------------------------------------------
test('parse-loop: 1m say hi -> intervalMs 60000', async () => {
  const mod = await loadMod();
  const r = mod.parseLoopSpec('1m say hi');
  assert.deepEqual(r, { kind: 'loop', intervalMs: 60000, prompt: 'say hi' });
});

test('parse-loop CLI: 1m say hi emits JSON', () => {
  const res = runCli(['parse-loop', '1m say hi']);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.kind, 'loop');
  assert.equal(out.intervalMs, 60000);
  assert.equal(out.prompt, 'say hi');
});

test('parse-loop: default interval 10m when no interval token', async () => {
  const mod = await loadMod();
  const r = mod.parseLoopSpec('just do the thing');
  assert.equal(r.intervalMs, 600000);
  assert.equal(r.prompt, 'just do the thing');
});

test('parse-loop: 30s rounds up to 60000 (60s floor)', async () => {
  const mod = await loadMod();
  assert.equal(mod.parseLoopSpec('30s x').intervalMs, 60000);
  assert.equal(mod.parseLoopSpec('1s x').intervalMs, 60000);
  assert.equal(mod.parseLoopSpec('60s x').intervalMs, 60000);
  assert.equal(mod.parseLoopSpec('61s x').intervalMs, 120000);
  assert.equal(mod.parseLoopSpec('90s x').intervalMs, 120000);
});

test('parse-loop: h and d units', async () => {
  const mod = await loadMod();
  assert.equal(mod.parseLoopSpec('2h x').intervalMs, 7200000);
  assert.equal(mod.parseLoopSpec('1d x').intervalMs, 86400000);
});

test('parse-loop CLI: 0m rejected with validation error', () => {
  const res = runCli(['parse-loop', '0m say hi']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /interval/i);
  assert.match(res.stderr, /zero|greater/i);
});

test('parse-loop CLI: malformed interval token rejected', () => {
  const res = runCli(['parse-loop', '5x say hi']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /malformed|interval/i);
});

test('parse-loop CLI: empty prompt rejected', () => {
  const res = runCli(['parse-loop', '1m']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /prompt/i);
  assert.match(res.stderr, /empty/i);
});

// ---- task id -------------------------------------------------------------
test('genId: unique and greppable t_ prefix', async () => {
  const mod = await loadMod();
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const id = mod.genId();
    assert.match(id, /^t_[0-9a-z]+_[0-9a-f]+$/);
    assert.ok(!seen.has(id), 'duplicate id: ' + id);
    seen.add(id);
  }
});

// ---- codex arg safety ----------------------------------------------------
test('sanitizeCodexArgs: passes simple flags, rejects dangerous', async () => {
  const mod = await loadMod();
  assert.deepEqual(mod.sanitizeCodexArgs(['--model', 'gpt-x']), ['--model', 'gpt-x']);
  assert.throws(() => mod.sanitizeCodexArgs(['--dangerously-bypass-approvals-and-sandbox']), /unsafe|danger/i);
  assert.throws(() => mod.sanitizeCodexArgs(['--yolo']), /unsafe|yolo/i);
  assert.throws(() => mod.sanitizeCodexArgs(['; rm -rf /']), /invalid/i);
});

// ---- lock acquire / release ---------------------------------------------
test('lock: acquire writes owner.json, release removes lock dir', async () => {
  const mod = await loadMod();
  const sr = mkTmp();
  try {
    mod.acquireLock(sr);
    const owner = JSON.parse(fs.readFileSync(mod.ownerPath(sr), 'utf8'));
    assert.equal(owner.pid, process.pid);
    assert.ok(typeof owner.procStart === 'number');
    assert.ok(typeof owner.acquiredAt === 'string');
    assert.ok(fs.existsSync(mod.lockDirPath(sr)));
  } finally {
    mod.releaseLock(sr);
  }
  assert.ok(!fs.existsSync(mod.lockDirPath(sr)), 'lock dir should be gone after release');
});

test('lock CONTENTION: pre-existing lock (no owner) -> busy', async () => {
  const mod = await loadMod();
  const sr = mkTmp();
  fs.mkdirSync(mod.lockDirPath(sr), { recursive: true }); // held, no owner.json
  assert.throws(
    () => mod.acquireLock(sr, { retries: 3, delayMs: 5 }),
    (e) => /busy/i.test(e.message) && /lock/i.test(e.message),
  );
});

test('lock STALE reclaim: owner.json with dead pid is reclaimed', async () => {
  const mod = await loadMod();
  const sr = mkTmp();
  // spawnSync blocks until child exits -> its pid is now dead (ESRCH).
  const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  const deadPid = dead.pid;
  fs.mkdirSync(mod.lockDirPath(sr), { recursive: true });
  fs.writeFileSync(
    mod.ownerPath(sr),
    JSON.stringify({ pid: deadPid, procStart: 1, acquiredAt: new Date().toISOString(), sessionId: 'x' }),
  );
  try {
    mod.acquireLock(sr, { retries: 5, delayMs: 5 });
    const owner = JSON.parse(fs.readFileSync(mod.ownerPath(sr), 'utf8'));
    assert.equal(owner.pid, process.pid, 'lock should now be owned by us');
  } finally {
    mod.releaseLock(sr);
  }
});

// ---- state store: add / list / cancel / status --------------------------
test('state store: add, list, cancel, status', () => {
  const sr = mkTmp();
  const work = mkTmp();
  // add is loop-only and implies kind=loop (no --kind needed).
  const a1 = runCli(['add', '--state-root', sr, '--interval', '1m', '--prompt', 'say hi', '--cwd', work]);
  assert.equal(a1.status, 0, a1.stderr);
  assert.match(a1.stdout, /say hi/);
  const a2 = runCli(['add', '--state-root', sr, '--interval', '2m', '--prompt', 'second task', '--cwd', work]);
  assert.equal(a2.status, 0, a2.stderr);

  const list = runCli(['list', '--state-root', sr]);
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /say hi/);
  assert.match(list.stdout, /second task/);
  assert.match(list.stdout, /active/);

  const data = readTasksFile(sr);
  assert.equal(data.version, 1);
  assert.equal(data.tasks.length, 2);
  const id0 = data.tasks[0].id;

  const cancel = runCli(['cancel', '--state-root', sr, id0]);
  assert.equal(cancel.status, 0, cancel.stderr);
  const data2 = readTasksFile(sr);
  assert.equal(data2.tasks.find((t) => t.id === id0).status, 'cancelled');

  const status = runCli(['status', '--state-root', sr, '--json']);
  assert.equal(status.status, 0, status.stderr);
  const st = JSON.parse(status.stdout);
  assert.equal(st.total, 2);
  assert.equal(st.active, 1);
  assert.equal(st.cancelled, 1);
});

test('task schema: add loop creates full task object (implicit kind)', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const res = runCli(['add', '--state-root', sr, '--interval', '1m', '--prompt', 'p', '--cwd', work]);
  assert.equal(res.status, 0, res.stderr);
  const t = readTasksFile(sr).tasks[0];
  assert.match(t.id, /^t_/);
  assert.equal(t.kind, 'loop');
  assert.equal(t.prompt, 'p');
  assert.equal(t.cwd, path.resolve(work));
  assert.equal(t.status, 'active');
  assert.equal(t.intervalMs, 60000);
  assert.ok(t.createdAt && t.updatedAt && t.nextRunAt);
  assert.equal(t.lastRunAt, null);
  assert.deepEqual(t.runs, []);
});

test('task schema: add accepts explicit --kind loop', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const res = runCli(['add', '--state-root', sr, '--kind', 'loop', '--interval', '1m', '--prompt', 'p', '--cwd', work]);
  assert.equal(res.status, 0, res.stderr);
  const t = readTasksFile(sr).tasks[0];
  assert.equal(t.kind, 'loop');
});

test('task schema: add rejects missing --interval', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const res = runCli(['add', '--state-root', sr, '--prompt', 'p', '--cwd', work]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /interval/i);
});

test('task schema: add rejects non-loop --kind', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const res = runCli(['add', '--state-root', sr, '--kind', 'schedule', '--interval', '1m', '--prompt', 'p', '--cwd', work]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /kind/i);
});

test('add CLI contention: pre-existing lock dir makes add fail busy', () => {
  const sr = mkTmp();
  const work = mkTmp();
  fs.mkdirSync(path.join(sr, 'scheduled_tasks.lock'), { recursive: true });
  const res = runCli(['add', '--state-root', sr, '--interval', '1m', '--prompt', 'x', '--cwd', work]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /busy|lock|contend/i);
});

// ---- run-due -------------------------------------------------------------
test('run-due: fake codex success records run + files + stdin', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const capture = path.join(work, 'stdin-capture.txt');
  const fake = writeFake(work, fakeSuccess(capture));
  const add = runCli(['add', '--state-root', sr, '--interval', '1m',
    '--prompt', 'say hi', '--cwd', work, '--next-run-at', '1970-01-01T00:00:00.000Z']);
  assert.equal(add.status, 0, add.stderr);

  const rd = runCli(['run-due', '--state-root', sr, '--codex-bin', fake]);
  assert.equal(rd.status, 0, rd.stderr);
  assert.match(rd.stdout, /succeeded/);

  const t = readTasksFile(sr).tasks[0];
  assert.equal(t.runs.length, 1);
  assert.equal(t.runs[0].status, 'succeeded');
  assert.equal(t.runs[0].exitCode, 0);
  assert.ok(fs.existsSync(t.runs[0].jsonlPath), 'jsonl file exists');
  assert.ok(fs.existsSync(t.runs[0].lastMessagePath), 'last.txt exists');
  assert.match(fs.readFileSync(t.runs[0].jsonlPath, 'utf8'), /turn\.completed/);
  assert.equal(fs.readFileSync(capture, 'utf8').trim(), 'say hi');
  assert.ok(t.lastRunAt);
  // nextRunAt advanced beyond epoch
  assert.ok(new Date(t.nextRunAt).getTime() > 0);
});

test('run-due FAILURE: non-zero codex records failed, tasks.json valid', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const fake = writeFake(work, fakeFail());
  const add = runCli(['add', '--state-root', sr, '--interval', '1m',
    '--prompt', 'do', '--cwd', work, '--next-run-at', '1970-01-01T00:00:00.000Z']);
  assert.equal(add.status, 0, add.stderr);

  const rd = runCli(['run-due', '--state-root', sr, '--codex-bin', fake]);
  assert.equal(rd.status, 0, rd.stderr); // pass itself succeeded
  assert.match(rd.stdout, /failed/);

  const data = readTasksFile(sr); // must still parse
  const t = data.tasks[0];
  assert.equal(t.runs.length, 1);
  assert.equal(t.runs[0].status, 'failed');
  assert.equal(t.runs[0].exitCode, 42);
  assert.ok(t.runs[0].nextRetryAt, 'failure records backoff retry time');
});

// ---- daemon --------------------------------------------------------------
test('daemon --once: fires exactly once and leaves NO lock', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const capture = path.join(work, 'stdin-capture.txt');
  const fake = writeFake(work, fakeSuccess(capture));
  runCli(['add', '--state-root', sr, '--interval', '1m',
    '--prompt', 'tick', '--cwd', work, '--next-run-at', '1970-01-01T00:00:00.000Z']);

  const d = runCli(['daemon', '--state-root', sr, '--codex-bin', fake, '--once', '--poll-ms', '50']);
  assert.equal(d.status, 0, d.stderr);
  assert.match(d.stdout, /succeeded/);
  assert.ok(!fs.existsSync(path.join(sr, 'scheduled_tasks.lock')), 'no lock left behind');
  const t = readTasksFile(sr).tasks[0];
  assert.equal(t.runs.length, 1);
});

test('daemon --max-runs 1: fires once then exits without lock', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const capture = path.join(work, 'stdin-capture.txt');
  const fake = writeFake(work, fakeSuccess(capture));
  runCli(['add', '--state-root', sr, '--interval', '1m',
    '--prompt', 'tick', '--cwd', work, '--next-run-at', '1970-01-01T00:00:00.000Z']);
  const d = runCli(['daemon', '--state-root', sr, '--codex-bin', fake, '--max-runs', '1', '--poll-ms', '50']);
  assert.equal(d.status, 0, d.stderr);
  assert.ok(!fs.existsSync(path.join(sr, 'scheduled_tasks.lock')));
  assert.equal(readTasksFile(sr).tasks[0].runs.length, 1);
});

// ---- doctor --------------------------------------------------------------
test('doctor: missing codex -> non-zero + ignore guidance', () => {
  const sr = mkTmp();
  const res = runCli(['doctor', '--state-root', sr, '--codex-bin', '/no/such/codex-bin-xyz']);
  assert.notEqual(res.status, 0);
  assert.match(res.stdout, /ignore/i);
  assert.match(res.stdout, /git/i);
  assert.match(res.stdout, /local-only/i);
  assert.match(res.stderr, /codex/i);
  assert.match(res.stderr, /not found|missing|executable/i);
});

test('doctor: present codex -> OK exit 0 + guidance', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const fake = writeFake(work, '#!/usr/bin/env bash\nexit 0\n');
  const res = runCli(['doctor', '--state-root', sr, '--codex-bin', fake]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /local-only/i);
  assert.match(res.stdout, /OK/);
});

// =========================================================================
// REGRESSION TESTS for the 3 BLOCKER fixes + cheap non-blocker fixes.
// Each blocker test is designed to FAIL against a naive implementation
// and PASS with the correctness properties preserved from the source.
// =========================================================================

// A fake codex that dumps its own argv (one arg per line) for ordering checks.
function fakeDumpArgs(argsFile) {
  return `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > ${JSON.stringify(argsFile)}\ncat > /dev/null\nexit 0\n`;
}

// ---- BLOCKER 1: --codex-arg default-deny ALLOWLIST ----------------------
const DANGEROUS_ARG_PROBES = [
  ['--sandbox', 'danger-full-access'],
  ['--sandbox=danger-full-access'],
  ['-s', 'danger-full-access'],
  ['-c', 'sandbox_mode=danger-full-access'],
  ['--config', 'approval_policy=never'],
  ['--full-auto'],
  ['--ask-for-approval', 'never'],
  ['-a', 'never'],
  ['--dangerously-bypass-approvals-and-sandbox'],
  ['--yolo'],
];

test('BLOCKER1 allowlist: sanitizeCodexArgs rejects every sandbox/approval/config override', async () => {
  const mod = await loadMod();
  for (const probe of DANGEROUS_ARG_PROBES) {
    assert.throws(
      () => mod.sanitizeCodexArgs(probe),
      (e) => e.name === 'ValidationError',
      `expected rejection for ${JSON.stringify(probe)}`,
    );
  }
});

test('BLOCKER1 allowlist: sanitizeCodexArgs accepts vetted --model/-m with value', async () => {
  const mod = await loadMod();
  assert.deepEqual(mod.sanitizeCodexArgs(['--model', 'gpt-x']), ['--model', 'gpt-x']);
  assert.deepEqual(mod.sanitizeCodexArgs(['-m', 'gpt-x']), ['-m', 'gpt-x']);
  assert.deepEqual(mod.sanitizeCodexArgs(['--model=gpt-x']), ['--model=gpt-x']);
  // A value that looks like a flag must not be silently swallowed as a model name.
  assert.throws(() => mod.sanitizeCodexArgs(['--model', '--sandbox']), /allowlist|invalid|Validation/i);
});

test('BLOCKER1 allowlist: run-due --codex-arg rejects a sandbox override at the CLI', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const fake = writeFake(work, fakeSuccess(path.join(work, 'cap.txt')));
  const add = runCli(['add', '--state-root', sr, '--interval', '1m',
    '--prompt', 'go', '--cwd', work, '--next-run-at', '1970-01-01T00:00:00.000Z']);
  assert.equal(add.status, 0, add.stderr);
  const rd = runCli(['run-due', '--state-root', sr, '--codex-bin', fake,
    '--codex-arg', '--sandbox', '--codex-arg', 'danger-full-access']);
  assert.notEqual(rd.status, 0, 'a sandbox override must make run-due fail');
  assert.match(rd.stderr, /sandbox|allowlist|refus/i);
});

test('BLOCKER1 ordering: allowed pass-through arg is placed BEFORE the "-" stdin sentinel', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const argsFile = path.join(work, 'codex-argv.txt');
  const fake = writeFake(work, fakeDumpArgs(argsFile));
  const add = runCli(['add', '--state-root', sr, '--interval', '1m',
    '--prompt', 'go', '--cwd', work, '--next-run-at', '1970-01-01T00:00:00.000Z']);
  assert.equal(add.status, 0, add.stderr);
  const rd = runCli(['run-due', '--state-root', sr, '--codex-bin', fake,
    '--codex-arg', '--model', '--codex-arg', 'gpt-x']);
  assert.equal(rd.status, 0, rd.stderr);
  const argv = fs.readFileSync(argsFile, 'utf8').split('\n').filter((s) => s.length);
  assert.equal(argv[argv.length - 1], '-', 'the "-" sentinel must be the final codex arg');
  const mi = argv.indexOf('--model');
  assert.ok(mi >= 0, '--model present in argv');
  assert.equal(argv[mi + 1], 'gpt-x', 'model value immediately follows the flag');
  assert.ok(mi < argv.indexOf('-'), '--model must appear before the "-" sentinel');
});

// ---- BLOCKER 2: unbounded stdout streamed to jsonl (no maxBuffer kill) ---
test('BLOCKER2 large output: >2MB stdout is streamed verbatim, run succeeds exit 0', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const N = 2200000; // > 2 MiB, well past Node's 1 MB spawnSync default
  const body = `#!/usr/bin/env bash\nyes x | head -c ${N}\ncat > /dev/null\nexit 0\n`;
  const fake = writeFake(work, body);
  const add = runCli(['add', '--state-root', sr, '--interval', '1m',
    '--prompt', 'big', '--cwd', work, '--next-run-at', '1970-01-01T00:00:00.000Z']);
  assert.equal(add.status, 0, add.stderr);
  const rd = runCli(['run-due', '--state-root', sr, '--codex-bin', fake]);
  assert.equal(rd.status, 0, rd.stderr);
  assert.match(rd.stdout, /succeeded/);
  const t = readTasksFile(sr).tasks[0];
  assert.equal(t.runs.length, 1);
  assert.equal(t.runs[0].status, 'succeeded');
  assert.equal(t.runs[0].exitCode, 0);
  const size = fs.statSync(t.runs[0].jsonlPath).size;
  assert.equal(size, N, `jsonl must be the full ${N} bytes (not truncated), got ${size}`);
});

// ---- BLOCKER 3: stale-lock reclaim is a single-winner atomic CAS --------
test('BLOCKER3 stale reclaim CAS: single-winner; never deletes a fresh live lock', async () => {
  const mod = await loadMod();
  const sr = mkTmp();
  const lockDir = mod.lockDirPath(sr);
  const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)']); // pid now ESRCH
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(mod.ownerPath(sr),
    JSON.stringify({ pid: dead.pid, procStart: 1, acquiredAt: new Date().toISOString(), sessionId: 'dead' }));

  // The first racer wins the atomic rename-CAS and removes the stale dir.
  assert.equal(mod.reclaimStaleLock(lockDir), true);
  assert.ok(!fs.existsSync(lockDir), 'winner removed the stale lock dir');

  // A second reclaim of an already-moved dir gets ENOENT -> false; deletes nothing.
  assert.equal(mod.reclaimStaleLock(lockDir), false);

  // Someone else re-acquires a FRESH, live lock.
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(mod.ownerPath(sr),
    JSON.stringify({ pid: process.pid, procStart: mod.PROC_START, acquiredAt: new Date().toISOString(), sessionId: 'live' }));

  // A late racer must NOT delete the fresh live lock (CAS re-verifies staleness).
  assert.equal(mod.reclaimStaleLock(lockDir), false);
  assert.ok(fs.existsSync(lockDir), 'fresh live lock preserved');
  assert.equal(JSON.parse(fs.readFileSync(mod.ownerPath(sr), 'utf8')).pid, process.pid);
});

test('BLOCKER3 procStart: recycled self-pid (procStart mismatch) reads as stale', async () => {
  const mod = await loadMod();
  assert.equal(mod.isStale({ pid: process.pid, procStart: mod.PROC_START - 1234567 }), true);
  assert.equal(mod.isStale({ pid: process.pid, procStart: mod.PROC_START }), false);
});

// ---- NON-BLOCKER: doctor is read-only (never creates the state root) -----
test('doctor read-only: missing state root is NOT created', () => {
  const parent = mkTmp();
  const sr = path.join(parent, 'not-yet');
  const work = mkTmp();
  const fake = writeFake(work, '#!/usr/bin/env bash\nexit 0\n');
  assert.ok(!fs.existsSync(sr), 'precondition: state root is absent');
  const res = runCli(['doctor', '--state-root', sr, '--codex-bin', fake]);
  assert.match(res.stdout, /local-only/i);
  assert.ok(!fs.existsSync(sr), 'doctor must not create the state root');
});
