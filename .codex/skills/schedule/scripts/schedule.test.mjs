// Tests for schedule.mjs — Node built-in test runner only.
// Run: node --test schedule.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_URL = new URL('./schedule.mjs', import.meta.url);
const SCRIPT_PATH = fileURLToPath(SCRIPT_URL);

// ---- helpers -------------------------------------------------------------
const TMP_DIRS = [];
function mkTmp(prefix = 'codex-schedule-') {
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
function fakeTmux(logFile) {
  return `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> ${JSON.stringify(logFile)}\nif [ "$1" = "show-buffer" ]; then\n  printf 'tmux prompt'\nfi\nexit 0\n`;
}
function fakeResume(captureFile) {
  return `#!/usr/bin/env bash\nprintf 'argv:%s\\n' "$*" > ${JSON.stringify(captureFile)}\nprintf 'stdin:' >> ${JSON.stringify(captureFile)}\ncat >> ${JSON.stringify(captureFile)}\nexit 0\n`;
}

function readTasksFile(sr) {
  return JSON.parse(fs.readFileSync(path.join(sr, 'tasks.json'), 'utf8'));
}

// The past epoch used to force a task due immediately.
const EPOCH = '1970-01-01T00:00:00.000Z';

// ---- parse-schedule / cron ----------------------------------------------
test('parse-schedule CLI: --cron valid', () => {
  const res = runCli(['parse-schedule', '--cron', '*/5 * * * *', 'hello world']);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.kind, 'schedule');
  assert.equal(out.cron, '*/5 * * * *');
  assert.equal(out.prompt, 'hello world');
});

test('parse-schedule CLI: --at once form', () => {
  const res = runCli(['parse-schedule', '--at', '2026-01-01T00:00:00.000Z', 'do', 'it']);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.kind, 'once');
  assert.equal(out.at, '2026-01-01T00:00:00.000Z');
  assert.equal(out.prompt, 'do it');
});

test('parse-schedule CLI: both --cron and --at rejected', () => {
  const res = runCli(['parse-schedule', '--cron', '* * * * *', '--at', '2026-01-01T00:00:00.000Z', 'x']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /only one|cron|at/i);
});

test('parse-schedule CLI: neither --cron nor --at rejected', () => {
  const res = runCli(['parse-schedule', 'x']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /cron|at/i);
});

test('parse-schedule CLI: invalid cron field count rejected', () => {
  const res = runCli(['parse-schedule', '--cron', '* * * *', 'x']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /field/i);
});

test('parse-schedule CLI: out-of-range cron rejected', () => {
  const res = runCli(['parse-schedule', '--cron', '99 * * * *', 'x']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /range/i);
});

test('parse-schedule CLI: invalid --at ISO rejected', () => {
  const res = runCli(['parse-schedule', '--at', 'not-a-date', 'x']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /iso|invalid/i);
});

test('parse-schedule CLI: empty prompt rejected', () => {
  const res = runCli(['parse-schedule', '--cron', '* * * * *']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /prompt/i);
  assert.match(res.stderr, /empty/i);
});

test('cron parser: fields, steps, ranges, lists', async () => {
  const mod = await loadMod();
  const c = mod.parseCron('*/15 0-6/2 1,15 * 1-5');
  assert.ok(c.minute.has(0) && c.minute.has(15) && c.minute.has(45));
  assert.ok(!c.minute.has(7));
  assert.ok(c.hour.has(0) && c.hour.has(2) && c.hour.has(6) && !c.hour.has(1));
  assert.ok(c.dom.has(1) && c.dom.has(15) && !c.dom.has(2));
  assert.ok(c.dow.has(1) && c.dow.has(5) && !c.dow.has(0));
});

test('cron parser: rejects >5 or <5 fields and out-of-range', async () => {
  const mod = await loadMod();
  assert.throws(() => mod.parseCron('* * * *'), /field/i);
  assert.throws(() => mod.parseCron('* * * * * *'), /field/i);
  assert.throws(() => mod.parseCron('99 * * * *'), /range/i);
  assert.throws(() => mod.parseCron('* 24 * * *'), /range/i);
});

test('nextRunAt: computes next matching minute (tz-independent)', async () => {
  const mod = await loadMod();
  const from = new Date(2026, 0, 1, 10, 7, 0, 0);
  const next = mod.nextRunAt('*/15 * * * *', from);
  assert.equal(next.getTime(), new Date(2026, 0, 1, 10, 15, 0, 0).getTime());

  const from2 = new Date(2026, 0, 1, 10, 0, 0, 0);
  const next2 = mod.nextRunAt('30 9 * * *', from2);
  assert.equal(next2.getTime(), new Date(2026, 0, 2, 9, 30, 0, 0).getTime());
});

test('nextRunAt: throws when no match within horizon', async () => {
  const mod = await loadMod();
  assert.throws(() => mod.nextRunAt('0 0 30 2 *', new Date(2026, 0, 1, 0, 0, 0, 0)), /no match|horizon/i);
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
  assert.throws(() => mod.sanitizeCodexArgs(['--dangerously-bypass-approvals-and-sandbox']), /allowlist|refus/i);
  assert.throws(() => mod.sanitizeCodexArgs(['--yolo']), /allowlist|refus/i);
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
  const a1 = runCli(['add', '--state-root', sr, '--cron', '0 9 * * *', '--prompt', 'say hi', '--cwd', work]);
  assert.equal(a1.status, 0, a1.stderr);
  assert.match(a1.stdout, /say hi/);
  const a2 = runCli(['add', '--state-root', sr, '--cron', '0 10 * * *', '--prompt', 'second task', '--cwd', work]);
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

test('task schema: add schedule creates full task object', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const res = runCli(['add', '--state-root', sr, '--cron', '0 9 * * *', '--prompt', 'p', '--cwd', work]);
  assert.equal(res.status, 0, res.stderr);
  const t = readTasksFile(sr).tasks[0];
  assert.match(t.id, /^t_/);
  assert.equal(t.kind, 'schedule');
  assert.equal(t.cron, '0 9 * * *');
  assert.equal(t.prompt, 'p');
  assert.equal(t.cwd, path.resolve(work));
  assert.equal(t.status, 'active');
  assert.ok(t.createdAt && t.updatedAt && t.nextRunAt);
  assert.equal(t.lastRunAt, null);
  assert.deepEqual(t.runs, []);
  assert.equal(t.intervalMs, undefined, 'schedule tasks carry no intervalMs (loop is gone)');
});

test('task schema: add once creates once task with at field', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const res = runCli(['add', '--state-root', sr, '--at', '2026-01-01T00:00:00.000Z', '--prompt', 'p', '--cwd', work]);
  assert.equal(res.status, 0, res.stderr);
  const t = readTasksFile(sr).tasks[0];
  assert.equal(t.kind, 'once');
  assert.equal(t.at, '2026-01-01T00:00:00.000Z');
  assert.equal(t.status, 'active');
});

test('add: rejects when neither --cron nor --at provided', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const res = runCli(['add', '--state-root', sr, '--prompt', 'p', '--cwd', work]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /cron|at/i);
});

test('add: rejects when both --cron and --at provided', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const res = runCli(['add', '--state-root', sr, '--cron', '* * * * *',
    '--at', '2026-01-01T00:00:00.000Z', '--prompt', 'p', '--cwd', work]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /only one|cron|at/i);
});

test('add: rejects invalid cron expression', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const res = runCli(['add', '--state-root', sr, '--cron', '99 * * * *', '--prompt', 'p', '--cwd', work]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /range/i);
});

test('add CLI contention: pre-existing lock dir makes add fail busy', () => {
  const sr = mkTmp();
  const work = mkTmp();
  fs.mkdirSync(path.join(sr, 'scheduled_tasks.lock'), { recursive: true });
  const res = runCli(['add', '--state-root', sr, '--cron', '* * * * *', '--prompt', 'x', '--cwd', work]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /busy|lock|contend/i);
});

// ---- run-due -------------------------------------------------------------
test('run-due: fake codex success records run + files + stdin', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const capture = path.join(work, 'stdin-capture.txt');
  const fake = writeFake(work, fakeSuccess(capture));
  const add = runCli(['add', '--state-root', sr, '--cron', '* * * * *',
    '--prompt', 'say hi', '--cwd', work, '--next-run-at', EPOCH]);
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
  // schedule task recomputes nextRunAt beyond epoch after the run
  assert.ok(new Date(t.nextRunAt).getTime() > 0);
});

test('run-due once: one-shot task transitions to cancelled after running', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const capture = path.join(work, 'cap.txt');
  const fake = writeFake(work, fakeSuccess(capture));
  // --at in the past -> due immediately.
  const add = runCli(['add', '--state-root', sr, '--at', EPOCH, '--prompt', 'once please', '--cwd', work]);
  assert.equal(add.status, 0, add.stderr);
  const before = readTasksFile(sr).tasks[0];
  assert.equal(before.kind, 'once');
  assert.equal(before.status, 'active');

  const rd = runCli(['run-due', '--state-root', sr, '--codex-bin', fake]);
  assert.equal(rd.status, 0, rd.stderr);
  assert.match(rd.stdout, /succeeded/);

  const t = readTasksFile(sr).tasks[0];
  assert.equal(t.runs.length, 1);
  assert.equal(t.runs[0].status, 'succeeded');
  assert.equal(t.status, 'cancelled', 'once task becomes cancelled after it runs');
  assert.equal(fs.readFileSync(capture, 'utf8').trim(), 'once please');
});

test('run-due tmux runner: injects prompt into target pane without codex exec', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const log = path.join(work, 'tmux.log');
  const fake = writeFake(work, fakeTmux(log), 'tmux');
  const add = runCli(['add', '--state-root', sr, '--at', EPOCH, '--prompt', 'tmux prompt', '--cwd', work]);
  assert.equal(add.status, 0, add.stderr);

  const rd = runCli(['run-due', '--state-root', sr, '--runner', 'tmux-send',
    '--tmux-bin', fake, '--tmux-target', '%7']);
  assert.equal(rd.status, 0, rd.stderr);
  assert.match(rd.stdout, /succeeded/);

  const calls = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.match(calls[0], /^set-buffer -b codex-schedule-/);
  assert.match(calls[0], / -- tmux prompt$/);
  assert.match(calls[1], /^show-buffer -b codex-schedule-/);
  assert.equal(calls[2], 'send-keys -t %7 C-u');
  assert.match(calls[3], /^paste-buffer -t %7 -b codex-schedule-/);
  assert.equal(calls[4], 'send-keys -t %7 Enter');

  const t = readTasksFile(sr).tasks[0];
  assert.equal(t.runs.length, 1);
  assert.equal(t.runs[0].status, 'succeeded');
  assert.equal(t.status, 'cancelled');
  assert.match(fs.readFileSync(t.runs[0].lastMessagePath, 'utf8'), /tmux-send injected prompt into %7/);
});

test('run-due resume-command runner: passes prompt on stdin to external command', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const capture = path.join(work, 'resume.txt');
  const fake = writeFake(work, fakeResume(capture), 'resume.sh');
  const add = runCli(['add', '--state-root', sr, '--at', EPOCH, '--prompt', 'resume prompt', '--cwd', work]);
  assert.equal(add.status, 0, add.stderr);

  const rd = runCli(['run-due', '--state-root', sr, '--runner', 'resume-command',
    '--resume-command', fake]);
  assert.equal(rd.status, 0, rd.stderr);
  assert.match(rd.stdout, /succeeded/);

  assert.equal(fs.readFileSync(capture, 'utf8'), 'argv:\nstdin:resume prompt');
  const t = readTasksFile(sr).tasks[0];
  assert.equal(t.runs[0].status, 'succeeded');
  assert.match(fs.readFileSync(t.runs[0].lastMessagePath, 'utf8'), /resume-command completed/);
});

test('run-due auto runner: prefers tmux-send when a tmux target is available', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const log = path.join(work, 'tmux-auto.log');
  const fake = writeFake(work, fakeTmux(log), 'tmux');
  const add = runCli(['add', '--state-root', sr, '--at', EPOCH, '--prompt', 'tmux prompt', '--cwd', work]);
  assert.equal(add.status, 0, add.stderr);

  const rd = runCli(['run-due', '--state-root', sr, '--runner', 'auto',
    '--tmux-bin', fake, '--tmux-target', '%auto']);
  assert.equal(rd.status, 0, rd.stderr);
  assert.match(rd.stdout, /succeeded/);

  const calls = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.equal(calls[2], 'send-keys -t %auto C-u');
  const t = readTasksFile(sr).tasks[0];
  assert.match(fs.readFileSync(t.runs[0].lastMessagePath, 'utf8'), /tmux-send injected prompt into %auto/);
});

test('run-due auto runner: falls back to resume-command when no tmux target exists', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const capture = path.join(work, 'resume-auto.txt');
  const fake = writeFake(work, fakeResume(capture), 'resume-auto.sh');
  const add = runCli(['add', '--state-root', sr, '--at', EPOCH, '--prompt', 'resume prompt', '--cwd', work]);
  assert.equal(add.status, 0, add.stderr);

  const rd = runCli(['run-due', '--state-root', sr, '--runner', 'auto',
    '--resume-command', fake], { env: { TMUX_PANE: '' } });
  assert.equal(rd.status, 0, rd.stderr);
  assert.match(rd.stdout, /succeeded/);

  assert.equal(fs.readFileSync(capture, 'utf8'), 'argv:\nstdin:resume prompt');
  const t = readTasksFile(sr).tasks[0];
  assert.match(fs.readFileSync(t.runs[0].lastMessagePath, 'utf8'), /resume-command completed/);
});

test('run-due FAILURE: non-zero codex records failed, tasks.json valid', () => {
  const sr = mkTmp();
  const work = mkTmp();
  const fake = writeFake(work, fakeFail());
  const add = runCli(['add', '--state-root', sr, '--cron', '* * * * *',
    '--prompt', 'do', '--cwd', work, '--next-run-at', EPOCH]);
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
  runCli(['add', '--state-root', sr, '--cron', '* * * * *',
    '--prompt', 'tick', '--cwd', work, '--next-run-at', EPOCH]);

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
  runCli(['add', '--state-root', sr, '--cron', '* * * * *',
    '--prompt', 'tick', '--cwd', work, '--next-run-at', EPOCH]);
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
// Each blocker test is designed to FAIL against a pre-fix implementation
// and PASS after the fix.
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
  const add = runCli(['add', '--state-root', sr, '--cron', '* * * * *',
    '--prompt', 'go', '--cwd', work, '--next-run-at', EPOCH]);
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
  const add = runCli(['add', '--state-root', sr, '--cron', '* * * * *',
    '--prompt', 'go', '--cwd', work, '--next-run-at', EPOCH]);
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
  const add = runCli(['add', '--state-root', sr, '--cron', '* * * * *',
    '--prompt', 'big', '--cwd', work, '--next-run-at', EPOCH]);
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

// ---- NON-BLOCKER: cron single-value-with-step ---------------------------
test('cron single value with step: "5/15" -> {5,20,35,50}', async () => {
  const mod = await loadMod();
  const c = mod.parseCron('5/15 * * * *');
  assert.deepEqual([...c.minute].sort((a, b) => a - b), [5, 20, 35, 50]);
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
