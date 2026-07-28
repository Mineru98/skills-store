#!/usr/bin/env node
/**
 * issue-create.mjs — 착수 전에 이슈를 만드는 보조 스크립트 (저장소·트래커 비종속).
 *
 * 아홉 가지 모드로 나뉜다.
 *
 *   1) mode      : 암묵적인 issue-create 개입 여부를 사용자 설정에서 읽는다.
 *   2) gate      : "이슈를 만들 만큼 자리 잡은 프로젝트인가"를 신호로 판정한다.
 *   3) search    : 같은 내용의 이슈가 이미 있는지 찾는다.
 *   4) labels    : 저장소에 실제로 존재하는 라벨만 쓰기 위해 목록을 뽑는다.
 *   5) create    : 이슈를 만들고 issue-start 가 이어받을 request.md 를 남긴다.
 *   6) unlabeled : 라벨이 하나도 없는 기존 이슈를 찾는다.
 *   7) label     : 기존 이슈에 라벨을 붙인다.
 *   8) ensure-label : 표준 라벨이 없을 때 만든다 (사용자 승인 후에만 호출).
 *   9) status    : 진행 상태 라벨을 상호배타적으로 전환한다.
 *
 * 사용:
 *   node issue-create.mjs mode
 *   node issue-create.mjs gate
 *   node issue-create.mjs search "탭 활성 상태"
 *   node issue-create.mjs labels
 *   node issue-create.mjs create --title "..." --body-file draft.md --label bug
 *   node issue-create.mjs unlabeled --state open
 *   node issue-create.mjs label 59 --label bug
 *   node issue-create.mjs ensure-label enhancement
 *
 * 이슈 백엔드는 ~/.issue/settings.json 의 provider 설정이 정한다 (github 기본 | jira).
 * 트래커 호출은 전부 issue-tracker.mjs 를 거친다. 이 파일은 gh 를 직접 부르지 않는다.
 *
 * 요구사항: git, Node 18+, (github 면 gh 로그인 / jira 면 baseUrl·projectKey·토큰)
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  repoRoot, issueDir, ensureIgnoreBlock, parseIssueNumber, readIssueSettings,
  WORKSPACE_DIR, STATUS_ORDER, typeLabels, isStatusLabel,
} from './issue-common.mjs';
import { createTracker, gitHost, setTrackerStatus } from './issue-tracker.mjs';

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
const CREATE_MODES = ['issue-first', 'direct'];

export function resolveCreateMode(settings = {}) {
  const configured = settings?.issue?.createMode;
  if (typeof configured === 'undefined') {
    return { mode: 'issue-first', source: 'default', valid: true };
  }
  if (CREATE_MODES.includes(configured)) {
    return { mode: configured, source: 'settings', valid: true };
  }
  return { mode: 'issue-first', source: 'invalid', valid: false, configured };
}

function usage(exitCode = 1) {
  console.error(`Usage:
  node issue-create.mjs mode
  node issue-create.mjs gate
  node issue-create.mjs search "<질의>" [--repo <owner/name>] [--limit <n>]
  node issue-create.mjs labels [--repo <owner/name>]
  node issue-create.mjs create --title <제목> --body-file <파일> [options]
  node issue-create.mjs unlabeled [--state open|all] [--limit <n>] [--repo <o/n>]
  node issue-create.mjs label <issue-number> --label <name> [--label <name>...]
  node issue-create.mjs ensure-label <name> [--color <hex>] [--desc <설명>]
  node issue-create.mjs status <issue-number> <${STATUS_ORDER.map((s) => s.slice(7)).join('|')}>

gate:
  커밋 수·원격·이슈 이력·빌드 설정·소스 규모를 확인해
  READY / ASK / SKIP 중 하나를 출력한다.

create options:
  --title <t>          이슈 제목 (필수)
  --body-file <f>      이슈 본문 마크다운 파일 (필수)
  --label <name>       라벨 (필수, 여러 번 지정 가능, 저장소에 있는 것만)
  --no-label           라벨 없이 만든다. 의도적으로 규칙을 벗어날 때만 쓴다
  --no-status          생성 후 status:open 자동 부착을 생략한다
  --assignee <login>   담당자 (@me 가능)
  --request-file <f>   원본 요청 기록. 생략 시 --body-file 을 복사
  --repo <o/n>         대상 저장소 (기본: 현재 디렉터리의 origin, github 트래커 전용)

request.md 는 ${WORKSPACE_DIR}/<번호>/ 에 남고, ${WORKSPACE_DIR} 는 .gitignore 에 자동 등록된다.
  --dry-run            트래커를 호출하지 않고 실행 계획만 출력
  -h, --help           이 도움말

이슈 백엔드는 ~/.issue/settings.json 의 provider.type 이 정한다 (github 기본 | jira).
암묵적인 이슈 등록 여부는 issue.createMode 가 정한다 (issue-first 기본 | direct).
`);
  process.exit(exitCode);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (res.error) throw res.error;
  return res;
}

/* ------------------------------------------------------------------- mode */

function cmdMode() {
  const result = resolveCreateMode(readIssueSettings());
  if (!result.valid) {
    console.warn(`! 알 수 없는 issue.createMode ${JSON.stringify(result.configured)} — issue-first 로 동작합니다.`);
  }
  console.log(`MODE=${result.mode}`);
  console.log(`MODE_SOURCE=${result.source}`);
  if (!result.valid) console.log('INVALID_MODE=1');
}

/* ------------------------------------------------------------------- gate */

export function verdictOf({ score, commits }) {
  if (commits <= THRESHOLD.scaffoldCommits) return 'SKIP';
  if (score >= THRESHOLD.ready) return 'READY';
  if (score >= THRESHOLD.ask) return 'ASK';
  return 'SKIP';
}

function cmdGate(root, tracker) {
  const commits = Number(run('git', ['rev-list', '--count', 'HEAD'], { cwd: root }).stdout?.trim() || 0);

  const remotes = (run('git', ['remote'], { cwd: root }).stdout ?? '').trim().split('\n').filter(Boolean);
  const repo = remotes.length ? gitHost.repoInfo(root) : null;
  const hasRemote = Boolean(repo?.nameWithOwner);

  // 이슈 이력은 트래커에, PR 이력은 코드 호스트에 있다. 트래커가 Jira 여도 둘 다 본다.
  let hasHistory = false;
  if (hasRemote) {
    hasHistory = tracker.hasIssueHistory() || gitHost.hasPrHistory({ cwd: root });
  }

  const tracked = (run('git', ['ls-files'], { cwd: root }).stdout ?? '').split('\n').filter(Boolean);
  const hasBuildFile = BUILD_FILES.some((f) => existsSync(path.join(root, f)));
  const sourceFiles = tracked.filter((f) => SOURCE_RE.test(f)).length;

  const signals = [
    [`commits>=${THRESHOLD.commits}`, commits >= THRESHOLD.commits, `${commits}개`],
    ['remote+gh', hasRemote, hasRemote ? repo.nameWithOwner : '없음'],
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

function cmdSearch(query, opts, tracker) {
  if (!query) {
    console.error('✗ 검색어가 필요하다 (예: search "탭 활성 상태")');
    usage();
  }
  const list = tracker.issueList({ state: 'open', limit: Number(opts.limit ?? 5), search: query });
  if (list === null) {
    console.log('MATCHES=0');
    console.log('SEARCH_FAILED=1');
    return;
  }
  for (const it of list) {
    const labels = (it.labels ?? []).map((l) => l.name).join(', ');
    console.log(`  ${it.key ?? `#${it.number}`} ${it.title}${labels ? `  [${labels}]` : ''}`);
    console.log(`     ${it.url}`);
  }
  if (!list.length) console.log('  (유사한 열린 이슈 없음)');
  console.log('');
  console.log(`MATCHES=${list.length}`);
  console.log(`MATCH_NUMBERS=${list.map((i) => i.number).join(' ')}`);
}

/* ----------------------------------------------------------------- labels */

function cmdLabels(tracker) {
  const list = tracker.labelList();
  if (list === null) {
    console.log('LABELS=');
    return;
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

function cmdUnlabeled(opts, tracker) {
  const list = tracker.issueList({ state: opts.state ?? 'open', limit: Number(opts.limit ?? 50) });
  if (list === null) {
    console.log('UNLABELED=0');
    console.log('LIST_FAILED=1');
    return;
  }
  const names = (it) => (it.labels ?? []).map((label) => label.name);
  const bare = list.filter((it) => !typeLabels(names(it)).length);
  const noStatus = list.filter((it) => !names(it).some(isStatusLabel));
  console.log('성격 라벨 없음:');
  for (const it of bare) {
    console.log(`  ${it.key ?? `#${it.number}`} ${it.title}`);
    console.log(`     ${it.url}`);
  }
  if (!bare.length) console.log('  (없음)');
  console.log('');
  console.log('진행 상태 라벨 없음:');
  for (const it of noStatus) console.log(`  ${it.key ?? `#${it.number}`} ${it.title}`);
  if (!noStatus.length) console.log('  (없음)');
  console.log('');
  console.log(`SCANNED=${list.length}`);
  console.log(`UNLABELED=${bare.length}`);
  console.log(`UNLABELED_NUMBERS=${bare.map((i) => i.number).join(' ')}`);
  console.log(`NO_STATUS=${noStatus.length}`);
  console.log(`NO_STATUS_NUMBERS=${noStatus.map((i) => i.number).join(' ')}`);
}

function cmdLabel(number, opts, tracker) {
  if (!number) {
    console.error('✗ 이슈 번호가 필요하다 (예: label 59 --label bug)');
    usage();
  }
  if (!opts.labels.length && !opts.removeLabels.length) {
    console.error('✗ --label 또는 --remove-label 이 하나 이상 필요하다.');
    usage();
  }
  const display = tracker.displayKey(number);

  if (opts.dryRun) {
    console.log(`(dry-run) ${tracker.provider}: ${display} ← ${opts.labels.join(', ')}`);
    return;
  }
  const res = opts.labels.length
    ? tracker.issueAddLabels(number, opts.labels)
    : tracker.issueRemoveLabels(number, opts.removeLabels);
  if (!res.ok) {
    console.log(`LABELED=0`);
    console.log(`FAILED_ISSUE=${number}`);
    return;
  }
  console.log(`✓ ${display} ${opts.labels.length ? `← ${opts.labels.join(', ')}` : `✂ ${opts.removeLabels.join(', ')}`}`);
  console.log('');
  console.log('LABELED=1');
  console.log(`ISSUE_NUMBER=${number}`);
}

function cmdEnsureLabel(name, opts, tracker) {
  if (!name) {
    console.error('✗ 라벨 이름이 필요하다 (예: ensure-label enhancement)');
    usage();
  }
  const existing = (tracker.labelList() ?? []).map((l) => l.name);
  if (existing.includes(name)) {
    console.log(`✓ 이미 있다: ${name}`);
    console.log('');
    console.log('CREATED=0');
    console.log(`LABEL=${name}`);
    return;
  }

  const preset = STANDARD_LABELS[name] ?? {};
  const spec = {
    color: opts.color ?? preset.color ?? 'ededed',
    description: opts.desc ?? preset.description,
  };

  if (opts.dryRun) {
    console.log(`(dry-run) ${tracker.provider}: 라벨 생성 ${name} (color=${spec.color})`);
    return;
  }
  const res = tracker.labelCreate(name, spec);
  // Jira 는 라벨을 미리 만들지 않는다. 실패가 아니라 "할 일이 없다"이므로 그렇게 보고한다.
  if (res.noop) {
    console.log(`· 생성 생략: ${name} — ${res.note}`);
    console.log('');
    console.log('CREATED=0');
    console.log(`NOOP=1`);
    console.log(`LABEL=${name}`);
    return;
  }
  console.log(res.created ? `✓ 라벨 생성: ${name}` : `✗ 라벨 생성 실패: ${name}`);
  console.log('');
  console.log(`CREATED=${res.created ? 1 : 0}`);
  console.log(`LABEL=${name}`);
}

/* ----------------------------------------------------------------- create */

function cmdCreate(root, opts, tracker) {
  if (!opts.title || !opts.bodyFile) {
    console.error('✗ --title 과 --body-file 이 모두 필요하다.');
    usage();
  }
  // "만든 이슈에는 라벨을 반드시 하나 이상 붙인다"는 규칙을 문서에만 두면
  // --label 을 빠뜨린 호출이 조용히 통과한다. 여기서 막는다.
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

  if (opts.dryRun) {
    const args = ['issue', 'create', '--title', opts.title, '--body-file', bodyPath];
    for (const label of opts.labels) args.push('--label', label);
    if (opts.assignee) args.push('--assignee', opts.assignee);
    console.log(`(dry-run) gh ${args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(' ')}`);
    console.log('\n아무것도 생성하지 않았다.');
    return;
  }

  const res = tracker.issueCreate({
    title: opts.title,
    bodyFile: bodyPath,
    labels: opts.labels,
    assignee: opts.assignee,
  });
  if (!res.ok) {
    console.error(`✗ 이슈 생성 실패: ${res.err}`);
    process.exit(1);
  }
  const { number, url } = res;
  const display = res.key ?? `#${number}`;

  const dir = issueDir(root, number);
  mkdirSync(dir, { recursive: true });
  const requestSrc = path.resolve(opts.requestFile ?? bodyPath);
  const request = existsSync(requestSrc) ? readFileSync(requestSrc, 'utf8') : '';
  writeFileSync(
    path.join(dir, 'request.md'),
    `# ${display} 착수 요청 기록\n\n- 이슈: ${url}\n- 트래커: ${tracker.provider}\n- 생성: issue-create\n\n---\n\n${request.trim()}\n`,
  );

  // 경고만 하지 않고 직접 등록한다. 사용자가 손댈 일을 남기지 않는다.
  if (ensureIgnoreBlock(root)) console.log(`  .gitignore 에 ${WORKSPACE_DIR} 블록을 추가했다.`);
  if (!opts.noStatus) {
    const status = setTrackerStatus(tracker, number, 'open', { quiet: true });
    if (!status.ok) console.warn(`  ! status:open 전환을 건너뜁니다: ${status.err ?? '알 수 없는 오류'}`);
  }

  console.log(`✓ 이슈 생성 완료 — ${display} ${opts.title}`);
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
  if (!['mode', 'gate', 'search', 'labels', 'create', 'unlabeled', 'label', 'ensure-label', 'status'].includes(mode)) {
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
    else if (arg === '--title') opts.title = argv[++i];
    else if (arg === '--body-file') opts.bodyFile = argv[++i];
    else if (arg === '--request-file') opts.requestFile = argv[++i];
    else if (arg === '--label') opts.labels.push(argv[++i]);
    else if (arg === '--remove-label') opts.removeLabels.push(argv[++i]);
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

  if (mode === 'mode') {
    cmdMode();
    return;
  }

  const root = repoRoot();
  const tracker = createTracker(root, { repo: opts.repo });

  // 이슈를 실제로 건드리는 모드는 인증이 안 되어 있으면 먼저 멈춘다.
  // gate 는 인증 실패도 신호의 하나라 통과시킨다.
  if (mode !== 'gate' && tracker.provider === 'jira' && !opts.dryRun && !(mode === 'create' && !typeLabels(opts.labels).length && !opts.noLabel)) {
    const auth = tracker.auth();
    if (!auth.ok) {
      console.error(`✗ ${tracker.provider} 인증 실패: ${auth.detail}`);
      if (auth.hint) console.error(`  ${auth.hint}`);
      process.exit(4);
    }
  }

  if (mode === 'gate') cmdGate(root, tracker);
  else if (mode === 'search') cmdSearch(positional, opts, tracker);
  else if (mode === 'labels') cmdLabels(tracker);
  else if (mode === 'unlabeled') cmdUnlabeled(opts, tracker);
  else if (mode === 'label') cmdLabel(parseIssueNumber(positional), opts, tracker);
  else if (mode === 'ensure-label') cmdEnsureLabel(positional, opts, tracker);
  else if (mode === 'status') {
    const result = setTrackerStatus(tracker, positional, positionals[1], { dryRun: opts.dryRun });
    if (!result.status) { console.error(`✗ 상태 전환 실패: ${result.err}`); process.exit(2); }
    if (!result.ok) console.log('STATUS_FAILED=1');
  }
  else cmdCreate(root, opts, tracker);
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) main();
