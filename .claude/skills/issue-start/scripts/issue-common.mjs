// !!! VENDORED FILE — DO NOT EDIT !!!
// canonical: tools/issue-common.mjs
// resync   : sh scripts/sync-shared.sh
/**
 * issue-common.mjs — issue-create / issue-start / issue-end / issue-merge 공용 모듈.
 *
 * 이 파일이 정본이다. 각 스킬의 scripts/ 아래 사본은 scripts/sync-shared.sh 가 만든다.
 * 사본을 직접 고치지 말고 이 파일을 고친 뒤 sync 를 다시 돌려라.
 *
 * 스킬은 폴더 단위로 독립 설치되므로 스킬 간 import 는 불가능하다.
 * 그래서 "정본 1벌 + 기계적 사본" 구조를 쓰고 scripts/check-shared.sh 로 드리프트를 막는다.
 *
 * 의존성 없음. Node 18+.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync, existsSync, readFileSync, writeFileSync, cpSync, readdirSync, rmSync,
} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

/* ------------------------------------------------------------------ 상수 */

/** 작업 폴더. `.issue-start` / `.issue-evidence` 를 통합한 결과다. */
export const WORKSPACE_DIR = '.issue';

/** 하위호환용 구 경로. 한 릴리스 동안만 읽기 폴백으로 인정한다. */
export const LEGACY_WORKSPACE_DIR = '.issue-start';
export const LEGACY_EVIDENCE_DIR = '.issue-evidence';

export const IGNORE_MARKER = '# issue-* workspace — evidence only stays committed so issue comments render';

/**
 * 검증된 .gitignore 블록. scripts/verify-ignore.sh 가 실제 저장소에서 확인한다.
 *
 * `.issue/` 뒤에 `!.issue/` 를 두는 순진한 형태는 동작하지 않는다.
 * .gitignore 는 마지막 매치가 이기므로 `!.issue/` 가 앞줄을 무효화해
 * plan.md·issue.json 이 전부 추적 대상이 되어버린다.
 * 그래서 git 문서의 정석 우회를 쓴다 — 디렉터리 전체를 무시한 뒤,
 * 한 단계씩 되살려 내려가며 마지막에 evidence 하위만 예외로 연다.
 */
export const IGNORE_BLOCK = [
  IGNORE_MARKER,
  `${WORKSPACE_DIR}/**`,
  `!${WORKSPACE_DIR}/*/`,
  `!${WORKSPACE_DIR}/*/evidence/`,
  `!${WORKSPACE_DIR}/*/evidence/**`,
  `${WORKSPACE_DIR}/**/.auth.json`,
  `${WORKSPACE_DIR}/**/storage-state.json`,
];

/** 라벨 → 브랜치 prefix 매핑 (우선순위 순) */
export const LABEL_PREFIX = [
  [/^(bug|fix)$/i, 'fix'],
  [/^(enhancement|feature|feat)$/i, 'feat'],
  [/^(documentation|docs)$/i, 'docs'],
  [/^(chore|maintenance)$/i, 'chore'],
];

export const WORKTREE_LAYOUTS = ['sibling', 'nested'];

/* ------------------------------------------------------------- 프로세스 */

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status ?? 1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

export function git(args, opts = {}) {
  return run('git', args, opts);
}

export function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

/** 실패하면 즉시 종료하고 stdout 을 돌려준다. */
export function must(cmd, args, opts = {}) {
  const r = run(cmd, args, opts);
  if (r.code !== 0) fail(`${cmd} ${args.join(' ')} 실패: ${r.err || r.out}`);
  return r.out;
}

export function parseArgs(argv, flags = ['push', 'json', 'dry-run', 'force']) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--') && flags.includes(a.slice(2))) out[a.slice(2)] = true;
    else if (a.startsWith('--')) {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    } else out._.push(a);
  }
  if (out['dry-run']) out.dryRun = true;
  return out;
}

/* ------------------------------------------------------------------- git */

export function repoRoot(cwd) {
  const r = git(['rev-parse', '--show-toplevel'], cwd ? { cwd } : {});
  if (r.code !== 0) fail('git 저장소가 아닙니다. 저장소 안에서 실행하세요.');
  return r.out;
}

export function currentBranch(cwd) {
  return git(['branch', '--show-current'], cwd ? { cwd } : {}).out || null;
}

/** 현재 체크아웃이 링크된 워크트리인지 판별 */
export function isLinkedWorktree(cwd) {
  const opts = cwd ? { cwd } : {};
  const gitDir = git(['rev-parse', '--absolute-git-dir'], opts).out;
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], opts).out;
  if (!gitDir || !commonDir) return false;
  return path.resolve(gitDir) !== path.resolve(commonDir);
}

export function detectRemote(root) {
  const list = git(['remote'], { cwd: root }).out.split('\n').filter(Boolean);
  return list.includes('origin') ? 'origin' : list[0] || 'origin';
}

/** 기본 브랜치 판별: origin/HEAD → main → master */
export function detectBase(root, remote = 'origin', explicit) {
  if (explicit) return String(explicit).replace(new RegExp(`^${remote}/`), '');
  const opts = root ? { cwd: root } : {};
  const head = git(['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`], opts).out;
  if (head) return head.replace(`refs/remotes/${remote}/`, '');
  for (const b of ['main', 'master']) {
    if (git(['show-ref', '--verify', '--quiet', `refs/remotes/${remote}/${b}`], opts).code === 0) return b;
  }
  return 'main';
}

export function branchExists(root, branch) {
  return git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root }).code === 0;
}

export function remoteBranchExists(root, remote, branch) {
  return git(['show-ref', '--verify', '--quiet', `refs/remotes/${remote}/${branch}`], { cwd: root }).code === 0;
}

export function existingWorktreeFor(root, branch) {
  const out = git(['worktree', 'list', '--porcelain'], { cwd: root }).out;
  let current = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) current = line.slice('worktree '.length).trim();
    else if (line.trim() === `branch refs/heads/${branch}`) return current;
  }
  return null;
}

export function listWorktrees(root) {
  return git(['worktree', 'list', '--porcelain'], { cwd: root }).out
    .split('\n\n')
    .map((block) => {
      const p = block.match(/^worktree (.+)$/m)?.[1];
      const br = block.match(/^branch (.+)$/m)?.[1]?.replace('refs/heads/', '');
      const head = block.match(/^HEAD (.+)$/m)?.[1] ?? null;
      if (!p) return null;
      return { path: p, branch: br ?? null, head, detached: /^detached$/m.test(block) };
    })
    .filter(Boolean);
}

/** gh 로 owner/name + private 여부. gh 실패 시 origin URL 파싱(이때 isPrivate 는 null). */
export function repoSlug(root) {
  const r = run('gh', ['repo', 'view', '--json', 'nameWithOwner,isPrivate,defaultBranchRef'], root ? { cwd: root } : {});
  if (r.code === 0) {
    try {
      return JSON.parse(r.out);
    } catch {
      /* fallthrough */
    }
  }
  const url = git(['remote', 'get-url', 'origin'], root ? { cwd: root } : {}).out;
  const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
  return m ? { nameWithOwner: `${m[1]}/${m[2]}`, isPrivate: null } : null;
}

/** 경로가 실제로 git 에게 무시되는지 확인. nested 워크트리 안전장치의 근거. */
export function isIgnored(root, relPath) {
  return git(['check-ignore', '-q', '--', relPath], { cwd: root }).code === 0;
}

/* --------------------------------------------------------------- 문자열 */

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function prefixFromLabels(labels = []) {
  for (const [re, prefix] of LABEL_PREFIX) {
    if (labels.some((l) => re.test(l))) return prefix;
  }
  return 'fix';
}

/** "59", "#59", 이슈 URL 에서 번호를 뽑는다. */
export function parseIssueNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  const url = s.match(/\/issues\/(\d+)/);
  if (url) return Number(url[1]);
  const m = s.match(/^#?(\d{1,6})$/);
  return m ? Number(m[1]) : null;
}

/**
 * 브랜치 이름에서 이슈 번호를 추론한다. (fix/59-foo → 59)
 *
 * 숫자 앞은 `/` 또는 `_` 또는 문자열 시작만 인정한다.
 * `-` 를 인정하면 `worktree-cc-20260726-044434-14199` 같은 타임스탬프 브랜치에서
 * 엉뚱한 숫자를 이슈 번호로 집어내고, 그대로 두면 없는 이슈에 코멘트하거나
 * 남의 이슈를 close 하는 사고로 이어진다.
 */
export function inferIssue(branch) {
  if (!branch) return null;
  const m = branch.match(/(?:^|[/_])(\d{1,6})(?:[-_/]|$)/);
  return m ? m[1] : null;
}

/** 이슈 번호가 없을 때도 안정적인 작업 키를 만든다. */
export function evidenceKey(args, branch) {
  const issue = args?.issue || inferIssue(branch);
  if (issue) return { key: String(issue), issue: String(issue) };
  const slug = (branch || 'detached').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return { key: `no-issue-${slug || 'work'}`, issue: null };
}

/* ------------------------------------------------------------------ 경로 */

export function workspaceDir() {
  return WORKSPACE_DIR;
}

/**
 * 이슈 작업 디렉터리. `.issue/<key>`
 * `.issue/<key>` 가 없고 구 `.issue-start/<key>` 만 있으면 후자를 돌려주고 1회 경고한다.
 */
let legacyWarned = false;
export function issueDir(root, key) {
  const next = path.resolve(root, WORKSPACE_DIR, String(key));
  if (existsSync(next)) return next;
  const legacy = path.resolve(root, LEGACY_WORKSPACE_DIR, String(key));
  if (existsSync(legacy)) {
    if (!legacyWarned) {
      legacyWarned = true;
      console.error(`! ${LEGACY_WORKSPACE_DIR}/ 는 폐기 예정입니다. \`node issue-start.mjs migrate\` 를 실행하세요.`);
    }
    return legacy;
  }
  return next;
}

/** 증거 디렉터리 절대경로. `.issue/<key>/evidence` */
export function evidenceDir(root, key) {
  return path.join(issueDir(root, key), 'evidence');
}

/** git 명령에 넘길 저장소 상대 증거 경로. */
export function evidenceRel(root, key) {
  return path.relative(root, evidenceDir(root, key)).split(path.sep).join('/');
}

export function listEvidence(root, key) {
  const base = evidenceDir(root, key);
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

/**
 * 프로젝트 .gitignore 에 `.issue` 블록을 보장한다.
 * 구 `.issue-start` 줄과 구 issue-end 예외 블록은 함께 정리한다.
 */
export function ensureIgnoreBlock(root) {
  const file = path.join(root, '.gitignore');
  let body = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (body.includes(IGNORE_MARKER)) return false;

  const legacy = new Set([
    LEGACY_WORKSPACE_DIR,
    `${LEGACY_WORKSPACE_DIR}/`,
    '# issue-end evidence (must stay committed so issue comments render)',
    `!${LEGACY_EVIDENCE_DIR}/`,
    `!${LEGACY_EVIDENCE_DIR}/**`,
  ]);
  const kept = body.split('\n').filter((line) => !legacy.has(line.trim()));
  body = kept.join('\n').replace(/\n{3,}$/, '\n\n');
  if (body && !body.endsWith('\n')) body += '\n';

  writeFileSync(file, `${body}\n${IGNORE_BLOCK.join('\n')}\n`, 'utf8');
  return true;
}

/* --------------------------------------------------------------- settings */

export const SETTINGS_DIR = path.join(os.homedir(), '.issue-plugin');
export const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');

export function readIssueSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * 기존 내용을 보존한 채 최상위 키만 병합한다.
 * gh-setup 이 같은 파일을 쓰므로 통째로 덮어쓰면 안 된다.
 */
export function writeIssueSettings(patch) {
  mkdirSync(SETTINGS_DIR, { recursive: true });
  const prev = readIssueSettings();
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

/** 미결정이면 null. 호출부가 AskUserQuestion 으로 1회만 물어야 한다. */
export function getWorktreeLayout() {
  const layout = readIssueSettings().worktree?.layout;
  return WORKTREE_LAYOUTS.includes(layout) ? layout : null;
}

export function setWorktreeLayout(layout) {
  if (!WORKTREE_LAYOUTS.includes(layout)) {
    fail(`알 수 없는 워크트리 배치: ${layout} (가능: ${WORKTREE_LAYOUTS.join(', ')})`);
  }
  const prev = readIssueSettings().worktree ?? {};
  return writeIssueSettings({ worktree: { ...prev, layout, decidedAt: new Date().toISOString() } });
}

export function getSubagentModel(flavor) {
  const configured = readIssueSettings().issue?.subagentModel ?? {};
  const defaults = { claude: 'haiku', codex: 'gpt-5.6-luna' };
  return configured[flavor] ?? defaults[flavor] ?? null;
}

/**
 * 워크트리 경로를 settings 에 따라 결정한다.
 *
 *   sibling : <repo 부모>/<repo>-issue-<번호>
 *   nested  : <repo>/.issue/worktrees/<번호>-<slug>
 *
 * layout 이 미결정이면 null 을 돌려준다. 호출부가 사용자에게 물어야 한다.
 */
export function resolveWorktreePath(root, number, slug, layout = getWorktreeLayout()) {
  if (!layout) return null;
  if (layout === 'nested') {
    const name = slug ? `${number}-${slugify(slug)}` : String(number);
    return path.join(root, WORKSPACE_DIR, 'worktrees', name);
  }
  return path.join(path.dirname(root), `${path.basename(root)}-issue-${number}`);
}

/* --------------------------------------------------------------- 증거 미러 */

/**
 * 기본 브랜치 사본에 증거 파일만 담은 커밋을 만든다.
 *
 * 사용자의 작업 트리를 건드리지 않으려고 임시 detached 워크트리에서 수행한다.
 * push 가 base 에서 거부되면 evidence/issue-<n> 브랜치로 폴백한다
 * (이 경우 이미지 URL 기준이 base 가 아니므로 호출부가 코멘트에 그 사실을 남겨야 한다).
 */
export function mirrorEvidence({ root, key, issue, push = false, base: explicitBase, extraFiles = [] }) {
  const files = [...new Set([...listEvidence(root, key), ...extraFiles])];
  if (files.length === 0) fail(`증거 파일이 없습니다: ${evidenceRel(root, key)}`);

  const base = detectBase(root, 'origin', explicitBase);
  git(['fetch', 'origin', base, '--prune'], { cwd: root });

  const tmp = path.join(os.tmpdir(), `issue-mirror-${key}-${process.pid}`);
  const tmpBranch = `issue-mirror/${key}`;
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
      const src = path.join(root, rel);
      if (!existsSync(src)) continue;
      const dest = path.join(tmp, rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      cpSync(src, dest);
    }
    ensureIgnoreBlock(tmp);
    git(['checkout', '-B', tmpBranch], { cwd: tmp });
    const a = git(['add', '-f', '--', evidenceRel(root, key), '.gitignore'], { cwd: tmp });
    if (a.code !== 0) throw new Error(`미러 add 실패: ${a.err}`);

    if (git(['diff', '--cached', '--quiet'], { cwd: tmp }).code !== 0) {
      const subject = issue
        ? `docs(issue-${issue}): 증거 자료 ${base} 반영`
        : `docs(evidence): ${key} 증거 자료 ${base} 반영`;
      const c = git(['commit', '-m', subject], { cwd: tmp });
      if (c.code !== 0) throw new Error(`미러 commit 실패: ${c.err || c.out}`);
    } else {
      result.noChange = true;
    }

    if (push) {
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
      result.mirrorRef = `${tmpBranch} (local only)`;
      result.localWorktree = tmp;
      result.cleanupHint = `git worktree remove --force ${tmp} && git branch -D ${tmpBranch}`;
    }
  } catch (e) {
    cleanup();
    fail(e.message);
  }

  return result;
}

/** 증거 파일들의 raw.githubusercontent URL 을 만든다. */
export function evidenceUrls({ root, key, issue, branch, mirrorRef, base }) {
  const repo = repoSlug(root);
  if (!repo?.nameWithOwner) fail('저장소 식별 실패. gh 로그인 상태 또는 origin 설정을 확인하세요.');
  const ref = mirrorRef || detectBase(root, 'origin', base);
  const files = listEvidence(root, key);
  if (files.length === 0) fail(`증거 파일이 없습니다: ${evidenceRel(root, key)}`);

  const raw = (r, p) => `https://raw.githubusercontent.com/${repo.nameWithOwner}/${r}/${p}`;
  return {
    repo: repo.nameWithOwner,
    isPrivate: repo.isPrivate,
    issue,
    branch,
    mirrorRef: ref,
    note: repo.isPrivate
      ? 'private 저장소는 raw URL 이 코멘트에서 렌더링되지 않습니다. 이미지를 웹 UI 로 직접 첨부하고 raw URL 은 보조 링크로만 남기세요.'
      : null,
    images: files.map((p) => ({
      path: p,
      phase: p.includes('/before/') ? 'before' : p.includes('/after/') ? 'after' : 'other',
      branchUrl: branch ? raw(branch, p) : null,
      mirrorUrl: raw(ref, p),
    })),
  };
}
