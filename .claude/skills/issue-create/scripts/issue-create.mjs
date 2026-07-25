#!/usr/bin/env node
/**
 * issue-create.mjs — 착수 전에 GitHub 이슈를 만드는 보조 스크립트 (저장소 비종속).
 *
 * 네 가지 모드로 나뉜다.
 *
 *   1) gate      : "이슈를 만들 만큼 자리 잡은 프로젝트인가"를 신호로 판정한다.
 *   2) search    : 같은 내용의 이슈가 이미 있는지 찾는다.
 *   3) labels    : 저장소에 실제로 존재하는 라벨만 쓰기 위해 목록을 뽑는다.
 *   4) create    : 이슈를 만들고 issue-start 가 이어받을 request.md 를 남긴다.
 *   5) unlabeled : 라벨이 하나도 없는 기존 이슈를 찾는다.
 *   6) label     : 기존 이슈에 라벨을 붙인다.
 *   7) ensure-label : 표준 라벨이 없을 때 만든다 (사용자 승인 후에만 호출).
 *
 * 사용:
 *   node issue-create.mjs gate
 *   node issue-create.mjs search "탭 활성 상태"
 *   node issue-create.mjs labels
 *   node issue-create.mjs create --title "..." --body-file draft.md --label bug
 *   node issue-create.mjs unlabeled --state open
 *   node issue-create.mjs label 59 --label bug
 *   node issue-create.mjs ensure-label enhancement
 *
 * 요구사항: git, gh(로그인 상태), Node 18+
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_OUT = '.issue-start';

/** 성숙도 판정 임계값 */
const THRESHOLD = {
  commits: 20,
  scaffoldCommits: 2, // 이하이면 신호 수와 무관하게 skip
  sourceFiles: 10,
  ready: 4, // 이 점수 이상이면 바로 진행
  ask: 2, // 이 점수 이상이면 사용자에게 한 번 확인
};

const BUILD_FILES = [
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Gemfile',
  'composer.json',
  'Makefile',
];

const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|swift|c|cc|cpp|h|hpp|cs|scala|vue|svelte)$/i;

function usage(exitCode = 1) {
  console.error(`Usage:
  node issue-create.mjs gate
  node issue-create.mjs search "<질의>" [--repo <owner/name>] [--limit <n>]
  node issue-create.mjs labels [--repo <owner/name>]
  node issue-create.mjs create --title <제목> --body-file <파일> [options]
  node issue-create.mjs unlabeled [--state open|all] [--limit <n>] [--repo <o/n>]
  node issue-create.mjs label <issue-number> --label <name> [--label <name>...]
  node issue-create.mjs ensure-label <name> [--color <hex>] [--desc <설명>]

gate:
  커밋 수·원격·이슈 이력·빌드 설정·소스 규모를 확인해
  READY / ASK / SKIP 중 하나를 출력한다.

create options:
  --title <t>          이슈 제목 (필수)
  --body-file <f>      이슈 본문 마크다운 파일 (필수)
  --label <name>       라벨 (여러 번 지정 가능, 저장소에 있는 것만)
  --assignee <login>   담당자 (@me 가능)
  --request-file <f>   원본 요청 기록. 생략 시 --body-file 을 복사
  --out <dir>          request.md 저장 위치 (기본: ${DEFAULT_OUT})
  --repo <o/n>         대상 저장소 (기본: 현재 디렉터리의 origin)
  --dry-run            gh 를 호출하지 않고 실행 계획만 출력
  -h, --help           이 도움말
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

function quoteArgs(args) {
  return args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ');
}

function ghArgs(base, opts) {
  return opts.repo ? [...base, '--repo', opts.repo] : base;
}

/* ------------------------------------------------------------------- gate */

export function verdictOf({ score, commits }) {
  if (commits <= THRESHOLD.scaffoldCommits) return 'SKIP';
  if (score >= THRESHOLD.ready) return 'READY';
  if (score >= THRESHOLD.ask) return 'ASK';
  return 'SKIP';
}

function cmdGate(root, opts) {
  const commits = Number(run('git', ['rev-list', '--count', 'HEAD'], { cwd: root }).stdout?.trim() || 0);

  const remotes = (run('git', ['remote'], { cwd: root }).stdout ?? '').trim().split('\n').filter(Boolean);
  const repoView = remotes.length
    ? run('gh', ghArgs(['repo', 'view', '--json', 'nameWithOwner'], opts), { cwd: root })
    : { status: 1 };
  const hasRemote = remotes.length > 0 && repoView.status === 0;

  let hasHistory = false;
  if (hasRemote) {
    const issues = run('gh', ghArgs(['issue', 'list', '--state', 'all', '--limit', '1', '--json', 'number'], opts), {
      cwd: root,
    });
    const prs = run('gh', ghArgs(['pr', 'list', '--state', 'all', '--limit', '1', '--json', 'number'], opts), {
      cwd: root,
    });
    const nonEmpty = (res) => res.status === 0 && (res.stdout ?? '').trim() !== '[]';
    hasHistory = nonEmpty(issues) || nonEmpty(prs);
  }

  const tracked = (run('git', ['ls-files'], { cwd: root }).stdout ?? '').split('\n').filter(Boolean);
  const hasBuildFile = BUILD_FILES.some((f) => existsSync(path.join(root, f)));
  const sourceFiles = tracked.filter((f) => SOURCE_RE.test(f)).length;

  const signals = [
    [`commits>=${THRESHOLD.commits}`, commits >= THRESHOLD.commits, `${commits}개`],
    ['remote+gh', hasRemote, hasRemote ? repoView.stdout.trim() : '없음'],
    ['issue/pr-history', hasHistory, hasHistory ? '있음' : '없음'],
    ['build-config', hasBuildFile, BUILD_FILES.filter((f) => existsSync(path.join(root, f))).join(', ') || '없음'],
    [`source>=${THRESHOLD.sourceFiles}`, sourceFiles >= THRESHOLD.sourceFiles, `${sourceFiles}개`],
  ];
  const score = signals.filter(([, ok]) => ok).length;
  const verdict = verdictOf({ score, commits });

  for (const [name, ok, detail] of signals) {
    console.log(`  ${ok ? '✓' : '·'} ${name.padEnd(20)} ${detail}`);
  }
  console.log('');
  console.log(`SIGNALS=${signals.filter(([, ok]) => ok).map(([n]) => n).join(',') || '(없음)'}`);
  console.log(`SCORE=${score}/${signals.length}`);
  console.log(`VERDICT=${verdict}`);
}

/* ----------------------------------------------------------------- search */

function cmdSearch(query, root, opts) {
  if (!query) {
    console.error('✗ 검색어가 필요하다 (예: search "탭 활성 상태")');
    usage();
  }
  const limit = String(opts.limit ?? 5);
  const args = ghArgs(
    ['issue', 'list', '--state', 'open', '--limit', limit, '--search', query, '--json', 'number,title,labels,url'],
    opts,
  );
  const res = run('gh', args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  if (res.status !== 0) {
    console.log('MATCHES=0');
    console.log('SEARCH_FAILED=1');
    return;
  }
  let list = [];
  try {
    list = JSON.parse(res.stdout || '[]');
  } catch {
    list = [];
  }
  for (const it of list) {
    const labels = (it.labels ?? []).map((l) => l.name).join(', ');
    console.log(`  #${it.number} ${it.title}${labels ? `  [${labels}]` : ''}`);
    console.log(`     ${it.url}`);
  }
  if (!list.length) console.log('  (유사한 열린 이슈 없음)');
  console.log('');
  console.log(`MATCHES=${list.length}`);
  console.log(`MATCH_NUMBERS=${list.map((i) => i.number).join(' ')}`);
}

/* ----------------------------------------------------------------- labels */

function cmdLabels(root, opts) {
  const args = ghArgs(['label', 'list', '--limit', '100', '--json', 'name,description'], opts);
  const res = run('gh', args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  if (res.status !== 0) {
    console.log('LABELS=');
    return;
  }
  let list = [];
  try {
    list = JSON.parse(res.stdout || '[]');
  } catch {
    list = [];
  }
  for (const l of list) console.log(`  ${l.name}${l.description ? `  — ${l.description}` : ''}`);
  console.log('');
  console.log(`LABELS=${list.map((l) => l.name).join(',')}`);
}

/* -------------------------------------------------------- label 점검·부착 */

/** 표준 라벨과 GitHub 기본 색상. ensure-label 이 만들 때 쓴다. */
const STANDARD_LABELS = {
  bug: { color: 'd73a4a', description: "Something isn't working" },
  enhancement: { color: 'a2eeef', description: 'New feature or request' },
  documentation: { color: '0075ca', description: 'Improvements or additions to documentation' },
  chore: { color: 'cfd3d7', description: 'Maintenance and cleanup' },
};

function cmdUnlabeled(root, opts) {
  const args = ghArgs(
    [
      'issue', 'list',
      '--state', opts.state ?? 'open',
      '--limit', String(opts.limit ?? 50),
      '--json', 'number,title,labels,url,createdAt',
    ],
    opts,
  );
  const res = run('gh', args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  if (res.status !== 0) {
    console.log('UNLABELED=0');
    console.log('LIST_FAILED=1');
    return;
  }
  let list = [];
  try {
    list = JSON.parse(res.stdout || '[]');
  } catch {
    list = [];
  }
  const bare = list.filter((it) => !(it.labels ?? []).length);
  for (const it of bare) {
    console.log(`  #${it.number} ${it.title}`);
    console.log(`     ${it.url}`);
  }
  if (!bare.length) console.log('  (라벨 없는 이슈 없음)');
  console.log('');
  console.log(`SCANNED=${list.length}`);
  console.log(`UNLABELED=${bare.length}`);
  console.log(`UNLABELED_NUMBERS=${bare.map((i) => i.number).join(' ')}`);
}

function cmdLabel(number, root, opts) {
  if (!number) {
    console.error('✗ 이슈 번호가 필요하다 (예: label 59 --label bug)');
    usage();
  }
  if (!opts.labels.length) {
    console.error('✗ --label 이 하나 이상 필요하다.');
    usage();
  }
  const args = ghArgs(['issue', 'edit', String(number)], opts);
  for (const label of opts.labels) args.push('--add-label', label);

  if (opts.dryRun) {
    console.log(`(dry-run) gh ${quoteArgs(args)}`);
    return;
  }
  const res = run('gh', args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  if (res.status !== 0) {
    console.log(`LABELED=0`);
    console.log(`FAILED_ISSUE=${number}`);
    return;
  }
  console.log(`✓ #${number} ← ${opts.labels.join(', ')}`);
  console.log('');
  console.log('LABELED=1');
  console.log(`ISSUE_NUMBER=${number}`);
}

function cmdEnsureLabel(name, root, opts) {
  if (!name) {
    console.error('✗ 라벨 이름이 필요하다 (예: ensure-label enhancement)');
    usage();
  }
  const listed = run('gh', ghArgs(['label', 'list', '--limit', '100', '--json', 'name'], opts), {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let existing = [];
  try {
    existing = JSON.parse(listed.stdout || '[]').map((l) => l.name);
  } catch {
    existing = [];
  }
  if (existing.includes(name)) {
    console.log(`✓ 이미 있다: ${name}`);
    console.log('');
    console.log('CREATED=0');
    console.log(`LABEL=${name}`);
    return;
  }

  const preset = STANDARD_LABELS[name] ?? {};
  const args = ghArgs(['label', 'create', name], opts);
  args.push('--color', opts.color ?? preset.color ?? 'ededed');
  if (opts.desc ?? preset.description) args.push('--description', opts.desc ?? preset.description);

  if (opts.dryRun) {
    console.log(`(dry-run) gh ${quoteArgs(args)}`);
    return;
  }
  const res = run('gh', args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  console.log(res.status === 0 ? `✓ 라벨 생성: ${name}` : `✗ 라벨 생성 실패: ${name}`);
  console.log('');
  console.log(`CREATED=${res.status === 0 ? 1 : 0}`);
  console.log(`LABEL=${name}`);
}

/* ----------------------------------------------------------------- create */

export function parseIssueNumber(urlOrText) {
  const m = String(urlOrText ?? '').match(/\/issues\/(\d+)/) ?? String(urlOrText ?? '').match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function cmdCreate(root, opts) {
  if (!opts.title || !opts.bodyFile) {
    console.error('✗ --title 과 --body-file 이 모두 필요하다.');
    usage();
  }
  const bodyPath = path.resolve(opts.bodyFile);
  if (!existsSync(bodyPath)) {
    console.error(`✗ 본문 파일이 없다: ${bodyPath}`);
    process.exit(1);
  }

  const args = ghArgs(['issue', 'create', '--title', opts.title, '--body-file', bodyPath], opts);
  for (const label of opts.labels) args.push('--label', label);
  if (opts.assignee) args.push('--assignee', opts.assignee);

  if (opts.dryRun) {
    console.log(`(dry-run) gh ${quoteArgs(args)}`);
    console.log('\n아무것도 생성하지 않았다.');
    return;
  }

  const out = must('gh', args, { cwd: root });
  const url = (out.split('\n').find((l) => l.includes('/issues/')) ?? out).trim();
  const number = parseIssueNumber(url);
  if (!number) {
    console.error(`✗ 이슈 번호를 파싱하지 못했다. gh 출력:\n${out}`);
    process.exit(1);
  }

  const dir = path.resolve(root, opts.out, String(number));
  mkdirSync(dir, { recursive: true });
  const requestSrc = path.resolve(opts.requestFile ?? bodyPath);
  const request = existsSync(requestSrc) ? readFileSync(requestSrc, 'utf8') : '';
  writeFileSync(
    path.join(dir, 'request.md'),
    `# #${number} 착수 요청 기록\n\n- 이슈: ${url}\n- 생성: issue-create\n\n---\n\n${request.trim()}\n`,
  );

  const gitignore = path.join(root, '.gitignore');
  const ignored = existsSync(gitignore) && readFileSync(gitignore, 'utf8').includes(opts.out);
  if (!ignored) console.log(`! ${opts.out}/ 이 .gitignore 에 없다. 추가를 권한다.`);

  console.log(`✓ 이슈 생성 완료 — #${number} ${opts.title}`);
  console.log(`  요청 기록: ${path.relative(root, path.join(dir, 'request.md'))}`);
  console.log('');
  console.log(`ISSUE_NUMBER=${number}`);
  console.log(`ISSUE_URL=${url}`);
  console.log(`NEXT=/issue-start #${number}`);
}

/* ------------------------------------------------------------------- main */

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('-h') || argv.includes('--help')) usage(argv.length ? 0 : 1);

  const mode = argv[0];
  if (!['gate', 'search', 'labels', 'create', 'unlabeled', 'label', 'ensure-label'].includes(mode)) {
    console.error(`✗ 알 수 없는 모드: ${mode}`);
    usage();
  }

  const opts = { dryRun: false, out: DEFAULT_OUT, labels: [] };
  let positional = null;
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--title') opts.title = argv[++i];
    else if (arg === '--body-file') opts.bodyFile = argv[++i];
    else if (arg === '--request-file') opts.requestFile = argv[++i];
    else if (arg === '--label') opts.labels.push(argv[++i]);
    else if (arg === '--assignee') opts.assignee = argv[++i];
    else if (arg === '--limit') opts.limit = argv[++i];
    else if (arg === '--state') opts.state = argv[++i];
    else if (arg === '--color') opts.color = argv[++i];
    else if (arg === '--desc') opts.desc = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--repo') opts.repo = argv[++i];
    else if (arg.startsWith('-')) {
      console.error(`✗ 알 수 없는 옵션: ${arg}`);
      usage();
    } else positional = arg;
  }

  const root = repoRoot();
  if (mode === 'gate') cmdGate(root, opts);
  else if (mode === 'search') cmdSearch(positional, root, opts);
  else if (mode === 'labels') cmdLabels(root, opts);
  else if (mode === 'unlabeled') cmdUnlabeled(root, opts);
  else if (mode === 'label') cmdLabel(parseIssueNumber(positional), root, opts);
  else if (mode === 'ensure-label') cmdEnsureLabel(positional, root, opts);
  else cmdCreate(root, opts);
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) main();
