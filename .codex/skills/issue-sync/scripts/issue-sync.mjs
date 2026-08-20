#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { resolveSkillScript } from './issue-common.mjs';

function repoRoot() {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('git 저장소에서 실행해야 한다.');
  return result.stdout.trim();
}

try {
  const root = repoRoot();
  // 설치 위치(프로젝트 로컬 / 홈 전역 / 저장소를 링크한 개발 설치)를 가리지 않고 형제 스킬을 찾는다.
  const script = resolveSkillScript(import.meta.url, 'issue-onboard', 'issue-onboard.mjs', { root });
  if (!script) {
    throw new Error(
      'issue-onboard 스킬을 찾지 못했다. 프로젝트의 .claude/skills/ 나 ~/.claude/skills/ 에 설치돼 있는지 확인하라.',
    );
  }
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
