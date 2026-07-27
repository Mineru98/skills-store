#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanner = path.join(root, '.codex/skills/convention/scripts/convention.mjs');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'convention-test-'));
const bin = path.join(tmp, 'bin');
const repo = path.join(tmp, 'repo');
const log = path.join(tmp, 'gh.log');
mkdirSync(bin);
mkdirSync(repo);

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || repo,
    env: options.env || process.env,
    encoding: 'utf8',
  });
}

function scan(flavor, scenario) {
  return run(process.execPath, [scanner, 'scan', '--flavor', flavor], {
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      FAKE_GH_SCENARIO: scenario,
      FAKE_GH_LOG: log,
    },
  });
}

const fakeGh = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
const scenario = process.env.FAKE_GH_SCENARIO;
const key = args.slice(0, 2).join(' ');
if (key === 'repo view') {
  if (scenario === 'fork') {
    console.log(JSON.stringify({
      nameWithOwner: 'mine/widget',
      isFork: true,
      defaultBranchRef: { name: 'dev' },
      parent: { nameWithOwner: 'upstream/widget', defaultBranchRef: { name: 'main' } },
      url: 'https://github.com/mine/widget'
    }));
  } else {
    console.log(JSON.stringify({
      nameWithOwner: 'acme/widget',
      isFork: false,
      defaultBranchRef: { name: 'trunk' },
      parent: null,
      url: 'https://github.com/acme/widget'
    }));
  }
} else if (key === 'issue list') {
  const version = scenario === 'clone-v2' ? 'docs: update guide' : 'feat(api): add search';
  console.log(JSON.stringify([
    { number: 1, title: version, body: '## Summary', labels: [] },
    { number: 2, title: 'fix: handle empty input', body: '## Expected', labels: [] }
  ]));
} else if (key === 'pr list') {
  const target = scenario === 'fork' ? 'main' : 'trunk';
  console.log(JSON.stringify([
    { number: 8, title: 'feat: add search', body: '## Summary', baseRefName: target, headRefName: 'feat/search', mergedAt: '2026-01-01T00:00:00Z' },
    { number: 9, title: 'fix: empty input', body: '## Summary', baseRefName: target, headRefName: 'fix/empty-input', mergedAt: '2026-01-02T00:00:00Z' }
  ]));
} else {
  console.error('unexpected gh call: ' + args.join(' '));
  process.exit(2);
}
`;

try {
  writeFileSync(path.join(bin, 'gh'), fakeGh);
  chmodSync(path.join(bin, 'gh'), 0o755);
  run('git', ['init', '-q']);
  run('git', ['config', 'user.name', 'Test']);
  run('git', ['config', 'user.email', 'test@example.com']);
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules\n');
  writeFileSync(path.join(repo, 'CONTRIBUTING.md'), '# Contributing\n\n## Development\n');
  mkdirSync(path.join(repo, '.github/ISSUE_TEMPLATE'), { recursive: true });
  writeFileSync(path.join(repo, '.github/ISSUE_TEMPLATE/bug.md'), '# Bug\n\n## Reproduction\n');
  writeFileSync(path.join(repo, 'AGENTS.local.md'), 'keep-before\n\nkeep-after\n');

  const first = scan('codex', 'clone');
  check('일반 clone 스캔 성공', first.status === 0, first.stderr);
  const agents1 = readFileSync(path.join(repo, 'AGENTS.local.md'), 'utf8');
  check('일반 clone 식별', agents1.includes('저장소 형태: 일반 clone'));
  check('현재 저장소가 기여 대상', agents1.includes('이슈 대상: `acme/widget`'));
  check('병합 PR에서 base 관찰', agents1.includes('PR base 브랜치: `trunk`'));
  check('기여 문서 발견', agents1.includes('`CONTRIBUTING.md`'));
  check('이슈 템플릿 발견', agents1.includes('`.github/ISSUE_TEMPLATE/bug.md`'));
  check('기여 문서 섹션 분석', agents1.includes('기여 문서 주요 섹션: Development'));
  check('이슈 제목 관례 관찰', agents1.includes('Conventional Commit형 접두사'));
  check('이슈 본문 형식 분석', agents1.includes('Reproduction') && agents1.includes('Summary'));
  check('PR 본문 형식 분석', agents1.includes('PR 본문 형식: Summary'));
  check('작업 브랜치 관례 관찰', agents1.includes('feat, fix'));
  check('기존 앞쪽 내용 보존', agents1.includes('keep-before'));
  check('기존 뒤쪽 내용 보존', agents1.includes('keep-after'));
  check('Codex 로컬 파일 gitignore 등록', readFileSync(path.join(repo, '.gitignore'), 'utf8').includes('/AGENTS.local.md'));

  const second = scan('codex', 'clone-v2');
  check('재스캔 성공', second.status === 0, second.stderr);
  const agents2 = readFileSync(path.join(repo, 'AGENTS.local.md'), 'utf8');
  check('전용 블록 하나만 유지', agents2.split('contribution-convention:START').length === 2);
  check('재스캔이 관찰값 교체', agents2.includes('docs, fix'));
  check('블록 밖 내용 재보존', agents2.includes('keep-before') && agents2.includes('keep-after'));
  check('gitignore 중복 없음', readFileSync(path.join(repo, '.gitignore'), 'utf8').split('/AGENTS.local.md').length === 2);

  const claude = scan('claude', 'fork');
  check('fork 스캔 성공', claude.status === 0, claude.stderr);
  const claudeFile = readFileSync(path.join(repo, 'CLAUDE.local.md'), 'utf8');
  check('fork 식별', claudeFile.includes('저장소 형태: fork'));
  check('원본 저장소 기록', claudeFile.includes('원본 저장소: `upstream/widget`'));
  check('원본을 이슈 대상으로 기록', claudeFile.includes('이슈 대상: `upstream/widget`'));
  check('원본을 PR 대상으로 기록', claudeFile.includes('PR 대상: `upstream/widget`'));
  check('원본 base 기록', claudeFile.includes('PR base 브랜치: `main`'));
  check('Claude 로컬 파일 gitignore 등록', readFileSync(path.join(repo, '.gitignore'), 'utf8').includes('/CLAUDE.local.md'));

  const calls = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const allowed = calls.every((args) =>
    (args[0] === 'repo' && args[1] === 'view')
    || (args[0] === 'issue' && args[1] === 'list')
    || (args[0] === 'pr' && args[1] === 'list'));
  check('gh 호출은 읽기 전용', allowed, JSON.stringify(calls));
  check('fork 조회는 원본 저장소 대상', calls.some((args) => args[0] === 'pr' && args.includes('upstream/widget')));

  const diff = run('diff', ['-r', '-x', 'agents', path.join(root, '.claude/skills/convention'), path.join(root, '.codex/skills/convention')], { cwd: root });
  check('Claude/Codex 스킬 미러 일치', diff.status === 0, diff.stdout || diff.stderr);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failed) {
  console.error(`\ntest-convention: ${failed}개 실패`);
  process.exit(1);
}
console.log('\ntest-convention: 통과');
