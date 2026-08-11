#!/usr/bin/env node
// scripts/check-shared.sh 가 호출하는 `build-phase-capability-bundle.mjs --check` 가
// 87경로 closure 가 낡았을 때 실제로 거부하고, 재생성 뒤에는 통과하는지 검증한다.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const BUILD_SCRIPT = 'scripts/build-phase-capability-bundle.mjs';
const SYNC_SCRIPT = 'scripts/sync-shared.sh';
const STALE_TARGET = 'tools/issue-phase-contract.mjs';

const fixture = () => {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'capability-bundle-check-'));
  const root = path.join(parent, 'repository');
  cpSync(process.cwd(), root, {
    recursive: true,
    filter: (source) => !['.git', '.issue'].includes(path.basename(source)),
  });
  return { parent, root };
};

const runCheck = (root) => spawnSync(
  process.execPath,
  [path.join(root, BUILD_SCRIPT), '--check'],
  { cwd: root, encoding: 'utf8' },
);
const runBuild = (root) => spawnSync(process.execPath, [path.join(root, BUILD_SCRIPT)], { cwd: root, encoding: 'utf8' });
const runSync = (root) => spawnSync('sh', [path.join(root, SYNC_SCRIPT)], { cwd: root, encoding: 'utf8' });

test('[active-required] --check rejects a stale capability bundle and accepts a regenerated one', () => {
  const current = fixture();
  try {
    const before = runCheck(current.root);
    assert.equal(before.status, 0, before.stderr);

    const target = path.join(current.root, STALE_TARGET);
    writeFileSync(target, Buffer.concat([readFileSync(target), Buffer.from('\n')]));

    const stale = runCheck(current.root);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /STALE.*CLOSURE_HASH_MISMATCH/);

    const syncSources = runSync(current.root);
    assert.equal(syncSources.status, 0, syncSources.stderr);
    const build = runBuild(current.root);
    assert.equal(build.status, 0, build.stderr);
    const syncBundle = runSync(current.root);
    assert.equal(syncBundle.status, 0, syncBundle.stderr);

    const fresh = runCheck(current.root);
    assert.equal(fresh.status, 0, fresh.stderr);
  } finally {
    rmSync(current.parent, { recursive: true, force: true });
  }
});
