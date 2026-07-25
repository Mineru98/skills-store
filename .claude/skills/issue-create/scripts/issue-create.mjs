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
 *   5) unlabeled : 성격 라벨 / 진행 상태 라벨이 빠진 기존 이슈를 찾는다.
 *   6) label     : 기존 이슈에 라벨을 붙이거나 뗀다.
 *   7) ensure-label : 표준 라벨이 없을 때 만든다 (사용자 승인 후에만 호출).
 *   8) status    : 진행 상태 라벨을 교체한다 (open|plan|in-process|review|close).
 *
 * 라벨은 두 축이다 — 성격(bug/enhancement/…) 과 진행 상태(status:*).
 * create 는 성격 라벨을 강제하고, status:open 은 생성 직후 자동으로 붙인다.
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
import {
  repoRoot, issueDir, ensureIgnoreBlock, parseIssueNumber, WORKSPACE_DIR,
  ensureLabel, setStatus, typeLabels, isStatusLabel, STATUS_ORDER,
} from './issue-common.mjs';

export { parseIssueNumber };

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
  node issue-create.mjs label <issue-number> [--label <name>...] [--remove-label <name>...]
  node issue-create.mjs ensure-label <name> [--color <hex>] [--desc <설명>]
  node issue-create.mjs status <issue-number> <${STATUS_ORDER.map((s) => s.slice(7)).join('|')}>

gate:
  커밋 수·원격·이슈 이력·빌드 설정·소스 규모를 확인해
  READY / ASK / SKIP 중 하나를 출력한다.

create options:
  --title <t>          이슈 제목 (필수)
  --body-file <f>      이슈 본문 마크다운 파일 (필수)
  --label <name>       성격 라벨 (필수, 여러 번 지정 가능, 저장소에 있는 것만)
  --no-label           라벨 없이 만든다. 의도적으로 규칙을 벗어날 때만 쓴다
  --no-status          생성 후 status:open 자동 부착을 생략한다
  --assignee <login>   담당자 (@me 가능)
  --request-file <f>   원본 요청 기록. 생략 시 --body-file 을 복사
  --repo <o/n>         대상 저장소 (기본: 현재 디렉터리의 origin)

request.md 는 ${WORKSPACE_DIR}/<번호>/ 에 남고, ${WORKSPACE_DIR} 는 .gitignore 에 자동 등록된다.
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
  // "라벨 0개"로 판정하면 status:* 만 붙은 이슈가 점검망에서 통째로 샌다.
  // 성격 라벨 축과 진행 상태 축을 따로 센다.
  const names = (it) => (it.labels ?? []).map((l) => l.name);
  const bare = list.filter((it) => !typeLabels(names(it)).length);
  const noStatus = list.filter((it) => !names(it).some(isStatusLabel));

  console.log('성격 라벨 없음:');
  for (const it of bare) {
    console.log(`  #${it.number} ${it.title}`);
    console.log(`     ${it.url}`);
  }
  if (!bare.length) console.log('  (없음)');
  console.log('');
  console.log('진행 상태 라벨 없음:');
  for (const it of noStatus) console.log(`  #${it.number} ${it.title}`);
  if (!noStatus.length) console.log('  (없음)');
  console.log('');
  console.log(`SCANNED=${list.length}`);
  console.log(`UNLABELED=${bare.length}`);
  console.log(`UNLABELED_NUMBERS=${bare.map((i) => i.number).join(' ')}`);
  console.log(`NO_STATUS=${noStatus.length}`);
  console.log(`NO_STATUS_NUMBERS=${noStatus.map((i) => i.number).join(' ')}`);
}

function cmdLabel(number, root, opts) {
  if (!number) {
    console.error('✗ 이슈 번호가 필요하다 (예: label 59 --label bug)');
    usage();
  }
  if (!opts.labels.length && !opts.removeLabels.length) {
    console.error('✗ --label 또는 --remove-label 이 하나 이상 필요하다.');
    usage();
  }
  const args = ghArgs(['issue', 'edit', String(number)], opts);
  for (const label of opts.labels) args.push('--add-label', label);
  for (const label of opts.removeLabels) args.push('--remove-label', label);

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
  const added = opts.labels.length ? `← ${opts.labels.join(', ')}` : '';
  const removed = opts.removeLabels.length ? `✂ ${opts.removeLabels.join(', ')}` : '';
  console.log(`✓ #${number} ${[added, removed].filter(Boolean).join('  ')}`);
  console.log('');
  console.log('LABELED=1');
  console.log(`ISSUE_NUMBER=${number}`);
}

function cmdEnsureLabel(name, root, opts) {
  if (!name) {
    console.error('✗ 라벨 이름이 필요하다 (예: ensure-label enhancement)');
    usage();
  }
  if (opts.dryRun) {
    console.log(`(dry-run) ${name} 이 없으면 만든다.`);
    console.log('CREATED=0');
    console.log(`LABEL=${name}`);
    return;
  }
  // 색·설명 프리셋과 존재 검증은 공용 모듈이 갖고 있다. 여기서는 출력 계약만 맞춘다.
  const result = ensureLabel(root, name, {
    repo: opts.repo, color: opts.color, description: opts.desc,
  });
  const msg = {
    exists: `✓ 이미 있다: ${name}`,
    created: `✓ 라벨 생성: ${name}`,
    failed: `✗ 라벨 생성 실패: ${name}`,
  };
  console.log(msg[result]);
  console.log('');
  console.log(`CREATED=${result === 'created' ? 1 : 0}`);
  console.log(`LABEL=${name}`);
}

/* ----------------------------------------------------------------- create */

function cmdCreate(root, opts) {
  if (!opts.title || !opts.bodyFile) {
    console.error('✗ --title 과 --body-file 이 모두 필요하다.');
    usage();
  }
  // "만든 이슈에는 라벨을 반드시 하나 이상 붙인다"는 규칙을 문서에만 두면
  // --label 을 빠뜨린 호출이 조용히 통과한다. 여기서 막는다.
  // status:* 는 진행 상태 축이라 이 게이트를 만족시키지 못한다 — 성격 라벨만 센다.
  if (!typeLabels(opts.labels).length && !opts.noLabel) {
    console.error('✗ 성격 라벨(--label)이 하나 이상 필요하다. 라벨 없는 이슈는 만들지 않는다.');
    console.error('  쓸 수 있는 라벨: node issue-create.mjs labels');
    console.error('  없으면 만들기:   node issue-create.mjs ensure-label <이름>   (사용자 승인 후)');
    console.error('  의도적으로 생략하려면 --no-label 을 명시하라.');
    process.exit(2);
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

  const dir = issueDir(root, number);
  mkdirSync(dir, { recursive: true });
  const requestSrc = path.resolve(opts.requestFile ?? bodyPath);
  const request = existsSync(requestSrc) ? readFileSync(requestSrc, 'utf8') : '';
  writeFileSync(
    path.join(dir, 'request.md'),
    `# #${number} 착수 요청 기록\n\n- 이슈: ${url}\n- 생성: issue-create\n\n---\n\n${request.trim()}\n`,
  );

  // 경고만 하지 않고 직접 등록한다. 사용자가 손댈 일을 남기지 않는다.
  if (ensureIgnoreBlock(root)) console.log(`  .gitignore 에 ${WORKSPACE_DIR} 블록을 추가했다.`);

  console.log(`✓ 이슈 생성 완료 — #${number} ${opts.title}`);
  console.log(`  요청 기록: ${path.relative(root, path.join(dir, 'request.md'))}`);
  console.log('');
  // 성격 라벨과 달리 status 는 생성 후에 따로 붙인다.
  // --label 로 같이 넘기면 라벨이 없을 때 이슈 생성 자체가 실패한다.
  if (!opts.noStatus) setStatus(root, number, 'open', { repo: opts.repo });

  console.log(`ISSUE_NUMBER=${number}`);
  console.log(`ISSUE_URL=${url}`);
  console.log(`NEXT=/issue-start #${number}`);
}

/* ------------------------------------------------------------------- main */

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('-h') || argv.includes('--help')) usage(argv.length ? 0 : 1);

  const mode = argv[0];
  if (!['gate', 'search', 'labels', 'create', 'unlabeled', 'label', 'ensure-label', 'status'].includes(mode)) {
    console.error(`✗ 알 수 없는 모드: ${mode}`);
    usage();
  }

  const opts = { dryRun: false, labels: [], removeLabels: [] };
  const positionals = [];
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--no-label') opts.noLabel = true;
    else if (arg === '--no-status') opts.noStatus = true;
    else if (arg === '--remove-label') opts.removeLabels.push(argv[++i]);
    else if (arg === '--title') opts.title = argv[++i];
    else if (arg === '--body-file') opts.bodyFile = argv[++i];
    else if (arg === '--request-file') opts.requestFile = argv[++i];
    else if (arg === '--label') opts.labels.push(argv[++i]);
    else if (arg === '--assignee') opts.assignee = argv[++i];
    else if (arg === '--limit') opts.limit = argv[++i];
    else if (arg === '--state') opts.state = argv[++i];
    else if (arg === '--color') opts.color = argv[++i];
    else if (arg === '--desc') opts.desc = argv[++i];
    else if (arg === '--repo') opts.repo = argv[++i];
    else if (arg.startsWith('-')) {
      console.error(`✗ 알 수 없는 옵션: ${arg}`);
      usage();
    } else positionals.push(arg);
  }

  const positional = positionals[0] ?? null;
  const root = repoRoot();
  if (mode === 'gate') cmdGate(root, opts);
  else if (mode === 'search') cmdSearch(positional, root, opts);
  else if (mode === 'labels') cmdLabels(root, opts);
  else if (mode === 'unlabeled') cmdUnlabeled(root, opts);
  else if (mode === 'label') cmdLabel(parseIssueNumber(positional), root, opts);
  else if (mode === 'ensure-label') cmdEnsureLabel(positional, root, opts);
  else if (mode === 'status') setStatus(root, positional, positionals[1], { repo: opts.repo, dryRun: opts.dryRun });
  else cmdCreate(root, opts);
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) main();
