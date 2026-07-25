#!/usr/bin/env node
/**
 * issue-merge.mjs — 여러 워크트리를 한 번에 통합할 때 쓰는 보조 스크립트.
 *
 * 서브커맨드
 *   inventory              모든 워크트리 + 연결 이슈 + PR + 증거 상태를 JSON 으로
 *   base-tree              base 전용 임시 워크트리를 만든다 (사용자 작업 트리를 건드리지 않기 위해)
 *   plan-dir <n> [<n>...]  .issue/merge/<번호들>/ 을 만들고 경로를 출력
 *   merge --pr <n>         gh pr merge 래퍼. 실패 사유를 구조화해 출력
 *   close --issue <n> [--comment-file <f>]  이슈를 닫는다 (닫기 직전 status:close 로 전환)
 *   status <n> <상태>      진행 상태 라벨을 교체한다 (open|plan|in-process|review|close)
 *   cleanup                통합이 끝난 워크트리와 base-tree 를 정리
 *
 * 이 스크립트는 판단하지 않는다. 사실 수집과 단일 동작 실행만 한다.
 * merge 여부·순서·이슈 해결 판정은 SKILL.md 의 흐름과 서브에이전트가 정한다.
 *
 * 요구사항: git, gh(로그인), Node 18+
 */
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  run, git, fail, parseArgs, repoRoot, currentBranch, detectBase,
  inferIssue, listWorktrees, listEvidence, evidenceRel, WORKSPACE_DIR, setStatus, STATUS_ORDER,
} from './issue-common.mjs';

const USAGE = `Usage: node issue-merge.mjs <inventory|base-tree|plan-dir|merge|close|status|cleanup> [options]

  inventory                    워크트리·이슈·PR·증거 상태를 JSON 으로
  base-tree [--remove]         base 전용 임시 워크트리 생성/정리
  plan-dir <n> [<n>...]        .issue/merge/<번호들>/ 생성
  merge --pr <n> [--method squash|merge|rebase]
  close --issue <n> [--comment-file <f>] [--no-status]
  status <n> <${STATUS_ORDER.map((s) => s.slice(7)).join('|')}>
  cleanup --worktree <path> [--branch <name>]

  --base <branch>   기준 브랜치 고정`;

function baseTreePath(root) {
  return path.join(root, WORKSPACE_DIR, 'merge', 'base');
}

/* -------------------------------------------------------------- inventory */

function ghJson(args) {
  const r = run('gh', args);
  if (r.code !== 0) return null;
  try {
    return JSON.parse(r.out);
  } catch {
    return null;
  }
}

function cmdInventory(args) {
  const root = repoRoot();
  const base = detectBase(root, 'origin', args.base);
  const ghAuth = run('gh', ['auth', 'status']).code === 0;

  const seen = listWorktrees(root)
    // base 워크트리(주 체크아웃)와 이 스크립트가 만든 보조 트리는 통합 대상이 아니다.
    .filter((w) => w.branch !== base && !w.path.includes(`${WORKSPACE_DIR}/merge/`))
    .map((w) => {
      const item = { path: w.path, branch: w.branch, detached: w.detached, ahead: null, changedFiles: [] };

      // 이름 있는 브랜치는 저장소 루트에서 조회한다. 워크트리 디렉터리가 이미 사라진
      // prunable 상태여도 브랜치 ref 는 남아 있어 값을 얻을 수 있다.
      const [range, diffRange, opts] = w.branch
        ? [`origin/${base}..${w.branch}`, `origin/${base}...${w.branch}`, { cwd: root }]
        : [`origin/${base}..HEAD`, `origin/${base}...HEAD`, { cwd: w.path }];
      if (w.branch || existsSync(w.path)) {
        const c = git(['rev-list', '--count', range], opts);
        item.ahead = c.code === 0 ? Number(c.out) : null;
        const d = git(['diff', '--name-only', diffRange], opts);
        if (d.code === 0) item.changedFiles = d.out.split('\n').filter(Boolean);
      }
      return item;
    });

  // 기본 브랜치보다 앞선 커밋이 없으면 합칠 것이 없다. 후보에서 자동으로 뺀다.
  // 조용히 버리지 않고 excluded 로 남겨 호출부가 무엇을 걸렀는지 보고할 수 있게 한다.
  // ahead 가 null 인 것은 조회 실패라 "0 개"와 다르다. 모르는 것을 제외하지 않는다.
  const excluded = seen
    .filter((w) => w.ahead === 0)
    .map((w) => ({
      path: w.path,
      branch: w.branch,
      reason: `기본 브랜치(${base})보다 앞선 커밋이 없음 — 합칠 변경이 없다`,
    }));
  const excludedPaths = new Set(excluded.map((w) => w.path));

  const items = seen
    .filter((w) => !excludedPaths.has(w.path))
    .map((w) => {
      const issue = w.branch ? inferIssue(w.branch) : null;
      const key = issue ?? null;
      const evidence = key ? listEvidence(root, key) : [];
      const phase = (p) => (p.includes('/before/') ? 'before' : p.includes('/after/') ? 'after' : 'other');

      const item = {
        path: w.path,
        branch: w.branch,
        detached: w.detached,
        issue,
        issueState: null,
        issueTitle: null,
        issueUrl: null,
        pr: null,
        checks: null,
        evidence: {
          dir: key ? evidenceRel(root, key) : null,
          before: evidence.filter((f) => phase(f) === 'before').length,
          after: evidence.filter((f) => phase(f) === 'after').length,
          report: evidence.some((f) => f.endsWith('/comment.md')),
        },
        // "해결됐다"는 판정은 서브에이전트가 이슈 완료 기준과 대조해서 내린다.
        // 여기서는 판정에 필요한 재료만 모은다.
        ahead: w.ahead,
        changedFiles: w.changedFiles,
      };

      if (ghAuth && issue) {
        const j = ghJson(['issue', 'view', String(issue), '--json', 'number,title,state,url']);
        if (j) {
          item.issueState = j.state;
          item.issueTitle = j.title;
          item.issueUrl = j.url;
        }
      }

      if (ghAuth && w.branch) {
        const list = ghJson(['pr', 'list', '--head', w.branch, '--state', 'all', '--json', 'number,state,url,isDraft,mergeable']);
        item.pr = list?.[0] ?? null;
        if (item.pr) {
          const r = run('gh', ['pr', 'checks', String(item.pr.number), '--json', 'state']);
          if (r.code === 0) {
            try {
              const states = JSON.parse(r.out).map((c) => c.state);
              item.checks = states.some((s) => s === 'FAILURE' || s === 'ERROR') ? 'fail'
                : states.some((s) => s === 'PENDING' || s === 'IN_PROGRESS') ? 'pending'
                  : states.length ? 'pass' : 'none';
            } catch {
              item.checks = null;
            }
          } else {
            item.checks = 'none';
          }
        }
      }

      return item;
    });

  // 같은 파일을 건드리는 워크트리끼리 표시한다. 실제 충돌은 merge 로만 알 수 있다.
  for (const a of items) {
    a.overlapsWith = items
      .filter((b) => b !== a && b.changedFiles.some((f) => a.changedFiles.includes(f)))
      .map((b) => b.branch)
      .filter(Boolean);
  }

  console.log(JSON.stringify({
    repoRoot: root,
    baseBranch: base,
    currentBranch: currentBranch(),
    ghAuth,
    count: items.length,
    worktrees: items,
    excludedCount: excluded.length,
    excluded,
  }, null, 2));
}

/* -------------------------------------------------------------- base-tree */

/**
 * base 전용 임시 워크트리.
 *
 * "변경 이력을 가져가지 않고 base 로 checkout" 을 사용자의 작업 트리에서 하면
 * 진행 중인 다른 워크트리 작업이 위험해진다. 그래서 별도 트리를 만들어 그 안에서만 움직인다.
 */
function cmdBaseTree(args) {
  const root = repoRoot();
  const target = baseTreePath(root);

  if (args.remove) {
    git(['worktree', 'remove', '--force', target], { cwd: root });
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    console.log(JSON.stringify({ removed: true, path: target }, null, 2));
    return;
  }

  const base = detectBase(root, 'origin', args.base);
  git(['fetch', 'origin', base, '--prune'], { cwd: root });

  if (existsSync(target)) {
    // 이미 있으면 최신 base 로 맞추기만 한다.
    const r = git(['checkout', '--detach', `origin/${base}`], { cwd: target });
    if (r.code !== 0) fail(`base 워크트리 갱신 실패: ${r.err}`);
    console.log(JSON.stringify({ path: target, created: false, base, refreshed: true }, null, 2));
    return;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  const add = git(['worktree', 'add', '--detach', target, `origin/${base}`], { cwd: root });
  if (add.code !== 0) fail(`base 워크트리 생성 실패: ${add.err}`);
  console.log(JSON.stringify({
    path: target, created: true, base,
    note: '통합 작업은 이 경로에서 수행하세요. 끝나면 base-tree --remove 로 정리합니다.',
  }, null, 2));
}

/* --------------------------------------------------------------- plan-dir */

function cmdPlanDir(numbers) {
  const root = repoRoot();
  if (!numbers.length) fail('이슈 번호가 하나 이상 필요합니다 (예: plan-dir 16 21 53 64)');
  const name = numbers.map(Number).sort((a, b) => a - b).join('-');
  const dir = path.join(root, WORKSPACE_DIR, 'merge', name);
  mkdirSync(dir, { recursive: true });
  console.log(JSON.stringify({
    dir,
    rel: path.relative(root, dir).split(path.sep).join('/'),
    planFile: path.join(dir, 'plan.md'),
    reviewFile: path.join(dir, 'review.md'),
    issues: numbers.map(Number),
    note: '.issue/merge/** 는 무시되는 경로입니다. 계획 문서는 커밋되지 않습니다.',
  }, null, 2));
}

/* ------------------------------------------------------------------ merge */

function cmdMerge(args) {
  if (!args.pr) fail('--pr <번호> 가 필요합니다.');
  const method = args.method || 'squash';
  if (!['squash', 'merge', 'rebase'].includes(method)) {
    fail(`알 수 없는 merge 방식: ${method} (가능: squash, merge, rebase)`);
  }

  // 증거 URL 이 브랜치에 의존할 수 있으므로 --delete-branch 를 붙이지 않는다.
  const r = run('gh', ['pr', 'merge', String(args.pr), `--${method}`]);
  if (r.code !== 0) {
    console.log(JSON.stringify({
      merged: false, pr: Number(args.pr), method,
      reason: r.err || r.out,
      hint: 'CI 실패 · 충돌 · 승인 부족 중 하나입니다. gh pr checks 와 gh pr view 로 확인하세요.',
    }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ merged: true, pr: Number(args.pr), method }, null, 2));
}

/* ------------------------------------------------------------------ close */

function cmdClose(args) {
  if (!args.issue) fail('--issue <번호> 가 필요합니다.');
  if (args['comment-file']) {
    const c = run('gh', ['issue', 'comment', String(args.issue), '--body-file', args['comment-file']]);
    if (c.code !== 0) fail(`이슈 코멘트 실패: ${c.err}`);
  }
  // 라벨은 닫기 전에 바꾼다. 닫힌 뒤에 붙이면 실패 여지가 늘어난다.
  const status = args['no-status']
    ? null
    : setStatus(repoRoot(), args.issue, 'close', { quiet: true });
  const r = run('gh', ['issue', 'close', String(args.issue)]);
  if (r.code !== 0) fail(`이슈 close 실패: ${r.err}`);
  console.log(JSON.stringify({
    closed: true,
    issue: Number(args.issue),
    commented: Boolean(args['comment-file']),
    status: status ? status.status : null,
    statusChanged: status ? status.changed : false,
  }, null, 2));
}

/* ----------------------------------------------------------------- status */

function cmdStatus(a) {
  setStatus(repoRoot(), a._[0] ?? a.issue, a._[1], { repo: a.repo, dryRun: a.dryRun });
}

/* ---------------------------------------------------------------- cleanup */

function cmdCleanup(args) {
  const root = repoRoot();
  if (!args.worktree) fail('--worktree <경로> 가 필요합니다.');
  const wt = path.resolve(args.worktree);

  const r = git(['worktree', 'remove', args.force ? '--force' : '--', wt].filter(Boolean), { cwd: root });
  const removed = r.code === 0;
  let branchDeleted = false;
  if (removed && args.branch) {
    branchDeleted = git(['branch', '-d', args.branch], { cwd: root }).code === 0;
  }
  console.log(JSON.stringify({
    worktreeRemoved: removed,
    reason: removed ? null : r.err,
    branchDeleted,
    note: 'evidence/issue-* 브랜치와 원격 브랜치는 증거 URL 이 의존하므로 여기서 지우지 않습니다.',
  }, null, 2));
}

/* ------------------------------------------------------------------ entry */

const [, , sub, ...rest] = process.argv;
const args = parseArgs(rest, ['json', 'dry-run', 'remove', 'force', 'no-status']);

switch (sub) {
  case 'status': cmdStatus(args); break;
  case 'inventory': cmdInventory(args); break;
  case 'base-tree': cmdBaseTree(args); break;
  case 'plan-dir': cmdPlanDir(args._); break;
  case 'merge': cmdMerge(args); break;
  case 'close': cmdClose(args); break;
  case 'cleanup': cmdCleanup(args); break;
  default:
    console.error(USAGE);
    process.exit(1);
}
