#!/usr/bin/env node
/**
 * issue-merge.mjs — 여러 워크트리를 한 번에 통합할 때 쓰는 보조 스크립트.
 *
 * 서브커맨드
 *   inventory              모든 워크트리 + 연결 이슈 + PR + 증거 상태를 JSON 으로
 *   base-tree              base 전용 임시 워크트리를 만든다 (사용자 작업 트리를 건드리지 않기 위해)
 *   plan-dir <n> [<n>...]  .issue/merge/<번호들>/ 을 만들고 경로를 출력
 *   preflight --branch <b> merge 를 실제로 하지 않고 충돌 파일을 확정한다
 *   resolve --worktree <p> 작업 브랜치 쪽에서 충돌을 해소할 판을 깐다
 *   merge --pr <n>         PR merge 래퍼. 실패 사유를 구조화해 출력
 *   close --issue <n> [--comment-file <f>]  이슈를 닫는다
 *   cleanup                통합이 끝난 워크트리와 base-tree 를 정리
 *
 * 이 스크립트는 판단하지 않는다. 사실 수집과 단일 동작 실행만 한다.
 * merge 여부·순서·이슈 해결 판정은 SKILL.md 의 흐름과 서브에이전트가 정한다.
 * 충돌도 같다 — 어디가 충돌인지는 여기서 알아내고, 어떻게 합칠지는 서브에이전트가 정한다.
 *
 * 이슈 백엔드는 ~/.issue/settings.json 의 provider 설정이 정한다 (github 기본 | jira).
 * PR 은 코드 호스트(GitHub) 의 것이라 트래커와 무관하게 gitHost 를 쓴다.
 *
 * 요구사항: git, Node 18+, (github 면 gh 로그인 / jira 면 baseUrl·projectKey·토큰)
 */
import { mkdirSync, existsSync, rmSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  git, fail, parseArgs, repoRoot, currentBranch, detectBase,
  inferIssue, listWorktrees, listEvidence, evidenceRel, WORKSPACE_DIR,
} from './issue-common.mjs';
import { createTracker, gitHost, setTrackerStatus } from './issue-tracker.mjs';

const USAGE = `Usage: node issue-merge.mjs <inventory|base-tree|plan-dir|preflight|resolve|merge|close|status|cleanup> [options]

  inventory                    워크트리·이슈·PR·증거 상태를 JSON 으로
  base-tree [--remove]         base 전용 임시 워크트리 생성/정리
  plan-dir <n> [<n>...]        .issue/merge/<번호들>/ 생성
  preflight --branch <b> [--onto <commit>]
  resolve --worktree <path> [--continue [--push] | --abort]
  merge --pr <n> [--method squash|merge|rebase]
  close --issue <n> [--comment-file <f>]
  status <n> <open|plan|in-process|review|close>
  cleanup --worktree <path> [--branch <name>]

  --base <branch>   기준 브랜치 고정`;

function baseTreePath(root) {
  return path.join(root, WORKSPACE_DIR, 'merge', 'base');
}

/* -------------------------------------------------------------- inventory */

function cmdInventory(args) {
  const root = repoRoot();
  const base = detectBase(root, 'origin', args.base);
  const tracker = createTracker(root);
  const trackerAuth = tracker.auth().ok;
  const ghAuth = gitHost.auth().ok;

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

      if (trackerAuth && issue) {
        const j = tracker.issueView(issue);
        if (j) {
          item.issueState = j.state;
          item.issueTitle = j.title;
          item.issueUrl = j.url;
          item.issueKey = j.key;
        }
      }

      // PR 은 코드 호스트 소관이다. 트래커가 Jira 여도 여기는 GitHub 을 본다.
      if (ghAuth && w.branch) {
        item.pr = gitHost.prForBranch(w.branch);
        if (item.pr) item.checks = gitHost.prChecks(item.pr.number);
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
    provider: tracker.provider,
    trackerAuth,
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

/* -------------------------------------------------------------- preflight */

// 도구가 다시 만들어 주는 파일들. 충돌해도 헌크를 손으로 합칠 대상이 아니다.
const GENERATED = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|npm-shrinkwrap\.json)$/,
  /(^|\/)(Cargo\.lock|poetry\.lock|Pipfile\.lock|composer\.lock|Gemfile\.lock|go\.sum)$/,
  /(^|\/)(dist|build|out|coverage|\.next|\.nuxt|__snapshots__)\//,
];

/** 경로 모양만 본다. 파일 내용으로 판단하지 않는다. */
function conflictKind(p) {
  return GENERATED.some((re) => re.test(p)) ? 'generated' : 'content';
}

/**
 * merge 를 실제로 하지 않고 충돌 파일을 확정한다.
 *
 * `git merge-tree --write-tree` 는 워킹트리와 인덱스를 전혀 건드리지 않고 합친 결과 트리를
 * 만들어 본다. 그래서 base 브랜치도, 사용자의 작업 트리도 안전하다.
 *
 * `--onto` 로 앞선 preflight 가 출력한 `commit` 을 넘기면 계획한 순서대로 누적해 볼 수 있다.
 * "앞의 merge 가 뒤의 기준선을 바꾼다"를 merge 전에 잡아내는 유일한 방법이다.
 * 넘기는 것은 **커밋**이다 — merge-tree 는 공통 조상을 찾아야 하므로 tree 만으로는 합칠 수 없다.
 * 그래서 깨끗하게 합쳐졌을 때만 결과 트리를 커밋으로 감싸 `commit` 으로 내보낸다.
 * 충돌이 난 회차는 체인이 끊긴다 — 해소가 먼저다.
 */
function cmdPreflight(args) {
  const root = repoRoot();
  if (!args.branch) fail('--branch <브랜치> 가 필요합니다.');
  const base = detectBase(root, 'origin', args.base);
  const onto = args.onto || `origin/${base}`;

  git(['fetch', 'origin', base, '--prune'], { cwd: root });

  const oid = {};
  for (const [name, ref] of [['onto', onto], ['branch', args.branch]]) {
    const v = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: root });
    if (v.code !== 0) fail(`커밋으로 해석할 수 없습니다: ${ref} (--onto 에는 앞선 preflight 의 commit 값을 넘기세요)`);
    oid[name] = v.out;
  }

  const r = git(['merge-tree', '--write-tree', '--name-only', '--no-messages', oid.onto, oid.branch], { cwd: root });
  const [first, ...paths] = r.out.split('\n');
  const treeOk = /^[0-9a-f]{40,64}$/.test(first || '');

  // exit 0 = 깨끗함, 1 = 충돌. 다만 인자를 합칠 수 없을 때도 1 이 나오므로
  // 트리 줄이 안 나왔으면 충돌이 아니라 실패다. 0건을 "충돌 없음"으로 착각하면 안 된다.
  if (!treeOk) {
    const fb = preflightViaWorktree(root, oid.onto, oid.branch);
    console.log(JSON.stringify({
      branch: args.branch, onto, ...fb, commit: null, via: 'worktree',
      mergeTreeError: r.err || r.out || null,
    }, null, 2));
    if (!fb.clean) process.exitCode = 1;
    return;
  }

  const conflicts = paths.filter(Boolean).map((p) => ({ path: p, kind: conflictKind(p) }));
  const clean = r.code === 0;

  // 다음 회차가 이어 볼 수 있도록 결과 트리를 커밋으로 감싼다. 어떤 ref 도 움직이지 않는다.
  let chain = null;
  if (clean) {
    const c = git([
      '-c', 'user.name=issue-merge', '-c', 'user.email=issue-merge@local',
      'commit-tree', first, '-p', oid.onto, '-p', oid.branch,
      '-m', `preflight: ${args.branch} onto ${onto}`,
    ], { cwd: root });
    chain = c.code === 0 ? c.out : null;
  }

  console.log(JSON.stringify({
    branch: args.branch,
    onto,
    clean,
    tree: first,
    commit: chain,
    conflicts,
    conflictCount: conflicts.length,
    via: 'merge-tree',
    note: clean
      ? 'commit 값을 다음 preflight 의 --onto 로 넘기면 계획 순서대로 누적 확인이 됩니다.'
      : '충돌이 남아 있어 누적 체인을 이을 수 없습니다. resolve 로 먼저 해소하세요.',
  }, null, 2));
  if (!clean) process.exitCode = 1;
}

/**
 * merge-tree 를 쓸 수 없을 때의 폴백.
 * 버리는 detached 워크트리에서 시험 merge 하고 즉시 되돌린다. base-tree 는 건드리지 않는다.
 */
function preflightViaWorktree(root, onto, branch) {
  const probe = path.join(root, WORKSPACE_DIR, 'merge', '.preflight');
  git(['worktree', 'remove', '--force', probe], { cwd: root });
  if (existsSync(probe)) rmSync(probe, { recursive: true, force: true });

  mkdirSync(path.dirname(probe), { recursive: true });
  const add = git(['worktree', 'add', '--detach', probe, onto], { cwd: root });
  if (add.code !== 0) fail(`시험 워크트리 생성 실패: ${add.err}`);

  try {
    const m = git(['merge', '--no-commit', '--no-ff', branch], { cwd: probe });
    const conflicts = m.code === 0 ? [] : git(['diff', '--name-only', '--diff-filter=U'], { cwd: probe })
      .out.split('\n').filter(Boolean).map((p) => ({ path: p, kind: conflictKind(p) }));
    git(['merge', '--abort'], { cwd: probe });
    return { clean: m.code === 0, tree: null, conflicts, conflictCount: conflicts.length };
  } finally {
    git(['worktree', 'remove', '--force', probe], { cwd: root });
    if (existsSync(probe)) rmSync(probe, { recursive: true, force: true });
  }
}

/* ---------------------------------------------------------------- resolve */

const MAX_SCAN = 1024 * 1024;

/** 충돌 마커가 남은 파일과 각 마커의 줄 번호. 1MB 초과 파일은 내용을 읽지 않는다. */
function scanMarkers(wt, paths) {
  return paths.map((p) => {
    const full = path.join(wt, p);
    if (!existsSync(full)) return { path: p, kind: conflictKind(p), hunks: [], unreadable: '파일이 없음' };
    if (statSync(full).size > MAX_SCAN) return { path: p, kind: conflictKind(p), hunks: [], unreadable: '1MB 초과 — 직접 열어 확인' };
    const lines = readFileSync(full, 'utf8').split('\n');
    const hunks = lines.reduce((acc, l, i) => (l.startsWith('<<<<<<<') ? [...acc, i + 1] : acc), []);
    return { path: p, kind: conflictKind(p), hunks };
  });
}

function unmerged(wt) {
  return git(['diff', '--name-only', '--diff-filter=U'], { cwd: wt }).out.split('\n').filter(Boolean);
}

/**
 * 충돌을 작업 브랜치 쪽에서 해소할 판을 깐다.
 *
 * base 를 작업 브랜치로 끌어와 merge 하므로, 해소 결과는 그 브랜치의 커밋이 된다.
 * base 브랜치도 base-tree 도 바뀌지 않고, 해소된 브랜치는 이후 gh pr merge 로 깨끗이 들어간다.
 *
 * 이 명령은 충돌 지점만 알려주고 멈춘다. 헌크를 어떻게 합칠지는 서브에이전트가 정한다.
 */
function cmdResolve(args) {
  const root = repoRoot();
  if (!args.worktree) fail('--worktree <경로> 가 필요합니다.');
  const wt = path.resolve(args.worktree);
  if (!existsSync(wt)) fail(`워크트리를 찾을 수 없습니다: ${wt}`);
  if (wt === baseTreePath(root)) fail('base 워크트리에서는 해소하지 않습니다. 작업 브랜치의 워크트리를 지정하세요.');

  const branch = currentBranch(wt);
  // detached 면 push 대상이 없다. 해소해도 PR 에 반영되지 않으므로 시작하지 않는다.
  if (!branch) fail(`detached 상태의 워크트리입니다: ${wt} — 브랜치를 체크아웃한 뒤 다시 실행하세요.`);
  const base = detectBase(root, 'origin', args.base);

  if (args.abort) {
    const r = git(['merge', '--abort'], { cwd: wt });
    console.log(JSON.stringify({ aborted: r.code === 0, worktree: wt, branch, reason: r.code === 0 ? null : r.err }, null, 2));
    if (r.code !== 0) process.exitCode = 1;
    return;
  }

  if (args.continue) {
    const left = scanMarkers(wt, unmerged(wt)).filter((f) => f.hunks.length || f.unreadable);
    if (left.length) {
      console.log(JSON.stringify({
        committed: false, worktree: wt, branch,
        reason: '충돌 마커가 남아 있습니다. 전부 해소한 뒤 다시 실행하세요.',
        remaining: left,
      }, null, 2));
      process.exit(1);
    }
    const add = git(['add', '-A'], { cwd: wt });
    if (add.code !== 0) fail(`git add 실패: ${add.err}`);
    const c = git(['commit', '--no-edit'], { cwd: wt });
    // 해소 결과가 base 와 동일하면 커밋할 것이 없다. 실패가 아니다.
    const nothing = /nothing to commit|no changes added/i.test(c.out + c.err);
    if (c.code !== 0 && !nothing) fail(`커밋 실패: ${c.err || c.out}`);

    let pushed = null;
    if (args.push) {
      const p = git(['push', 'origin', `HEAD:refs/heads/${branch}`], { cwd: wt });
      pushed = p.code === 0;
      if (!pushed) {
        console.log(JSON.stringify({ committed: true, worktree: wt, branch, pushed: false, reason: p.err || p.out }, null, 2));
        process.exit(1);
      }
    }
    console.log(JSON.stringify({
      committed: true, worktree: wt, branch, pushed,
      note: pushed === null ? '아직 push 하지 않았습니다. 승인 후 --continue --push 로 올리세요.' : null,
    }, null, 2));
    return;
  }

  // 진행 중인 merge 가 이미 있으면 그 상태를 그대로 보고한다. 덮어쓰지 않는다.
  const inProgress = existsSync(path.join(git(['rev-parse', '--absolute-git-dir'], { cwd: wt }).out, 'MERGE_HEAD'));
  if (inProgress) {
    const files = scanMarkers(wt, unmerged(wt));
    console.log(JSON.stringify({
      worktree: wt, branch, base, started: false, alreadyInProgress: true,
      clean: files.length === 0, conflicts: files, conflictCount: files.length,
    }, null, 2));
    return;
  }

  const dirty = git(['status', '--porcelain'], { cwd: wt }).out;
  if (dirty) {
    console.log(JSON.stringify({
      worktree: wt, branch, started: false,
      reason: '저장 안 된 변경이 있습니다. 먼저 커밋하거나 치운 뒤 다시 실행하세요.',
      dirty: dirty.split('\n').filter(Boolean),
    }, null, 2));
    process.exit(1);
  }

  git(['fetch', 'origin', base, '--prune'], { cwd: wt });
  const m = git(['merge', '--no-edit', `origin/${base}`], { cwd: wt });
  if (m.code === 0) {
    console.log(JSON.stringify({
      worktree: wt, branch, base, started: true, clean: true,
      conflicts: [], conflictCount: 0,
      note: '충돌 없이 최신 base 를 받았습니다. 해소할 것이 없습니다.',
    }, null, 2));
    return;
  }

  const files = scanMarkers(wt, unmerged(wt));
  if (!files.length) {
    git(['merge', '--abort'], { cwd: wt });
    fail(`merge 가 실패했지만 충돌 파일이 없습니다. 되돌렸습니다: ${m.err || m.out}`);
  }
  console.log(JSON.stringify({
    worktree: wt, branch, base, started: true, clean: false,
    conflicts: files, conflictCount: files.length,
    note: 'merge 를 진행 중 상태로 멈춰 두었습니다. 해소 후 --continue, 되돌리려면 --abort.',
  }, null, 2));
  process.exitCode = 1;
}

/* ------------------------------------------------------------------ merge */

/** gh 출력에서 실패 원인을 갈라낸다. 호출부가 다시 조사하지 않게 한다. */
function mergeFailureCause(text) {
  const t = text.toLowerCase();
  if (/not mergeable|merge conflict|conflicts? with the base|dirty/.test(t)) return 'conflict';
  if (/required status check|checks? (are )?fail|failing check|not successful/.test(t)) return 'checks';
  if (/review|approv|protected branch|not authorized|permission/.test(t)) return 'approval';
  if (/closed|already merged|no pull requests? found|not found/.test(t)) return 'state';
  return 'unknown';
}

const MERGE_HINT = {
  conflict: 'preflight --branch <브랜치> 로 충돌 파일을 확정하고 resolve 로 해소하세요.',
  checks: 'gh pr checks <번호> 로 실패한 체크를 확인하세요. CI 가 실패한 PR 은 merge 하지 않습니다.',
  approval: '리뷰 승인이나 브랜치 보호 규칙을 확인하세요. 스크립트가 우회하지 않습니다.',
  state: 'gh pr view <번호> 로 PR 상태를 확인하세요. 이미 닫혔거나 merge 됐을 수 있습니다.',
  unknown: 'gh pr checks 와 gh pr view 로 확인하세요.',
};

function cmdMerge(args) {
  if (!args.pr) fail('--pr <번호> 가 필요합니다.');
  const method = args.method || 'squash';
  if (!['squash', 'merge', 'rebase'].includes(method)) {
    fail(`알 수 없는 merge 방식: ${method} (가능: squash, merge, rebase)`);
  }

  // 증거 URL 이 브랜치에 의존할 수 있으므로 --delete-branch 를 붙이지 않는다.
  const r = gitHost.prMerge(args.pr, method);
  if (!r.ok) {
    const reason = r.err || r.out;
    const cause = mergeFailureCause(reason);
    console.log(JSON.stringify({
      merged: false, pr: Number(args.pr), method,
      cause, reason, hint: MERGE_HINT[cause],
    }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ merged: true, pr: Number(args.pr), method }, null, 2));
}

/* ------------------------------------------------------------------ close */

function cmdClose(args) {
  if (!args.issue) fail('--issue <번호> 가 필요합니다.');
  const tracker = createTracker(repoRoot());
  if (!args['no-status']) {
    const status = setTrackerStatus(tracker, args.issue, 'close', { quiet: true });
    if (!status.ok) fail(`status:close 전환 실패: ${status.err}`);
  }
  if (args['comment-file']) {
    const c = tracker.issueComment(args.issue, args['comment-file']);
    if (!c.ok) fail(`이슈 코멘트 실패: ${c.err}`);
  }
  const r = tracker.issueClose(args.issue);
  if (!r.ok) fail(`이슈 close 실패: ${r.err}`);
  console.log(JSON.stringify({
    closed: true,
    provider: tracker.provider,
    issue: Number(args.issue),
    issueKey: tracker.displayKey(args.issue),
    commented: Boolean(args['comment-file']),
  }, null, 2));
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
const args = parseArgs(rest, ['json', 'dry-run', 'remove', 'force', 'no-status', 'continue', 'abort', 'push']);

switch (sub) {
  case 'inventory': cmdInventory(args); break;
  case 'base-tree': cmdBaseTree(args); break;
  case 'plan-dir': cmdPlanDir(args._); break;
  case 'preflight': cmdPreflight(args); break;
  case 'resolve': cmdResolve(args); break;
  case 'merge': cmdMerge(args); break;
  case 'close': cmdClose(args); break;
  case 'status': {
    const result = setTrackerStatus(createTracker(repoRoot(), { repo: args.repo }), args._[0] ?? args.issue, args._[1], { dryRun: args.dryRun });
    if (!result.status) { console.error(`✗ 상태 전환 실패: ${result.err}`); process.exit(2); }
    if (!result.ok) console.log('STATUS_FAILED=1');
    break;
  }
  case 'cleanup': cmdCleanup(args); break;
  default:
    console.error(USAGE);
    process.exit(1);
}
