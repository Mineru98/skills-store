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
  mkdirSync, existsSync, readFileSync, writeFileSync, cpSync, readdirSync, rmSync, realpathSync,
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

/** 성격 라벨의 색·설명 프리셋. ensureLabel 이 만들 때 쓴다. */
export const STANDARD_LABELS = {
  bug: { color: 'd73a4a', description: "Something isn't working" },
  enhancement: { color: 'a2eeef', description: 'New feature or request' },
  documentation: { color: '0075ca', description: 'Improvements or additions to documentation' },
  chore: { color: 'cfd3d7', description: 'Maintenance and cleanup' },
};

/**
 * 진행 상태 라벨. 파이프라인 순서대로.
 *
 * 성격 라벨(bug 등)과 축이 다르다. 한 이슈에 성격 라벨 하나 + status 하나가 공존하고,
 * status 끼리는 상호배타다 — 전환은 항상 "기존 status 전부 제거 + 새 것 하나 추가".
 */
export const STATUS_ORDER = [
  'status:open',
  'status:plan',
  'status:in-process',
  'status:review',
  'status:close',
];

export const STATUS_LABELS = {
  'status:open': { color: 'ededed', description: '등록됨 — 아직 착수 전' },
  'status:plan': { color: 'fbca04', description: 'issue-start 가 분석·계획 중' },
  'status:in-process': { color: '0e8a16', description: '워크트리에서 구현 중' },
  'status:review': { color: '5319e7', description: 'PR 이 열려 리뷰·merge 대기 중' },
  'status:close': { color: '6a737d', description: 'merge 되어 종료됨' },
};

/**
 * 워크트리 배치.
 *
 *   sibling  : 저장소 폴더 옆에 나란히      <repo 부모>/<repo>-issue-<번호>
 *   children : 저장소 폴더 안에 모여서      <repo>/.issue/worktrees/<번호>-<slug>
 *
 * 예전 이름 `nested` 는 더 쓰지 않는다. 화이트리스트에 없으므로 `getWorktreeLayout()` 이
 * null 을 돌려주고, 스킬이 배치를 한 번 더 묻는다.
 */
export const WORKTREE_LAYOUTS = ['sibling', 'children'];

/** 프로젝트 단위 설정 파일. `.issue/settings.json` — 기존 `.issue/**` 무시 규칙에 그대로 걸린다. */
export const PROJECT_SETTINGS_FILE = 'settings.json';
export const PROJECT_SETTINGS_REL = `${WORKSPACE_DIR}/${PROJECT_SETTINGS_FILE}`;

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

/**
 * 현재 프로세스를 소유한 VS Code 통합 터미널의 제목을 바꾼다.
 *
 * 활성 터미널을 찾는 명령 대신 현재 TTY에 OSC를 쓰므로 다른 세션은 건드리지 않는다.
 * tmux 안에서도 TERM_PROGRAM과 출력 스트림이 상속되므로 현재 pane을 통해 전달된다.
 * 터미널 이름 변경은 보조 기능이므로 미지원 환경이나 쓰기 실패를 호출부에 전파하지 않는다.
 */
export function setTerminalTitle(title, { env = process.env, stream = process.stdout } = {}) {
  if (env.TERM_PROGRAM !== 'vscode' || !stream?.isTTY) return false;

  const safeTitle = String(title).replace(/[\x00-\x1f\x7f-\x9f]+/g, ' ').trim();
  if (!safeTitle) return false;

  try {
    stream.write(`\x1b]2;${safeTitle}\x07`);
    return true;
  } catch {
    return false;
  }
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

/**
 * 기본 브랜치 판별. main 인지 master 인지를 매번 다시 알아내지 않게 한다.
 *
 *   1. explicit 인자                                    이번 실행만
 *   2. <repo>/.issue/settings.json  git.baseBranch      프로젝트 기록 — 있으면 여기서 끝
 *   3. origin/HEAD → main → master                      실제 저장소에서 판별
 *   4. ~/.issue-plugin/settings.json  git.defaultBaseBranch   사용자 습관, 최후 폴백
 *
 * 3 으로 알아낸 값은 2 에 적어 둔다. 다음 실행부터는 판별 비용이 사라진다.
 * 저장소 상태가 사용자 습관보다 우선이므로 4 는 3 이 아무것도 못 찾을 때만 쓴다.
 */
export function detectBase(root, remote = 'origin', explicit) {
  if (explicit) return String(explicit).replace(new RegExp(`^${remote}/`), '');

  const recorded = readProjectSettings(root).git?.baseBranch;
  if (recorded) return recorded;

  const opts = root ? { cwd: root } : {};
  let detected = null;
  const head = git(['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`], opts).out;
  if (head) detected = head.replace(`refs/remotes/${remote}/`, '');
  else {
    for (const b of ['main', 'master']) {
      if (git(['show-ref', '--verify', '--quiet', `refs/remotes/${remote}/${b}`], opts).code === 0) {
        detected = b;
        break;
      }
    }
  }

  if (detected) {
    recordBaseBranch(root, detected);
    return detected;
  }
  return getDefaultBaseBranch() ?? 'main';
}

/**
 * 판별한 기본 브랜치를 프로젝트 설정에 남긴다.
 *
 * detectBase 는 읽기처럼 보이는 함수이므로 여기서 `.gitignore` 를 건드리지 않는다.
 * `.issue/settings.json` 이 아직 무시 대상이 아니면 조용히 넘어가고,
 * `issue-create` 가 `ensureIgnoreBlock` 을 돌린 뒤 다음 호출에서 기록된다.
 */
function recordBaseBranch(root, branch) {
  if (!root) return;
  const prev = readProjectSettings(root).git ?? {};
  if (prev.baseBranch === branch) return;
  writeProjectSettings(
    root,
    { git: { ...prev, baseBranch: branch, detectedAt: new Date().toISOString() } },
    { ensureIgnored: false },
  );
}

/** 주 체크아웃 경로. `git worktree list` 의 첫 항목이 항상 주 체크아웃이다. */
export function mainCheckout(root) {
  return listWorktrees(root)[0]?.path ?? null;
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

/** origin URL만으로 owner/name을 뽑는다. private 여부는 gitHost가 보강한다. */
export function repoSlugFromRemote(root) {
  const url = git(['remote', 'get-url', 'origin'], root ? { cwd: root } : {}).out;
  const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
  return m ? { nameWithOwner: `${m[1]}/${m[2]}`, isPrivate: null } : null;
}

/** 하위호환용 이름. 호스트 CLI를 직접 부르지 않는다. */
export function repoSlug(root) {
  return repoSlugFromRemote(root);
}

/** 경로가 실제로 git 에게 무시되는지 확인. children 워크트리 안전장치의 근거. */
export function isIgnored(root, relPath) {
  return git(['check-ignore', '-q', '--', relPath], { cwd: root }).code === 0;
}

/* ------------------------------------------------------------------ 표시 */

/** 저장소 웹 주소. slug 를 못 알아내면 null. */
export function repoWebUrl(root) {
  const slug = repoSlug(root)?.nameWithOwner;
  return slug ? `https://github.com/${slug}` : null;
}

export function issueUrl(root, number) {
  const base = repoWebUrl(root);
  return base ? `${base}/issues/${number}` : null;
}

export function prUrl(root, number) {
  const base = repoWebUrl(root);
  return base ? `${base}/pull/${number}` : null;
}

/** 마크다운 링크. url 이 없으면 설명만 남긴다 — 깨진 링크를 만들지 않는다. */
export function mdLink(text, url) {
  return url ? `[${text}](${url})` : String(text);
}

/**
 * 워크트리 경로가 저장소 안에 있는지 밖에 있는지를 실제 경로로 판별한다.
 *
 * 설정값(`worktree.layout`)이 아니라 경로를 믿는다. 설정은 새로 만들 때만 쓰이고,
 * 이미 있는 워크트리는 그때의 설정으로 만들어졌을 수 있다.
 */
export function detectLayoutFromPath(root, wtPath) {
  const rel = path.relative(canonical(root), canonical(wtPath));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? 'children' : 'sibling';
}

/**
 * 심볼릭 링크를 푼 절대 경로.
 *
 * macOS 의 `/tmp` → `/private/tmp` 처럼 같은 폴더가 두 이름을 갖는 경우가 있다.
 * 한쪽만 풀린 상태로 비교하면 저장소 안에 있는 워크트리를 바깥이라고 판정한다.
 */
function canonical(p) {
  const abs = path.resolve(p);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

/**
 * 터미널에서 `ctrl+클릭` 으로 열리는 형태의 워크트리 경로를 만든다.
 *
 *   children  저장소 안  → 상대 경로   .issue/worktrees/59-tab-active-state
 *   sibling   저장소 밖  → 절대 경로   /Users/me/work/repo-issue-59
 *
 * sibling 을 상대 경로로 적으면 `../` 가 붙어 없는 경로로 열린다. 그래서 절대 경로를 쓴다.
 */
export function worktreeDisplayPath(root, wtPath) {
  const anchor = mainCheckout(root) ?? root;
  const abs = canonical(wtPath);
  if (detectLayoutFromPath(anchor, abs) === 'sibling') return abs;
  return path.relative(canonical(anchor), abs).split(path.sep).join('/');
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
  // status 라벨은 브랜치 prefix 결정에 관여하지 않는다. 두 축은 직교다.
  const types = typeLabels(labels);
  for (const [re, prefix] of LABEL_PREFIX) {
    if (types.some((l) => re.test(l))) return prefix;
  }
  return 'fix';
}

/* ----------------------------------------------------------------- 라벨 */

export function isStatusLabel(name) {
  return /^status:/i.test(String(name ?? ''));
}

/** status 를 걸러낸 성격 라벨만 남긴다. */
export function typeLabels(labels = []) {
  return labels.filter((l) => !isStatusLabel(l));
}

/** "plan", "status:plan", "STATUS:PLAN" 을 모두 정규 이름으로 바꾼다. 모르면 null. */
export function resolveStatus(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  const full = s.startsWith('status:') ? s : `status:${s}`;
  return STATUS_ORDER.includes(full) ? full : null;
}

/** "59", "#59", GitHub 이슈 URL, Jira 키("ACME-59")에서 번호를 뽑는다. */
export function parseIssueNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  const url = s.match(/\/issues\/(\d+)/);
  if (url) return Number(url[1]);
  const m = s.match(/^#?(\d{1,6})$/);
  if (m) return Number(m[1]);
  const jira = s.match(/^[A-Za-z][A-Za-z0-9_]*-(\d{1,6})$/);
  return jira ? Number(jira[1]) : null;
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

/** 사용자 환경 설정의 정본. 기존 ~/.issue-plugin 은 한 번만 읽어 이곳으로 복사한다. */
export const SETTINGS_DIR = path.join(os.homedir(), '.issue');
export const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');
export const LEGACY_SETTINGS_PATH = path.join(os.homedir(), '.issue-plugin', 'settings.json');

export function readIssueSettings() {
  if (!existsSync(SETTINGS_PATH) && existsSync(LEGACY_SETTINGS_PATH)) {
    try {
      mkdirSync(SETTINGS_DIR, { recursive: true });
      cpSync(LEGACY_SETTINGS_PATH, SETTINGS_PATH);
      console.error(`! 기존 설정을 ${SETTINGS_PATH} 로 한 번 옮겼습니다.`);
    } catch {
      return {};
    }
  }
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

/* ------------------------------------------------------- 프로젝트 settings */

/**
 * 저장소별 설정. `<repo>/.issue/settings.json`
 *
 * 홈 설정(`~/.issue-plugin/settings.json`)은 "사용자가 보통 어떻게 하는가"를 담고,
 * 이 파일은 "이 저장소에서는 실제로 무엇을 쓰는가"를 담는다. 저장소 쪽이 우선이다.
 */
export function projectSettingsPath(root) {
  return path.join(root, WORKSPACE_DIR, PROJECT_SETTINGS_FILE);
}

export function readProjectSettings(root) {
  if (!root) return {};
  const file = projectSettingsPath(root);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * 최상위 키만 병합해 저장한다.
 *
 * `.issue/settings.json` 이 실제로 무시되는지 확인한 뒤에만 쓴다.
 * 무시되지 않는 상태에서 쓰면 사용자의 커밋에 설정 파일이 딸려 들어간다.
 *
 * ensureIgnored: false 면 `.gitignore` 를 건드리지 않고, 이미 무시 중일 때만 기록한다.
 */
export function writeProjectSettings(root, patch, { ensureIgnored = true } = {}) {
  if (!root) return null;
  if (!isIgnored(root, PROJECT_SETTINGS_REL)) {
    if (!ensureIgnored) return null;
    ensureIgnoreBlock(root);
    if (!isIgnored(root, PROJECT_SETTINGS_REL)) {
      console.error(`! ${PROJECT_SETTINGS_REL} 이 .gitignore 에 걸리지 않아 설정을 기록하지 않습니다.`);
      return null;
    }
  }
  mkdirSync(path.dirname(projectSettingsPath(root)), { recursive: true });
  const next = { ...readProjectSettings(root), ...patch, updatedAt: new Date().toISOString() };
  writeFileSync(projectSettingsPath(root), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

/** 사용자가 보통 쓰는 기본 브랜치. 미결정이면 null — 호출부가 1회만 물어야 한다. */
export function getDefaultBaseBranch() {
  const branch = readIssueSettings().git?.defaultBaseBranch;
  return typeof branch === 'string' && branch ? branch : null;
}

export function setDefaultBaseBranch(branch) {
  if (!branch || typeof branch !== 'string') fail(`기본 브랜치 이름이 필요하다: ${branch}`);
  const prev = readIssueSettings().git ?? {};
  return writeIssueSettings({ git: { ...prev, defaultBaseBranch: branch, decidedAt: new Date().toISOString() } });
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
 *   sibling  : <repo 부모>/<repo>-issue-<번호>
 *   children : <repo>/.issue/worktrees/<번호>-<slug>
 *
 * layout 이 미결정이면 null 을 돌려준다. 호출부가 사용자에게 물어야 한다.
 */
export function resolveWorktreePath(root, number, slug, layout = getWorktreeLayout()) {
  // 모르는 값(예: 폐기된 `nested`)은 조용히 sibling 으로 떨어뜨리지 않는다.
  // 사용자가 기대한 위치와 다른 곳에 워크트리가 생기는 것이 더 나쁘다.
  if (!WORKTREE_LAYOUTS.includes(layout)) return null;
  if (layout === 'children') {
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

/* ----------------------------------------------------------- 기본 브랜치 동기화 */

/**
 * 증거 미러 push 뒤에 주 체크아웃의 기본 브랜치를 최신으로 맞춘다.
 *
 * 미러는 임시 워크트리에서 `origin/<base>` 로 곧장 push 하므로 사용자의 주 체크아웃은
 * 그 커밋을 모른 채 남는다. 이슈를 여러 번 돌리면 로컬이 몇 커밋씩 뒤처지고,
 * 그 사이 로컬 커밋이 하나라도 생기면 갈라져서 나중에 pull 이 실패한다.
 *
 * 이 함수는 안전한 경우에만 pull 한다. 위험한 판단은 전부 호출부(사람)에게 넘긴다.
 *   - 브랜치를 갈아타지 않는다
 *   - stash 를 자동으로 하지 않는다
 *   - 실패하면 rebase 를 중단해 원래 상태로 되돌린다
 *
 * skipped 값: 'no-main-checkout' | 'other-branch' | 'dirty' | 'conflict' | 'error'
 */
/**
 * 받아오기를 막는 파일들을 찾는다.
 *
 * `git pull --rebase` 는 두 경우에 거부한다.
 *   - 추적 중인 파일이 수정돼 있다
 *   - 추적하지 않는 파일이 있는데 받아올 커밋이 같은 경로를 덮어쓴다
 *
 * 그런데 이 스킬군은 스스로 그 상태를 만든다. `.gitignore` 에 `.issue` 블록을 넣고,
 * 증거를 `.issue/<n>/evidence/` 에 쌓은 뒤, 바로 그 둘을 미러 커밋으로 올리기 때문이다.
 * 그래서 첫 실행부터 "저장 안 된 변경이 있다"로 막히는데, 실제로는 받아올 내용과 같은 파일이다.
 *
 * 내용이 같으면 `resolvable` 로 표시한다. 호출부가 치우고 받아오면 결과가 동일하다.
 * 한 글자라도 다르면 사용자의 작업이므로 손대지 않는다.
 */
function blockingPaths(target, base) {
  const status = git(['status', '--porcelain', '--untracked-files=all'], { cwd: target }).out;
  if (!status) return [];

  const incoming = new Set(
    git(['diff', '--name-only', `HEAD...origin/${base}`], { cwd: target }).out.split('\n').filter(Boolean),
  );

  const out = [];
  for (const line of status.split('\n')) {
    if (!line) continue;
    // `run()` 이 stdout 을 trim 하므로 첫 줄의 선행 공백이 사라진다.
    // 고정 컬럼(slice(3))으로 자르면 첫 줄만 경로가 한 글자씩 밀린다.
    const m = line.match(/^([ MADRCU?!]{1,2})\s+(.+)$/);
    if (!m) continue;
    const [, code, rel] = m;
    const untracked = code.trim() === '??';
    // 추적하지 않는 파일은 받아올 커밋이 같은 경로를 건드릴 때만 막는다.
    if (untracked && !incoming.has(rel)) continue;
    out.push({ path: rel, tracked: !untracked, resolvable: sameAsIncoming(target, base, rel) });
  }
  return out;
}

/** 로컬 파일 내용이 받아올 커밋의 내용과 같은가. */
function sameAsIncoming(target, base, rel) {
  const theirs = git(['rev-parse', `origin/${base}:${rel}`], { cwd: target });
  if (theirs.code !== 0) return false;
  const full = path.join(target, rel);
  if (!existsSync(full)) return false;
  const ours = git(['hash-object', '--', full], { cwd: target });
  return ours.code === 0 && ours.out === theirs.out;
}

export function syncBaseCheckout({ root, base: explicitBase } = {}) {
  const base = detectBase(root, 'origin', explicitBase);
  const result = {
    ok: false, base, path: null, branch: null, skipped: null, reason: null, received: 0,
  };

  const target = mainCheckout(root);
  if (!target) {
    result.skipped = 'no-main-checkout';
    result.reason = '주 체크아웃을 찾지 못했습니다.';
    return result;
  }
  result.path = target;

  const branch = currentBranch(target);
  result.branch = branch;
  if (branch !== base) {
    result.skipped = 'other-branch';
    result.reason = `주 체크아웃이 ${branch ?? '이름 없는 상태'} 에 있어 ${base} 를 받아오지 않았습니다.`;
    return result;
  }

  git(['fetch', 'origin', base, '--prune'], { cwd: target });

  const blocking = blockingPaths(target, base);
  const unresolvable = blocking.filter((p) => !p.resolvable);
  if (unresolvable.length) {
    result.skipped = 'dirty';
    result.reason = '주 체크아웃에 저장하지 않은 변경이 있습니다.';
    result.dirtyPaths = unresolvable.map((p) => p.path);
    return result;
  }

  // 여기 남은 것은 받아올 내용과 글자 하나까지 같은 파일들이다.
  // 미러 커밋이 `.gitignore` 와 증거를 담고 있어서, 이걸 치우지 않으면 받아오기가 거부된다.
  for (const p of blocking) {
    if (p.tracked) git(['checkout', '--', p.path], { cwd: target });
    else rmSync(path.join(target, p.path), { force: true });
  }
  result.discarded = blocking.map((p) => p.path);

  const before = git(['rev-parse', 'HEAD'], { cwd: target }).out;
  const pull = git(['pull', '--rebase', 'origin', base], { cwd: target });
  if (pull.code !== 0) {
    // 되돌리는 것이 먼저다. 중간 상태로 두면 사용자가 손댈 수 없다.
    git(['rebase', '--abort'], { cwd: target });
    const text = `${pull.err}\n${pull.out}`;
    result.skipped = /conflict|could not apply/i.test(text) ? 'conflict' : 'error';
    result.reason = pull.err || pull.out;
    result.localOnly = git(['log', '--oneline', `origin/${base}..HEAD`], { cwd: target }).out;
    result.restored = git(['rev-parse', 'HEAD'], { cwd: target }).out === before;
    return result;
  }

  const after = git(['rev-parse', 'HEAD'], { cwd: target }).out;
  result.ok = true;
  result.before = before;
  result.after = after;
  result.received = before === after
    ? 0
    : Number(git(['rev-list', '--count', `${before}..${after}`], { cwd: target }).out || 0);
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
