#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

function repoRoot() {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('git 저장소에서 실행해야 한다.');
  return result.stdout.trim();
}

function onboardScript(root) {
  return [
    path.join(root, '.codex', 'skills', 'issue-onboard', 'scripts', 'issue-onboard.mjs'),
    path.join(root, '.claude', 'skills', 'issue-onboard', 'scripts', 'issue-onboard.mjs'),
  ].find(existsSync);
}

try {
  const root = repoRoot();
  const script = onboardScript(root);
  if (!script) throw new Error('issue-onboard 스킬을 찾지 못했다.');
  const result = spawnSync(process.execPath, [script, 'sync', '--state', 'all'], { cwd: root, encoding: 'utf8' });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0 || !result.stdout.includes('SNAPSHOT_STATUS=complete')) {
    console.log('GRAPH_SYNC=failed');
    process.exit(result.status || 2);
  }
  console.log('GRAPH_SYNC=ok');
} catch (error) {
  console.error(`✗ ${error.message}`);
  console.log('GRAPH_SYNC=failed');
  process.exit(1);
}
