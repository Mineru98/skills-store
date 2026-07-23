#!/usr/bin/env node
/**
 * issue-end.mjs — 이슈 마무리 자동화(저장소 비종속).
 *
 * 서브커맨드
 *   context                     현재 상황 판단(워크트리 여부 / 브랜치 / 이슈 / PR)을 JSON 으로 출력
 *   init    [--issue <n>]       증거 디렉터리(before/after) 생성 + .gitignore 예외 보장
 *   commit  [--issue <n>]       현재 브랜치에 증거 파일을 강제 add 하고 커밋
 *   mirror  [--issue <n>]       기본 브랜치(main/master) 사본에 증거만 커밋. 실패 시 evidence 브랜치 폴백
 *   urls    [--issue <n>]       이슈 코멘트에 붙일 raw 이미지 URL(작업 브랜치 / 미러 기준) 출력
 *
 * 공통 옵션
 *   --issue <n>   이슈 번호. 생략 시 브랜치 이름에서 추론, 그래도 없으면 브랜치 slug 사용
 *   --dir <path>  증거 루트 (기본: .issue-evidence)
 *   --json        JSON 출력
 *
 * mirror 옵션
 *   --push        push 까지 수행(기본은 로컬 커밋만)
 *   --base <br>   기준 브랜치 고정 (기본: origin/HEAD 자동 판별)
 *
 * 요구사항: git, gh(로그인), Node 18+
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync, cpSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const DEFAULT_DIR = '.issue-evidence';
const IGNORE_MARKER = '# issue-end evidence (must stay committed so issue comments render)';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status ?? 1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

function git(args, opts = {}) {
  return run('git', args, opts);
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--push' || a === '--json' || a === '--dry-run') out[a.slice(2)] = true;
    else if (a.startsWith('--')) {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    } else out._.push(a);
  }
  return out;
}

function repoRoot() {
  const r = git(['rev-parse', '--show-toplevel']);
  if (r.code !== 0) fail('git 저장소가 아닙니다.');
  return r.out;
}

/** 현재 체크아웃이 링크된 워크트리인지 판별 */
function isLinkedWorktree() {
  const gitDir = git(['rev-parse', '--absolute-git-dir']).out;
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).out;
  if (!gitDir || !commonDir) return false;
  return path.resolve(gitDir) !== path.resolve(commonDir);
}

function currentBranch() {
  const r = git(['branch', '--show-current']);
  return r.out || null;
}

function defaultBranch(explicit) {
  if (explicit) return explicit.replace(/^origin\//, '');
  const head = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']).out;
  if (head) return head.replace('refs/remotes/origin/', '');
  for (const b of ['main', 'master']) {
    if (git(['show-ref', '--verify', `refs/remotes/origin/${b}`]).code === 0) return b;
  }
  return 'main';
}

function repoSlug() {
  const r = run('gh', ['repo', 'view', '--json', 'nameWithOwner,isPrivate,defaultBranchRef']);
  if (r.code === 0) {
    try {
      return JSON.parse(r.out);
    } catch {
      /* fallthrough */
    }
  }
  // gh 가 없거나 실패하면 origin URL 에서 owner/name 을 뽑는다. private 여부는 알 수 없다.
  const url = git(['remote', 'get-url', 'origin']).out;
  const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
  return m ? { nameWithOwner: `${m[1]}/${m[2]}`, isPrivate: null } : null;
}

function inferIssue(branch) {
  if (!branch) return null;
  const m = branch.match(/(?:^|[/_-])(\d{1,6})(?:[/_-]|$)/);
  return m ? m[1] : null;
}

/** 이슈 번호가 없을 때 쓰는 안정적인 키 */
function evidenceKey(args, branch) {
  const issue = args.issue || inferIssue(branch);
  if (issue) return { key: String(issue), issue: String(issue) };
  const slug = (branch || 'detached').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return { key: `no-issue-${slug || 'work'}`, issue: null };
}

function evidenceRoot(args) {
  return args.dir || DEFAULT_DIR;
}

/** 프로젝트 .gitignore 에 증거 디렉터리 예외 규칙을 보장 */
function ensureIgnoreException(root, dir) {
  const file = path.join(root, '.gitignore');
  const rules = [IGNORE_MARKER, `!${dir}/`, `!${dir}/**`];
  let body = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (body.includes(IGNORE_MARKER)) return false;
  if (body && !body.endsWith('\n')) body += '\n';
  writeFileSync(file, `${body}\n${rules.join('\n')}\n`, 'utf8');
  return true;
}

function listEvidence(root, dir, key) {
  const base = path.join(root, dir, key);
  const files = [];
  const walk = (p) => {
    if (!existsSync(p)) return;
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) walk(full);
      else files.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(base);
  return files.sort();
}

// ---------------------------------------------------------------- commands

function cmdContext(args) {
  const root = repoRoot();
  const branch = currentBranch();
  const linked = isLinkedWorktree();
  const base = defaultBranch(args.base);
  const { key, issue } = evidenceKey(args, branch);
  const repo = repoSlug();

  const ctx = {
    repoRoot: root,
    repo: repo?.nameWithOwner ?? null,
    isPrivate: repo?.isPrivate ?? null,
    isLinkedWorktree: linked,
    branch,
    baseBranch: base,
    onBaseBranch: branch === base,
    issue,
    issueSource: args.issue ? 'argument' : issue ? 'branch-name' : null,
    evidenceKey: key,
    evidenceDir: `${evidenceRoot(args)}/${key}`,
    dirty: git(['status', '--porcelain']).out.split('\n').filter(Boolean).length,
    ahead: null,
    upstream: git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).out || null,
    ghAuth: run('gh', ['auth', 'status']).code === 0,
    issueState: null,
    issueTitle: null,
    issueUrl: null,
    openPr: null,
    worktrees: git(['worktree', 'list', '--porcelain']).out
      .split('\n\n')
      .map((b) => {
        const p = b.match(/^worktree (.+)$/m)?.[1];
        const br = b.match(/^branch (.+)$/m)?.[1]?.replace('refs/heads/', '');
        return p ? { path: p, branch: br ?? null } : null;
      })
      .filter(Boolean),
  };

  if (ctx.upstream) {
    const c = git(['rev-list', '--count', `${ctx.upstream}..HEAD`]);
    ctx.ahead = c.code === 0 ? Number(c.out) : null;
  }

  if (ctx.ghAuth && issue) {
    const r = run('gh', ['issue', 'view', String(issue), '--json', 'number,title,state,url']);
    if (r.code === 0) {
      try {
        const j = JSON.parse(r.out);
        ctx.issueState = j.state;
        ctx.issueTitle = j.title;
        ctx.issueUrl = j.url;
      } catch {
        /* ignore */
      }
    }
  }

  if (ctx.ghAuth && branch) {
    const r = run('gh', ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,url,isDraft']);
    if (r.code === 0) {
      try {
        const list = JSON.parse(r.out);
        ctx.openPr = list[0] ?? null;
      } catch {
        /* ignore */
      }
    }
  }

  console.log(JSON.stringify(ctx, null, 2));
}

function cmdInit(args) {
  const root = repoRoot();
  const dir = evidenceRoot(args);
  const { key, issue } = evidenceKey(args, currentBranch());
  const before = path.join(root, dir, key, 'before');
  const after = path.join(root, dir, key, 'after');
  mkdirSync(before, { recursive: true });
  mkdirSync(after, { recursive: true });
  const touched = ensureIgnoreException(root, dir);
  console.log(JSON.stringify({ issue, evidenceKey: key, before, after, gitignoreUpdated: touched }, null, 2));
}

function cmdCommit(args) {
  const root = repoRoot();
  const dir = evidenceRoot(args);
  const { key, issue } = evidenceKey(args, currentBranch());
  const files = listEvidence(root, dir, key);
  if (files.length === 0) fail(`증거 파일이 없습니다: ${dir}/${key}`);

  ensureIgnoreException(root, dir);
  const add = git(['add', '-f', '--', `${dir}/${key}`, '.gitignore'], { cwd: root });
  if (add.code !== 0) fail(`git add 실패: ${add.err}`);

  if (git(['diff', '--cached', '--quiet'], { cwd: root }).code === 0) {
    console.log(JSON.stringify({ committed: false, reason: 'no staged change', files }, null, 2));
    return;
  }
  const subject = issue ? `docs(issue-${issue}): 작업 전후 증거 자료 추가` : `docs(evidence): ${key} 작업 전후 증거 자료 추가`;
  const c = git(['commit', '-m', subject], { cwd: root });
  if (c.code !== 0) fail(`git commit 실패: ${c.err || c.out}`);
  console.log(JSON.stringify({ committed: true, branch: currentBranch(), files }, null, 2));
}

function cmdMirror(args) {
  const root = repoRoot();
  const dir = evidenceRoot(args);
  const { key, issue } = evidenceKey(args, currentBranch());
  const files = listEvidence(root, dir, key);
  if (files.length === 0) fail(`증거 파일이 없습니다: ${dir}/${key}`);

  const base = defaultBranch(args.base);
  git(['fetch', 'origin', base, '--prune'], { cwd: root });

  const tmp = path.join(os.tmpdir(), `issue-end-mirror-${key}-${process.pid}`);
  const tmpBranch = `issue-end/mirror-${key}`;
  const result = { base, mirrorRef: null, pushed: false, fallback: false, files };

  const add = git(['worktree', 'add', '--detach', tmp, `origin/${base}`], { cwd: root });
  if (add.code !== 0) fail(`미러용 워크트리 생성 실패: ${add.err}`);

  const cleanup = () => {
    git(['worktree', 'remove', '--force', tmp], { cwd: root });
    git(['branch', '-D', tmpBranch], { cwd: root });
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  };

  try {
    for (const rel of files) {
      const dest = path.join(tmp, rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      cpSync(path.join(root, rel), dest);
    }
    ensureIgnoreException(tmp, dir);
    git(['checkout', '-B', tmpBranch], { cwd: tmp });
    const a = git(['add', '-f', '--', `${dir}/${key}`, '.gitignore'], { cwd: tmp });
    if (a.code !== 0) throw new Error(`미러 add 실패: ${a.err}`);

    if (git(['diff', '--cached', '--quiet'], { cwd: tmp }).code !== 0) {
      const subject = issue
        ? `docs(issue-${issue}): 증거 자료 ${base} 반영`
        : `docs(evidence): ${key} 증거 자료 ${base} 반영`;
      const c = git(['commit', '-m', subject], { cwd: tmp });
      if (c.code !== 0) throw new Error(`미러 commit 실패: ${c.err || c.out}`);
    }

    if (args.push) {
      const p = git(['push', 'origin', `HEAD:${base}`], { cwd: tmp });
      if (p.code === 0) {
        result.mirrorRef = base;
        result.pushed = true;
      } else {
        const evidenceBranch = issue ? `evidence/issue-${issue}` : `evidence/${key}`;
        const p2 = git(['push', '--force-with-lease', 'origin', `HEAD:${evidenceBranch}`], { cwd: tmp });
        if (p2.code !== 0) throw new Error(`${base} / ${evidenceBranch} 양쪽 push 실패:\n${p.err}\n${p2.err}`);
        result.mirrorRef = evidenceBranch;
        result.pushed = true;
        result.fallback = true;
        result.baseRejectReason = p.err;
      }
      cleanup();
    } else {
      // 로컬 커밋만 남기는 모드에서는 확인할 수 있게 임시 워크트리를 남긴다.
      result.mirrorRef = `${tmpBranch} (local only)`;
      result.localWorktree = tmp;
      result.cleanupHint = `git worktree remove --force ${tmp} && git branch -D ${tmpBranch}`;
    }
  } catch (e) {
    cleanup();
    fail(e.message);
  }

  console.log(JSON.stringify(result, null, 2));
}

function cmdUrls(args) {
  const root = repoRoot();
  const dir = evidenceRoot(args);
  const branch = currentBranch();
  const { key, issue } = evidenceKey(args, branch);
  const repo = repoSlug();
  if (!repo?.nameWithOwner) fail('gh repo view 실패. gh 로그인 상태를 확인하세요.');
  const base = defaultBranch(args.base);
  const mirrorRef = args.mirrorRef || base;
  const files = listEvidence(root, dir, key);
  if (files.length === 0) fail(`증거 파일이 없습니다: ${dir}/${key}`);

  const raw = (ref, p) => `https://raw.githubusercontent.com/${repo.nameWithOwner}/${ref}/${p}`;
  const out = {
    repo: repo.nameWithOwner,
    isPrivate: repo.isPrivate,
    issue,
    branch,
    mirrorRef,
    note: repo.isPrivate
      ? 'private 저장소는 raw URL 이 코멘트에서 렌더링되지 않습니다. 이미지를 웹 UI 로 직접 첨부하고 raw URL 은 보조 링크로만 남기세요.'
      : null,
    images: files.map((p) => ({
      path: p,
      phase: p.includes('/before/') ? 'before' : p.includes('/after/') ? 'after' : 'other',
      branchUrl: branch ? raw(branch, p) : null,
      mirrorUrl: raw(mirrorRef, p),
    })),
  };
  console.log(JSON.stringify(out, null, 2));
}

// ---------------------------------------------------------------- entry

const [, , sub, ...rest] = process.argv;
const args = parseArgs(rest);

switch (sub) {
  case 'context':
    cmdContext(args);
    break;
  case 'init':
    cmdInit(args);
    break;
  case 'commit':
    cmdCommit(args);
    break;
  case 'mirror':
    cmdMirror(args);
    break;
  case 'urls':
    cmdUrls(args);
    break;
  default:
    console.error(`Usage: node issue-end.mjs <context|init|commit|mirror|urls> [--issue <n>] [--dir <path>] [--push] [--base <branch>]`);
    process.exit(1);
}
