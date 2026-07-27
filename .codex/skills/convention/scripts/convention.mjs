#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const START = '<!-- contribution-convention:START -->';
const END = '<!-- contribution-convention:END -->';
const TITLE_PREFIX = /^(feat|fix|docs|chore|refactor|test|perf|build|ci)(?:\([^)]*\))?:/i;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function run(command, args, cwd, { json = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.error?.message || '').trim();
    throw new Error(`${command} ${args.join(' ')} 실패${detail ? ` — ${detail}` : ''}`);
  }
  const output = String(result.stdout || '').trim();
  if (!json) return output;
  try {
    return output ? JSON.parse(output) : null;
  } catch {
    throw new Error(`${command} 출력이 JSON이 아닙니다`);
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('-') ? args.shift() : 'scan';
  let flavor = null;
  let cwd = process.cwd();
  while (args.length) {
    const arg = args.shift();
    if (arg === '--flavor') flavor = args.shift();
    else if (arg === '--cwd') cwd = path.resolve(args.shift() || '');
    else fail(`알 수 없는 인자: ${arg}`);
  }
  if (command !== 'scan') fail(`지원하지 않는 명령: ${command}`);
  if (!['claude', 'codex', 'both'].includes(flavor)) {
    fail('--flavor claude|codex|both 중 하나가 필요합니다');
  }
  return { cwd, flavor };
}

function walkFiles(root, relative = '') {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return [];
  const found = [];
  for (const name of readdirSync(absolute)) {
    const rel = path.join(relative, name);
    const full = path.join(root, rel);
    if (statSync(full).isDirectory()) found.push(...walkFiles(root, rel));
    else found.push(rel.split(path.sep).join('/'));
  }
  return found;
}

function evidenceFiles(root) {
  const fixed = [
    'CONTRIBUTING.md', 'CONTRIBUTING.rst', 'CONTRIBUTING.txt',
    '.github/CONTRIBUTING.md', '.github/PULL_REQUEST_TEMPLATE.md',
  ];
  const candidates = new Set(fixed.filter((file) => existsSync(path.join(root, file))));
  for (const dir of ['.github/ISSUE_TEMPLATE', '.github/PULL_REQUEST_TEMPLATE', 'docs']) {
    for (const file of walkFiles(root, dir)) {
      const base = path.basename(file).toLowerCase();
      if (dir === 'docs' && !base.startsWith('contributing')) continue;
      candidates.add(file);
    }
  }
  return [...candidates].sort();
}

function mostCommon(values, fallback) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || fallback;
}

function titleConvention(items) {
  if (!items.length) return '관찰 기록 없음';
  const matching = items.filter((item) => TITLE_PREFIX.test(item.title || ''));
  if (!matching.length) return '뚜렷한 접두사 관례 없음';
  const prefixes = [...new Set(matching.map((item) => (item.title.match(TITLE_PREFIX) || [])[1]?.toLowerCase()))]
    .filter(Boolean).sort();
  return `Conventional Commit형 접두사 관찰 (${prefixes.join(', ')}; ${matching.length}/${items.length})`;
}

function branchConvention(prs) {
  const branches = prs.map((pr) => pr.headRefName).filter(Boolean);
  if (!branches.length) return '관찰 기록 없음';
  const prefixes = [...new Set(branches.map((name) => name.includes('/') ? name.split('/')[0] : null).filter(Boolean))].sort();
  return prefixes.length ? `슬래시 접두사 관찰 (${prefixes.join(', ')})` : '뚜렷한 접두사 관례 없음';
}

function headings(markdown) {
  return [...String(markdown || '').matchAll(/^#{2,3}\s+(.+)$/gm)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function observedSections(markdowns) {
  const found = [...new Set(markdowns.flatMap(headings))].slice(0, 8);
  return found.length ? found.join(' / ') : '뚜렷한 섹션 관례 없음';
}

function fileMarkdowns(root, files, predicate) {
  return files
    .filter(predicate)
    .map((file) => readFileSync(path.join(root, file), 'utf8'));
}

function render({ root, repo, parent, isFork, targetRepo, base, observedBase, files, issues, prs }) {
  const kind = isFork ? 'fork' : '일반 clone';
  const documentText = files.length ? files.map((file) => `\`${file}\``).join(', ') : '발견하지 못함';
  const issueTemplates = fileMarkdowns(root, files, (file) => file.includes('/ISSUE_TEMPLATE/'));
  const prTemplates = fileMarkdowns(root, files, (file) => file.toLowerCase().includes('pull_request_template'));
  const contributionSections = fileMarkdowns(
    root, files, (file) => path.basename(file).toLowerCase().startsWith('contributing'),
  ).flatMap(headings);
  return `${START}
# 저장소 기여 컨벤션

- 저장소 형태: ${kind}
- 현재 저장소: \`${repo}\`
${isFork ? `- 원본 저장소: \`${parent}\`\n` : ''}- 이슈 대상: \`${targetRepo}\`
- PR 대상: \`${targetRepo}\`
- PR base 브랜치: \`${base}\`
- 최근 병합 PR base 관찰: \`${observedBase}\`
- 기여 문서·템플릿: ${documentText}
- 기여 문서 주요 섹션: ${contributionSections.length ? [...new Set(contributionSections)].slice(0, 8).join(' / ') : '발견하지 못함'}
- 이슈 제목 관찰: ${titleConvention(issues)}
- 이슈 본문 형식: ${observedSections([...issueTemplates, ...issues.map((issue) => issue.body)])}
- PR 본문 형식: ${observedSections([...prTemplates, ...prs.map((pr) => pr.body)])}
- 작업 브랜치 관찰: ${branchConvention(prs)}
- 분석 표본: 최근 이슈 ${issues.length}개 / 병합 PR ${prs.length}개

위 관찰값보다 저장소의 기여 문서와 템플릿을 우선한다. GitHub 상태나 remote·브랜치는 스캔 과정에서 변경하지 않는다.
${END}`;
}

function replaceBlock(current, block) {
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new Error('기여 컨벤션 블록 마커가 한쪽만 있거나 순서가 잘못됐습니다');
  }
  if (start === -1) return current.trimEnd() ? `${current.trimEnd()}\n\n${block}\n` : `${block}\n`;
  const after = end + END.length;
  return `${current.slice(0, start)}${block}${current.slice(after)}`;
}

function ensureIgnored(root, file) {
  const ignorePath = path.join(root, '.gitignore');
  const current = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : '';
  const entry = `/${file}`;
  if (current.split(/\r?\n/).includes(entry)) return;
  const prefix = current && !current.endsWith('\n') ? '\n' : '';
  writeFileSync(ignorePath, `${current}${prefix}${entry}\n`);
}

function ghJson(cwd, args) {
  return run('gh', args, cwd, { json: true });
}

function main() {
  const { cwd: requestedCwd, flavor } = parseArgs(process.argv.slice(2));
  let root;
  try {
    root = run('git', ['rev-parse', '--show-toplevel'], requestedCwd);
  } catch (error) {
    fail(error.message);
  }

  let metadata;
  try {
    metadata = ghJson(root, ['repo', 'view', '--json', 'nameWithOwner,isFork,parent,defaultBranchRef,url']);
  } catch (error) {
    fail(`${error.message}. GitHub CLI 로그인과 저장소 접근 권한을 확인하세요`);
  }

  const repo = metadata?.nameWithOwner;
  const isFork = Boolean(metadata?.isFork);
  const parent = metadata?.parent?.nameWithOwner || null;
  if (!repo || (isFork && !parent)) fail('저장소 또는 fork 원본 정보를 판별하지 못했습니다');
  const targetRepo = isFork ? parent : repo;
  const base = (isFork ? metadata?.parent?.defaultBranchRef?.name : metadata?.defaultBranchRef?.name) || 'main';

  let issues = [];
  let prs = [];
  try {
    issues = ghJson(root, ['issue', 'list', '--repo', targetRepo, '--state', 'all', '--limit', '20', '--json', 'number,title,body,labels']) || [];
    prs = ghJson(root, ['pr', 'list', '--repo', targetRepo, '--state', 'merged', '--limit', '20', '--json', 'number,title,body,baseRefName,headRefName,mergedAt']) || [];
  } catch (error) {
    fail(error.message);
  }

  const observedBase = mostCommon(prs.map((pr) => pr.baseRefName), base);
  const files = evidenceFiles(root);
  const block = render({ root, repo, parent, isFork, targetRepo, base, observedBase, files, issues, prs });
  const targets = flavor === 'both' ? ['claude', 'codex'] : [flavor];
  const written = [];
  for (const target of targets) {
    const file = target === 'claude' ? 'CLAUDE.local.md' : 'AGENTS.local.md';
    const full = path.join(root, file);
    const current = existsSync(full) ? readFileSync(full, 'utf8') : '';
    try {
      writeFileSync(full, replaceBlock(current, block));
    } catch (error) {
      fail(`${file}: ${error.message}`);
    }
    ensureIgnored(root, file);
    written.push(file);
  }

  console.log(JSON.stringify({
    ok: true, kind: isFork ? 'fork' : 'clone', repository: repo, targetRepository: targetRepo,
    baseBranch: base, observedBaseBranch: observedBase, files: written, evidenceFiles: files,
    issueSample: issues.length, prSample: prs.length,
  }, null, 2));
}

main();
