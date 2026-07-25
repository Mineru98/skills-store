#!/usr/bin/env node
/**
 * shared/issue-common.mjs 스모크 테스트.
 *
 *   node scripts/test-common.mjs
 *
 * 4개 스킬이 이 모듈에 의존하므로 정본을 고칠 때마다 돌린다.
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as C from '../shared/issue-common.mjs';

let failed = 0;
const eq = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL  ${label}\n      기대: ${e}\n      실제: ${a}`);
    failed += 1;
  }
};

/* parseIssueNumber */
eq('parseIssueNumber("59")', C.parseIssueNumber('59'), 59);
eq('parseIssueNumber("#59")', C.parseIssueNumber('#59'), 59);
eq('parseIssueNumber(issue URL)', C.parseIssueNumber('https://github.com/o/r/issues/59'), 59);
eq('parseIssueNumber(설명 텍스트)', C.parseIssueNumber('로그인 버튼 고쳐줘'), null);
eq('parseIssueNumber(끝자리 숫자만 있는 문장)', C.parseIssueNumber('버튼을 3개로 늘려줘'), null);
eq('parseIssueNumber("")', C.parseIssueNumber(''), null);

/* inferIssue */
eq('inferIssue("fix/59-login")', C.inferIssue('fix/59-login'), '59');
eq('inferIssue("59-login")', C.inferIssue('59-login'), '59');
eq('inferIssue("issue_59")', C.inferIssue('issue_59'), '59');
eq('inferIssue("main")', C.inferIssue('main'), null);
// 타임스탬프 브랜치에서 엉뚱한 숫자를 집으면 남의 이슈를 close 하게 된다
eq('inferIssue(타임스탬프 브랜치)', C.inferIssue('worktree-cc-20260726-044434-14199'), null);
eq('inferIssue("release-2024-01")', C.inferIssue('release-2024-01'), null);

/* slugify / prefixFromLabels */
eq('slugify', C.slugify('FAB Tab  활성 상태!'), 'fab-tab');
eq('prefixFromLabels(bug)', C.prefixFromLabels(['bug']), 'fix');
eq('prefixFromLabels(enhancement)', C.prefixFromLabels(['enhancement']), 'feat');
eq('prefixFromLabels(없음)', C.prefixFromLabels([]), 'fix');

/* evidenceKey */
eq('evidenceKey(인자 우선)', C.evidenceKey({ issue: '7' }, 'fix/59-x'), { key: '7', issue: '7' });
eq('evidenceKey(브랜치 추론)', C.evidenceKey({}, 'fix/59-x'), { key: '59', issue: '59' });
eq('evidenceKey(이슈 없음)', C.evidenceKey({}, 'hotfix'), { key: 'no-issue-hotfix', issue: null });

/* parseArgs */
eq('parseArgs', C.parseArgs(['--issue', '59', '--push', 'extra']), {
  _: ['extra'], issue: '59', push: true,
});

/* 경로 + gitignore (임시 저장소) */
const tmp = mkdtempSync(path.join(os.tmpdir(), 'issue-common-test-'));
try {
  C.git(['init', '-q', tmp]);

  eq('evidenceRel', C.evidenceRel(tmp, '59'), '.issue/59/evidence');
  eq('issueDir', path.relative(tmp, C.issueDir(tmp, '59')), '.issue/59');

  // 구 경로 폴백: .issue/59 가 없고 .issue-start/59 만 있으면 후자를 쓴다
  mkdirSync(path.join(tmp, '.issue-start', '77'), { recursive: true });
  eq('issueDir(구 경로 폴백)', path.relative(tmp, C.issueDir(tmp, '77')), '.issue-start/77');

  // gitignore 블록 삽입 + 구 규칙 정리
  writeFileSync(path.join(tmp, '.gitignore'), 'node_modules\n.issue-start\n!.issue-evidence/\n');
  eq('ensureIgnoreBlock(최초)', C.ensureIgnoreBlock(tmp), true);
  eq('ensureIgnoreBlock(멱등)', C.ensureIgnoreBlock(tmp), false);
  const gi = readFileSync(path.join(tmp, '.gitignore'), 'utf8');
  eq('구 .issue-start 줄 제거', gi.split('\n').includes('.issue-start'), false);
  eq('구 evidence 예외 제거', gi.includes('!.issue-evidence/'), false);
  eq('node_modules 보존', gi.split('\n').includes('node_modules'), true);
  eq('블록 삽입', gi.includes('!.issue/*/evidence/**'), true);

  // 실제 무시 동작
  mkdirSync(path.join(tmp, '.issue/59/evidence/after'), { recursive: true });
  mkdirSync(path.join(tmp, '.issue/worktrees/59-x'), { recursive: true });
  writeFileSync(path.join(tmp, '.issue/59/plan.md'), '');
  writeFileSync(path.join(tmp, '.issue/59/evidence/after/a.webp'), '');
  writeFileSync(path.join(tmp, '.issue/worktrees/59-x/pkg.json'), '');
  eq('isIgnored(plan.md)', C.isIgnored(tmp, '.issue/59/plan.md'), true);
  eq('isIgnored(evidence)', C.isIgnored(tmp, '.issue/59/evidence/after/a.webp'), false);
  eq('isIgnored(nested 워크트리)', C.isIgnored(tmp, '.issue/worktrees/59-x/pkg.json'), true);
  eq('listEvidence', C.listEvidence(tmp, '59'), ['.issue/59/evidence/after/a.webp']);

  /* resolveWorktreePath */
  const repo = path.join(tmp, 'myapp');
  eq('resolveWorktreePath(sibling)', C.resolveWorktreePath(repo, 59, 'fix-login', 'sibling'),
    path.join(tmp, 'myapp-issue-59'));
  eq('resolveWorktreePath(nested)', C.resolveWorktreePath(repo, 59, 'fix-login', 'nested'),
    path.join(repo, '.issue/worktrees/59-fix-login'));
  eq('resolveWorktreePath(미결정)', C.resolveWorktreePath(repo, 59, 'x', null), null);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failed) {
  console.error(`\ntest-common: ${failed}건 실패`);
  process.exit(1);
}
console.log('test-common: 통과');
