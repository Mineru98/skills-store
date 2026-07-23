#!/usr/bin/env node
/**
 * issue-start.mjs — GitHub 이슈 착수 자동화 (저장소 비종속).
 *
 * 두 단계로 나뉜다.
 *
 *   1) fetch  : gh 로 이슈 본문/코멘트/라벨/이미지를 내려받아
 *               <out>/<번호>/ 아래에 정리한다.
 *   2) worktree: 이슈 번호 + 영문 slug 로 브랜치와 워크트리를 만든다.
 *
 * 사용:
 *   node issue-start.mjs fetch 59
 *   node issue-start.mjs worktree 59 --slug fab-tab-active-state
 *   node issue-start.mjs worktree 59 --slug ... --prefix feat --dry-run
 *
 * 규칙:
 *   - 워크트리 경로는 repo 루트의 형제 디렉터리 <repo>-issue-<번호>
 *   - 기본 브랜치는 origin/HEAD 로 자동 판별(없으면 main → master)
 *   - 이미 존재하는 브랜치/워크트리는 재사용(멱등)
 *
 * 요구사항: git, gh(로그인 상태), curl, Node 18+
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, renameSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_OUT = '.issue-start';

/** 라벨 → 브랜치 prefix 매핑 (우선순위 순) */
const LABEL_PREFIX = [
  [/^(bug|fix)$/i, 'fix'],
  [/^(enhancement|feature|feat)$/i, 'feat'],
  [/^(documentation|docs)$/i, 'docs'],
  [/^(chore|maintenance)$/i, 'chore'],
];

function usage(exitCode = 1) {
  console.error(`Usage:
  node issue-start.mjs fetch <issue-number> [--out <dir>] [--repo <owner/name>]
  node issue-start.mjs worktree <issue-number> [options]

fetch:
  이슈 본문·코멘트·라벨을 <out>/<번호>/issue.json / issue.md 로 저장하고
  본문에 포함된 이미지를 <out>/<번호>/images/ 로 내려받는다.
  마지막 줄에 분석용 파일 경로 목록을 출력한다.

common options:
  --out <dir>      산출물 디렉터리 (기본: ${DEFAULT_OUT})
  --repo <o/n>     대상 저장소 (기본: 현재 디렉터리의 origin)

worktree options:
  --slug <slug>    브랜치 영문 slug (예: fab-tab-active-state). 생략 시 issue-<번호>
  --prefix <p>     브랜치 prefix (fix|feat|docs|chore|refactor). 생략 시 라벨로 추론
  --branch <name>  브랜치 이름 전체를 직접 지정 (--slug/--prefix 무시)
  --base <branch>  분기 기준 브랜치 (기본: origin/HEAD 자동 판별)
  --path <dir>     워크트리 경로 직접 지정
  --dry-run        실행 계획만 출력
  -h, --help       이 도움말
`);
  process.exit(exitCode);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (res.error) throw res.error;
  return res;
}

function must(cmd, args, opts = {}) {
  const res = run(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts });
  if (res.status !== 0) {
    console.error(`✗ 실패: ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
  return (res.stdout ?? '').trim();
}

function repoRoot() {
  const res = run('git', ['rev-parse', '--show-toplevel']);
  if (res.status !== 0) {
    console.error('✗ git 저장소가 아니다. 저장소 안에서 실행하라.');
    process.exit(1);
  }
  return res.stdout.trim();
}

function detectRemote(root) {
  const out = run('git', ['remote'], { cwd: root }).stdout?.trim().split('\n').filter(Boolean) ?? [];
  return out.includes('origin') ? 'origin' : out[0] || 'origin';
}

function detectBase(root, remote) {
  const head = run('git', ['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`], { cwd: root });
  if (head.status === 0) return head.stdout.trim().replace(`refs/remotes/${remote}/`, '');
  for (const candidate of ['main', 'master']) {
    if (
      run('git', ['show-ref', '--verify', '--quiet', `refs/remotes/${remote}/${candidate}`], { cwd: root })
        .status === 0
    ) {
      return candidate;
    }
  }
  return 'main';
}

function parseIssueNumber(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ fetch */

const IMAGE_RE = [
  /!\[[^\]]*\]\(([^)\s]+)/g, // ![alt](url)
  /<img[^>]+src=["']([^"']+)["']/gi, // <img src="url">
];

export function collectImageUrls(text) {
  const urls = [];
  for (const re of IMAGE_RE) {
    for (const m of String(text ?? '').matchAll(re)) {
      const url = m[1];
      if (/^https?:\/\//.test(url)) urls.push(url);
    }
  }
  return [...new Set(urls)];
}

const EXT_BY_TYPE = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

export function downloadImage(url, dir, index, token) {
  const stem = path.join(dir, `image-${String(index).padStart(2, '0')}`);
  const tmp = `${stem}.download`;
  // curl 은 호스트가 바뀌는 리다이렉트에서 Authorization 헤더를 자동으로 제거한다.
  // (GitHub user-attachments → S3 서명 URL 패턴에 필요)
  const args = ['-sSL', '--max-time', '60', '-o', tmp, '-w', '%{content_type}'];
  if (token) args.push('-H', `Authorization: Bearer ${token}`);
  args.push(url);
  const res = run('curl', args);
  if (res.status !== 0) {
    if (existsSync(tmp)) rmSync(tmp);
    return { url, ok: false, reason: (res.stderr || '').trim() || `curl exit ${res.status}` };
  }
  const contentType = (res.stdout || '').split(';')[0].trim();
  const ext =
    EXT_BY_TYPE[contentType] ??
    (path.extname(new URL(url).pathname).match(/^\.(png|jpe?g|gif|webp|svg)$/i)?.[0] || '.png');
  const target = `${stem}${ext}`;
  if (existsSync(target)) rmSync(target);
  renameSync(tmp, target);
  if (!contentType.startsWith('image/')) {
    return { url, ok: false, path: target, reason: `이미지가 아님 (content-type: ${contentType || 'unknown'})` };
  }
  return { url, ok: true, path: target };
}

function issueDir(root, out, number) {
  return path.resolve(root, out, String(number));
}

function cmdFetch(number, root, opts) {
  const fields = [
    'number', 'title', 'state', 'body', 'labels', 'assignees',
    'milestone', 'comments', 'url', 'createdAt', 'updatedAt',
  ].join(',');
  const args = ['issue', 'view', String(number), '--json', fields];
  if (opts.repo) args.push('--repo', opts.repo);
  const issue = JSON.parse(must('gh', args, { cwd: root }));

  const dir = issueDir(root, opts.out, number);
  const imagesDir = path.join(dir, 'images');
  mkdirSync(imagesDir, { recursive: true });

  writeFileSync(path.join(dir, 'issue.json'), `${JSON.stringify(issue, null, 2)}\n`);

  const labels = (issue.labels ?? []).map((l) => l.name);
  const md = [
    `# #${issue.number} ${issue.title}`,
    '',
    `- 상태: ${issue.state}`,
    `- URL: ${issue.url}`,
    `- 라벨: ${labels.join(', ') || '(없음)'}`,
    `- 담당: ${(issue.assignees ?? []).map((a) => a.login).join(', ') || '(없음)'}`,
    `- 마일스톤: ${issue.milestone?.title ?? '(없음)'}`,
    '',
    '## 본문',
    '',
    issue.body?.trim() || '(본문 없음)',
    '',
  ];
  for (const c of issue.comments ?? []) {
    md.push(`## 코멘트 — ${c.author?.login ?? 'unknown'} (${c.createdAt ?? ''})`, '', c.body ?? '', '');
  }
  writeFileSync(path.join(dir, 'issue.md'), `${md.join('\n')}\n`);

  const token = run('gh', ['auth', 'token']).stdout?.trim();
  const urls = collectImageUrls([issue.body, ...(issue.comments ?? []).map((c) => c.body)].join('\n'));
  const downloads = urls.map((url, i) => downloadImage(url, imagesDir, i + 1, token));

  // 저장소 밖(--out 이 절대경로 등)이면 절대경로를 그대로 보여준다.
  const rel = (p) => {
    const r = path.relative(root, p);
    return r.startsWith('..') ? p : r;
  };
  console.log(`✓ 이슈 #${number} 수집 완료 — ${issue.title}`);
  console.log(`  라벨: ${labels.join(', ') || '(없음)'} / 상태: ${issue.state}`);
  console.log(`  본문: ${rel(path.join(dir, 'issue.md'))}`);
  if (!urls.length) console.log('  이미지: 없음');
  for (const d of downloads) {
    if (d.ok) console.log(`  이미지: ${rel(d.path)}  ← ${d.url}`);
    else console.log(`  이미지 실패: ${d.url} (${d.reason})`);
  }
  console.log('');
  console.log(`SUGGESTED_PREFIX=${prefixFromLabels(labels)}`);
  console.log(`ISSUE_DIR=${rel(dir)}`);
  console.log(`IMAGE_FILES=${downloads.filter((d) => d.ok).map((d) => rel(d.path)).join(' ')}`);
}

/* --------------------------------------------------------------- worktree */

function prefixFromLabels(labels) {
  for (const [re, prefix] of LABEL_PREFIX) {
    if (labels.some((l) => re.test(l))) return prefix;
  }
  return 'fix';
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function branchExists(root, branch) {
  return run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root }).status === 0;
}

function remoteBranchExists(root, remote, branch) {
  return (
    run('git', ['show-ref', '--verify', '--quiet', `refs/remotes/${remote}/${branch}`], { cwd: root })
      .status === 0
  );
}

function existingWorktreeFor(root, branch) {
  const out = run('git', ['worktree', 'list', '--porcelain'], { cwd: root }).stdout ?? '';
  let current = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) current = line.slice('worktree '.length).trim();
    else if (line.trim() === `branch refs/heads/${branch}`) return current;
  }
  return null;
}

function cmdWorktree(number, root, opts) {
  const remote = detectRemote(root);
  const base = opts.base || detectBase(root, remote);

  const issueJson = path.join(issueDir(root, opts.out, number), 'issue.json');
  let labels = [];
  if (existsSync(issueJson)) {
    try {
      labels = (JSON.parse(readFileSync(issueJson, 'utf8')).labels ?? []).map((l) => l.name);
    } catch {
      labels = [];
    }
  }

  const branch =
    opts.branch ||
    `${opts.prefix || prefixFromLabels(labels)}/${number}-${slugify(opts.slug || `issue-${number}`)}`;
  const wtPath = opts.path
    ? path.resolve(opts.path)
    : path.join(path.dirname(root), `${path.basename(root)}-issue-${number}`);

  const existing = existingWorktreeFor(root, branch);
  console.log(
    [
      `  브랜치 : ${branch}${branchExists(root, branch) ? ' (기존 재사용)' : ` (신규, ${remote}/${base} 기준)`}`,
      `  워크트리: ${wtPath}${existing ? ` (이미 ${existing} 에 연결됨)` : ''}`,
    ].join('\n'),
  );

  if (opts.dryRun) {
    console.log('\n(dry-run) 아무것도 생성하지 않았다.');
    return;
  }

  if (existing) {
    console.log(`\n✓ 이미 워크트리가 있다: ${existing}`);
    console.log(`WORKTREE_PATH=${existing}`);
    console.log(`BRANCH=${branch}`);
    return;
  }
  if (existsSync(wtPath)) {
    console.error(`✗ 경로가 이미 존재한다: ${wtPath} — --path 로 다른 경로를 지정하라.`);
    process.exit(1);
  }

  must('git', ['fetch', remote, base, '--prune'], { cwd: root });

  const addOpts = { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] };
  if (branchExists(root, branch)) {
    must('git', ['worktree', 'add', wtPath, branch], addOpts);
  } else if (remoteBranchExists(root, remote, branch)) {
    must('git', ['worktree', 'add', '--track', '-b', branch, wtPath, `${remote}/${branch}`], addOpts);
  } else {
    must('git', ['worktree', 'add', '-b', branch, wtPath, `${remote}/${base}`], addOpts);
  }

  console.log('\n✓ 워크트리 준비 완료');
  console.log(`WORKTREE_PATH=${wtPath}`);
  console.log(`BRANCH=${branch}`);
}

/* ------------------------------------------------------------------- main */

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('-h') || argv.includes('--help')) usage(argv.length ? 0 : 1);

  const mode = argv[0];
  if (!['fetch', 'worktree'].includes(mode)) {
    console.error(`✗ 알 수 없는 모드: ${mode}`);
    usage();
  }

  const opts = { dryRun: false, out: DEFAULT_OUT };
  let number = null;
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--slug') opts.slug = argv[++i];
    else if (arg === '--prefix') opts.prefix = argv[++i];
    else if (arg === '--branch') opts.branch = argv[++i];
    else if (arg === '--base') opts.base = argv[++i];
    else if (arg === '--path') opts.path = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--repo') opts.repo = argv[++i];
    else if (arg.startsWith('-')) {
      console.error(`✗ 알 수 없는 옵션: ${arg}`);
      usage();
    } else number = parseIssueNumber(arg);
  }

  if (!number) {
    console.error('✗ 이슈 번호가 필요하다 (예: 59, #59, 이슈 URL)');
    usage();
  }

  const root = repoRoot();
  if (mode === 'fetch') cmdFetch(number, root, opts);
  else cmdWorktree(number, root, opts);
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) main();
