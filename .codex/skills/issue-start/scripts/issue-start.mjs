#!/usr/bin/env node
/**
 * issue-start.mjs — GitHub 이슈 착수 자동화 (저장소 비종속).
 *
 * 서브커맨드
 *   fetch <n>            이슈 본문/코멘트/라벨/첨부 이미지를 .issue/<n>/ 로 수집
 *   worktree <n>         이슈 번호 + 영문 slug 로 브랜치와 워크트리 생성
 *   guard                무확인 커밋 전 안전장치 3종 검사
 *   evidence-init <n>    증거 디렉터리 생성 + .gitignore 블록 보장
 *   evidence-commit <n>  증거 파일을 강제 add 하고 커밋
 *   evidence-mirror <n>  기본 브랜치에 증거만 커밋 (코멘트 이미지가 렌더링되게)
 *   evidence-urls <n>    코멘트에 붙일 raw 이미지 URL 출력
 *   migrate              .issue-start / .issue-evidence 를 .issue 로 이관
 *   sync-base            증거 미러 뒤 주 체크아웃의 기본 브랜치를 최신화
 *
 * 사용:
 *   node issue-start.mjs fetch 59
 *   node issue-start.mjs worktree 59 --slug fab-tab-active-state
 *   node issue-start.mjs evidence-mirror 59 --push
 *
 * 규칙:
 *   - 워크트리 경로는 ~/.issue/settings.json 의 worktree.layout 이 결정한다.
 *     미결정이면 WORKTREE_LAYOUT_UNSET=1 을 출력하고 exit 2 로 빠진다 (사용자에게 물어야 함).
 *   - 기본 브랜치는 origin/HEAD 로 자동 판별(없으면 main → master)
 *   - 이미 존재하는 브랜치/워크트리는 재사용(멱등)
 *
 * 이슈 백엔드는 ~/.issue/settings.json 의 provider 설정이 정한다 (github 기본 | jira).
 * 트래커 호출은 전부 issue-tracker.mjs 를 거친다. 이 파일은 gh 를 직접 부르지 않는다.
 *
 * 요구사항: git, curl, Node 18+, (github 면 gh 로그인 / jira 면 baseUrl·projectKey·토큰)
 */
import {
  mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, renameSync, readdirSync, cpSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  git, fail, must, repoRoot, currentBranch, isLinkedWorktree, detectRemote, detectBase,
  branchExists, remoteBranchExists, existingWorktreeFor, isIgnored,
  slugify, prefixFromLabels, parseIssueNumber, inferIssue,
  issueDir, evidenceDir, evidenceRel, listEvidence, ensureIgnoreBlock,
  mirrorEvidence, resolveWorktreePath, getWorktreeLayout, syncBaseCheckout, worktreeDisplayPath,
  setTerminalTitle, WORKSPACE_DIR, LEGACY_WORKSPACE_DIR, LEGACY_EVIDENCE_DIR, WORKTREE_LAYOUTS,
} from './issue-common.mjs';
import {
  createTracker, evidenceUrls, gitHost, setTrackerStatus,
} from './issue-tracker.mjs';
import { publishDocumentation } from './issue-docs.mjs';
import {
  collectImageReferences, downloadImageReference, validateEvidenceReport,
} from './issue-media.mjs';
import { runIssueStartPhase } from './issue-start-phase.mjs';

function usage(exitCode = 1) {
  console.error(`Usage:
  node issue-start.mjs fetch <issue-number> [--repo <owner/name>]
  node issue-start.mjs worktree <issue-number> [options]
  node issue-start.mjs guard [--issue <n>]
  node issue-start.mjs evidence-init|evidence-commit|evidence-mirror|evidence-urls|report-check <issue-number> [options]
  node issue-start.mjs migrate [--dry-run]
  node issue-start.mjs sync-base [--base <branch>]

fetch:
  이슈 본문·코멘트·라벨을 .issue/<번호>/issue.json / issue.md 로 저장하고
  본문에 포함된 이미지를 .issue/<번호>/images/ 로 내려받는다.

worktree options:
  --slug <slug>    브랜치 영문 slug (예: fab-tab-active-state). 생략 시 issue-<번호>
  --prefix <p>     브랜치 prefix (fix|feat|docs|chore|refactor). 생략 시 라벨로 추론
  --branch <name>  브랜치 이름 전체를 직접 지정 (--slug/--prefix 무시)
  --base <branch>  분기 기준 브랜치 (기본: origin/HEAD 자동 판별)
  --layout <l>     이번 실행에 한해 배치 강제 (${WORKTREE_LAYOUTS.join('|')})
  --path <dir>     워크트리 경로 직접 지정 (설정을 우회하는 탈출구)
  --dry-run        실행 계획만 출력

evidence options:
  --push           evidence-mirror 에서 push 까지 수행
  --mirrorRef <r>  evidence-urls 에서 쓸 미러 ref
  --repo <o/n>     대상 저장소 (기본: 현재 디렉터리의 origin)
  -h, --help       이 도움말
`);
  process.exit(exitCode);
}

/* ------------------------------------------------------------------ fetch */

export function collectImageUrls(text, sourceUrl) {
  return collectImageReferences([{ text, source: 'text', sourceUrl }])
    .filter((ref) => ref.inline && ref.resolvedUrl)
    .map((ref) => ref.resolvedUrl);
}

export function downloadImage(url, dir, index, auth) {
  return downloadImageReference(url, dir, index, auth);
}

function cmdFetch(number, root, tracker) {
  const issue = tracker.issueView(number);
  if (!issue) fail(`이슈 ${tracker.displayKey(number)} 를 읽지 못했습니다. 번호와 트래커 설정을 확인하세요.`);

  const dir = issueDir(root, number);
  const imagesDir = path.join(dir, 'images');
  mkdirSync(imagesDir, { recursive: true });
  ensureIgnoreBlock(root);

  writeFileSync(path.join(dir, 'issue.json'), `${JSON.stringify(issue, null, 2)}\n`);

  const labels = (issue.labels ?? []).map((l) => l.name);
  const display = issue.key ?? `#${issue.number}`;
  const md = [
    `# ${display} ${issue.title}`,
    '',
    `- 상태: ${issue.state}${issue.statusName ? ` (${issue.statusName})` : ''}`,
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

  const sources = [
    { text: issue.body, source: `${display} 본문`, sourceUrl: issue.url },
    ...(issue.comments ?? []).map((comment, index) => ({
      text: comment.body,
      source: `${display} 댓글 ${index + 1}`,
      sourceUrl: comment.url ?? issue.url,
    })),
  ];
  const references = collectImageReferences(sources);
  const inline = references.filter((ref) => ref.inline);
  const auth = inline.length ? tracker.attachmentAuth() : null;
  const downloads = inline.map((ref, i) => downloadImageReference(ref, imagesDir, i + 1, auth));

  const rel = (p) => {
    const r = path.relative(root, p);
    return r.startsWith('..') ? p : r;
  };
  console.log(`✓ 이슈 ${display} 수집 완료 — ${issue.title}`);
  console.log(`  라벨: ${labels.join(', ') || '(없음)'} / 상태: ${issue.state}`);
  console.log(`  본문: ${rel(path.join(dir, 'issue.md'))}`);
  if (!references.length) console.log('  이미지: 없음');
  for (const d of downloads) {
    if (d.ok) {
      console.log(`  이미지: ${rel(d.path)}  ← ${d.originalUrl} (${d.source})`);
      if (d.warning) console.log(`    경고: ${d.warning}`);
    }
    else {
      console.log(`  이미지 실패: ${d.originalUrl}`);
      console.log(`    위치: ${d.source} / 해석: ${d.resolvedUrl ?? '(실패)'} / 이유: ${d.reason}`);
    }
  }
  for (const ref of references.filter((candidate) => !candidate.inline)) {
    console.log(`  이미지 후보 제외: ${ref.originalUrl}`);
    console.log(`    위치: ${ref.source} / 유형: ${ref.syntax}, ${ref.kind} / 이유: 인라인 이미지 문법이 아님`);
  }
  console.log('');
  console.log(`SUGGESTED_PREFIX=${prefixFromLabels(labels)}`);
  console.log(`ISSUE_DIR=${rel(dir)}`);
  console.log(`IMAGE_FILES=${downloads.filter((d) => d.ok).map((d) => rel(d.path)).join(' ')}`);
}

/* --------------------------------------------------------------- worktree */

function labelsOf(root, number) {
  const file = path.join(issueDir(root, number), 'issue.json');
  if (!existsSync(file)) return [];
  try {
    return (JSON.parse(readFileSync(file, 'utf8')).labels ?? []).map((l) => l.name);
  } catch {
    return [];
  }
}

function cmdWorktree(number, root, opts) {
  const remote = detectRemote(root);
  const base = detectBase(root, remote, opts.base);
  const labels = labelsOf(root, number);
  const slug = slugify(opts.slug || `issue-${number}`);

  const branch = opts.branch || `${opts.prefix || prefixFromLabels(labels)}/${number}-${slug}`;

  let wtPath;
  if (opts.path) {
    wtPath = path.resolve(opts.path);
    const layout = opts.layout || getWorktreeLayout();
    if (layout && wtPath !== resolveWorktreePath(root, number, opts.slug, layout)) {
      console.error(`! 설정(layout=${layout})과 다른 경로를 강제합니다: ${wtPath}`);
    }
  } else {
    const layout = opts.layout || getWorktreeLayout();
    if (!layout) {
      // 배치 방식이 아직 정해지지 않았다. 스킬이 사용자에게 1회 물어 고정해야 한다.
      console.error('✗ 워크트리 배치 방식이 결정되지 않았습니다.');
      console.log('WORKTREE_LAYOUT_UNSET=1');
      console.log(`WORKTREE_LAYOUT_CHOICES=${WORKTREE_LAYOUTS.join(',')}`);
      process.exit(2);
    }
    wtPath = resolveWorktreePath(root, number, opts.slug, layout);

    // children 은 워크트리 사본이 부모 저장소 안에 생긴다.
    // .issue/** 무시가 깨져 있으면 부모에서 git add -A 한 방에 사고가 나므로 먼저 막는다.
    if (layout === 'children') {
      ensureIgnoreBlock(root);
      const probe = path.join(path.relative(root, wtPath).split(path.sep).join('/'), '.git');
      if (!isIgnored(root, probe)) {
        fail(
          `children 배치인데 ${probe} 가 무시되지 않습니다.\n`
          + '  .gitignore 의 .issue 블록을 확인하세요. 이대로 두면 부모 저장소가 워크트리 전체를 추적합니다.',
        );
      }
    }
  }

  const existing = existingWorktreeFor(root, branch);
  console.log([
    `  브랜치 : ${branch}${branchExists(root, branch) ? ' (기존 재사용)' : ` (신규, ${remote}/${base} 기준)`}`,
    `  워크트리: ${wtPath}${existing ? ` (이미 ${existing} 에 연결됨)` : ''}`,
  ].join('\n'));

  if (opts.dryRun) {
    console.log('\n(dry-run) 아무것도 생성하지 않았다.');
    console.log(`WORKTREE_PATH=${wtPath}`);
    console.log(`WORKTREE_DISPLAY=${worktreeDisplayPath(root, wtPath)}`);
    console.log(`BRANCH=${branch}`);
    return;
  }

  if (existing) {
    console.log(`\n✓ 이미 워크트리가 있다: ${existing}`);
    console.log(`WORKTREE_PATH=${existing}`);
    console.log(`WORKTREE_DISPLAY=${worktreeDisplayPath(root, existing)}`);
    console.log(`BRANCH=${branch}`);
    return;
  }
  if (existsSync(wtPath)) {
    console.error(`✗ 경로가 이미 존재한다: ${wtPath} — --path 로 다른 경로를 지정하라.`);
    process.exit(1);
  }

  mkdirSync(path.dirname(wtPath), { recursive: true });
  must('git', ['fetch', remote, base, '--prune'], { cwd: root });

  const addOpts = { cwd: root };
  if (branchExists(root, branch)) {
    must('git', ['worktree', 'add', wtPath, branch], addOpts);
  } else if (remoteBranchExists(root, remote, branch)) {
    must('git', ['worktree', 'add', '--track', '-b', branch, wtPath, `${remote}/${branch}`], addOpts);
  } else {
    must('git', ['worktree', 'add', '-b', branch, wtPath, `${remote}/${base}`], addOpts);
  }

  // .issue/<번호>/ 는 gitignore 대상이라 워크트리로 따라오지 않는다.
  // 복사하지 않으면 워크트리 안에서 plan.md 도 이슈 본문도 읽을 수 없다.
  const copied = carryIssueDir(root, wtPath, number);

  console.log('\n✓ 워크트리 준비 완료');
  if (copied) console.log(`  ${WORKSPACE_DIR}/${number}/ 를 워크트리로 복사했다 (${copied}개 항목)`);
  console.log(`WORKTREE_PATH=${wtPath}`);
  console.log(`WORKTREE_DISPLAY=${worktreeDisplayPath(root, wtPath)}`);
  console.log(`BRANCH=${branch}`);
}

/**
 * 원본 체크아웃의 `.issue/<번호>/` 를 새 워크트리로 옮겨 담는다.
 *
 * evidence/ 는 제외한다. 증거는 워크트리 브랜치에서 새로 만들어 커밋해야 하고,
 * 원본에 남아 있던 이전 회차 증거를 끌고 오면 before/after 가 뒤섞인다.
 */
function carryIssueDir(root, wtPath, number) {
  const src = issueDir(root, number);
  if (!existsSync(src) || path.resolve(src).startsWith(path.resolve(wtPath))) return 0;
  const dest = path.join(wtPath, WORKSPACE_DIR, String(number));

  let count = 0;
  for (const entry of readdirSync(src)) {
    if (entry === 'evidence' || entry === 'pure-tree') continue;
    const to = path.join(dest, entry);
    if (existsSync(to)) continue;
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(path.join(src, entry), to, { recursive: true });
    count += 1;
  }
  return count;
}

/* ------------------------------------------------------------------ guard */

/**
 * 사용자 확인 없이 커밋해도 되는 상태인지 검사한다.
 *
 * issue-start 는 구현 후 묻지 않고 커밋한다. 그 유일한 안전장치가 이 3중 가드다.
 * 하나라도 실패하면 커밋하지 않는다.
 */
function cmdGuard(root, opts) {
  const branch = currentBranch();
  const base = detectBase(root, 'origin', opts.base);
  const issue = opts.issue || inferIssue(branch);

  const checks = {
    isLinkedWorktree: isLinkedWorktree(),
    notOnBaseBranch: Boolean(branch) && branch !== base,
    branchHasIssueNumber: /(?:^|[/_-])\d{1,6}(?:[/_-]|$)/.test(branch || ''),
  };
  const ok = Object.values(checks).every(Boolean);

  console.log(JSON.stringify({
    ok, branch, baseBranch: base, issue, checks,
    reason: ok ? null : '무확인 커밋 조건 미충족 — 사용자에게 확인을 받고 진행하세요.',
  }, null, 2));
  if (!ok) process.exit(3);
}

/* --------------------------------------------------------------- evidence */

function cmdEvidenceInit(number, root) {
  const key = String(number);
  const before = path.join(evidenceDir(root, key), 'before');
  const after = path.join(evidenceDir(root, key), 'after');
  mkdirSync(before, { recursive: true });
  mkdirSync(after, { recursive: true });
  const touched = ensureIgnoreBlock(root);
  console.log(JSON.stringify({ issue: key, before, after, gitignoreUpdated: touched }, null, 2));
}

function checkReport(number, root) {
  const reportFile = path.join(evidenceDir(root, String(number)), 'comment.md');
  if (!existsSync(reportFile)) fail(`리포트가 없습니다: ${path.relative(root, reportFile)}`);
  const repo = gitHost.repoInfo(root);
  return {
    reportFile: path.relative(root, reportFile),
    ...validateEvidenceReport(readFileSync(reportFile, 'utf8'), { isPrivate: Boolean(repo?.isPrivate) }),
  };
}

function cmdReportCheck(number, root) {
  const result = checkReport(number, root);
  console.log(JSON.stringify(result, null, 2));
  // 5 는 "리포트를 고쳐라", 6 은 "사람이 이미지를 올려야 한다". 스킬이 둘을 다르게 처리한다.
  if (!result.ok) process.exit(result.needsManualUpload ? 6 : 5);
}

function cmdEvidenceCommit(number, root) {
  const key = String(number);
  const reportFile = path.join(evidenceDir(root, key), 'comment.md');
  const report = checkReport(number, root);
  if (!report.ok) {
    const head = report.needsManualUpload
      ? 'private 저장소라 이미지를 사람이 올려야 합니다. 아래를 처리한 뒤 다시 실행하세요'
      : '리포트 이미지 검증 실패';
    fail(`${head}:\n- ${report.errors.join('\n- ')}`);
  }
  const docs = publishDocumentation({ root, key, reportFile });
  if (!docs.ok) console.error(`! Confluence 게시 건너뜀: ${docs.warning}`);
  else if (!docs.skipped) console.log(`✓ Confluence 리포트 게시: ${docs.url}`);
  const files = listEvidence(root, key);
  if (files.length === 0) fail(`증거 파일이 없습니다: ${evidenceRel(root, key)}`);
  ensureIgnoreBlock(root);
  const add = git(['add', '-f', '--', evidenceRel(root, key), '.gitignore'], { cwd: root });
  if (add.code !== 0) fail(`git add 실패: ${add.err}`);
  if (git(['diff', '--cached', '--quiet'], { cwd: root }).code === 0) {
    console.log(JSON.stringify({ committed: false, reason: 'no staged change', files }, null, 2));
    return;
  }
  const c = git(['commit', '-m', `docs(issue-${key}): 작업 전후 증거 자료 추가`], { cwd: root });
  if (c.code !== 0) fail(`git commit 실패: ${c.err || c.out}`);
  console.log(JSON.stringify({ committed: true, branch: currentBranch(), files }, null, 2));
}

function cmdEvidenceMirror(number, root, opts) {
  const key = String(number);
  console.log(JSON.stringify(
    mirrorEvidence({ root, key, issue: key, push: Boolean(opts.push), base: opts.base }),
    null, 2,
  ));
}

function cmdEvidenceUrls(number, root, opts) {
  const key = String(number);
  console.log(JSON.stringify(
    evidenceUrls({ root, key, issue: key, branch: currentBranch(), mirrorRef: opts.mirrorRef, base: opts.base }),
    null, 2,
  ));
}

function cmdSyncBase(root, opts) {
  console.log(JSON.stringify(syncBaseCheckout({ root, base: opts.base }), null, 2));
}

/* ---------------------------------------------------------------- migrate */

/** `.issue-start/<n>` → `.issue/<n>`, `.issue-evidence/<k>` → `.issue/<k>/evidence` */
function cmdMigrate(root, opts) {
  const moves = [];
  const tracked = (rel) => git(['ls-files', '--error-unmatch', '--', rel], { cwd: root }).code === 0;

  const move = (fromAbs, toAbs) => {
    const relFrom = path.relative(root, fromAbs).split(path.sep).join('/');
    const relTo = path.relative(root, toAbs).split(path.sep).join('/');
    moves.push({ from: relFrom, to: relTo, exists: existsSync(toAbs) });
    if (opts.dryRun) return;
    mkdirSync(path.dirname(toAbs), { recursive: true });
    if (existsSync(toAbs)) {
      // 대상이 이미 있으면 하위 항목 단위로 병합한다.
      for (const entry of readdirSync(fromAbs)) {
        const src = path.join(fromAbs, entry);
        const dst = path.join(toAbs, entry);
        if (!existsSync(dst)) renameSync(src, dst);
      }
      rmSync(fromAbs, { recursive: true, force: true });
      return;
    }
    if (tracked(relFrom) && git(['mv', relFrom, relTo], { cwd: root }).code === 0) return;
    renameSync(fromAbs, toAbs);
  };

  const legacyWorkspace = path.join(root, LEGACY_WORKSPACE_DIR);
  if (existsSync(legacyWorkspace)) {
    for (const key of readdirSync(legacyWorkspace)) {
      move(path.join(legacyWorkspace, key), path.join(root, WORKSPACE_DIR, key));
    }
    if (!opts.dryRun) rmSync(legacyWorkspace, { recursive: true, force: true });
  }

  const legacyEvidence = path.join(root, LEGACY_EVIDENCE_DIR);
  if (existsSync(legacyEvidence)) {
    for (const key of readdirSync(legacyEvidence)) {
      move(path.join(legacyEvidence, key), path.join(root, WORKSPACE_DIR, key, 'evidence'));
    }
    if (!opts.dryRun) rmSync(legacyEvidence, { recursive: true, force: true });
  }

  const gitignoreUpdated = opts.dryRun ? null : ensureIgnoreBlock(root);
  console.log(JSON.stringify({ dryRun: Boolean(opts.dryRun), moves, gitignoreUpdated }, null, 2));
}

/* ------------------------------------------------------------------- main */

const NEEDS_NUMBER = new Set([
  'fetch', 'worktree', 'evidence-init', 'evidence-commit', 'evidence-mirror', 'evidence-urls', 'report-check',
]);
const MODES = new Set([...NEEDS_NUMBER, 'guard', 'migrate', 'sync-base', 'status']);

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === 'phase') {
    process.exitCode = runIssueStartPhase(argv.slice(1), process.argv[1]);
    return;
  }
  if (!argv.length || argv.includes('-h') || argv.includes('--help')) usage(argv.length ? 0 : 1);

  const mode = argv[0];
  if (!MODES.has(mode)) {
    console.error(`✗ 알 수 없는 모드: ${mode}`);
    usage();
  }

  if (mode === 'status') {
    const number = parseIssueNumber(argv[1]);
    const status = argv[2];
    const repoIndex = argv.indexOf('--repo');
    const repo = repoIndex === -1 ? undefined : argv[repoIndex + 1];
    const result = setTrackerStatus(createTracker(repoRoot(), { repo }), number, status);
    if (!result.status) { console.error(`✗ 상태 전환 실패: ${result.err}`); process.exit(2); }
    if (!result.ok) console.log('STATUS_FAILED=1');
    return;
  }

  const opts = { dryRun: false };
  let number = null;
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--no-status') opts.noStatus = true;
    else if (arg === '--push') opts.push = true;
    else if (arg === '--slug') opts.slug = argv[++i];
    else if (arg === '--prefix') opts.prefix = argv[++i];
    else if (arg === '--branch') opts.branch = argv[++i];
    else if (arg === '--base') opts.base = argv[++i];
    else if (arg === '--path') opts.path = argv[++i];
    else if (arg === '--layout') opts.layout = argv[++i];
    else if (arg === '--repo') opts.repo = argv[++i];
    else if (arg === '--issue') number = parseIssueNumber(argv[++i]);
    else if (arg === '--mirrorRef') opts.mirrorRef = argv[++i];
    else if (arg.startsWith('-')) {
      console.error(`✗ 알 수 없는 옵션: ${arg}`);
      usage();
    } else number = parseIssueNumber(arg);
  }

  if (opts.layout && !WORKTREE_LAYOUTS.includes(opts.layout)) {
    fail(`알 수 없는 배치: ${opts.layout} (가능: ${WORKTREE_LAYOUTS.join(', ')})`);
  }
  if (NEEDS_NUMBER.has(mode) && !number) {
    console.error('✗ 이슈 번호가 필요하다 (예: 59, #59, 이슈 URL)');
    usage();
  }

  const root = repoRoot();
  switch (mode) {
    case 'fetch': {
      setTerminalTitle(`#${number}`);
      const tracker = createTracker(root, { repo: opts.repo });
      const auth = tracker.provider === 'jira' ? tracker.auth() : { ok: true };
      if (!auth.ok) {
        console.error(`✗ ${tracker.provider} 인증 실패: ${auth.detail}`);
        if (auth.hint) console.error(`  ${auth.hint}`);
        process.exit(4);
      }
      cmdFetch(number, root, tracker);
      if (!opts.noStatus && !opts.dryRun) setTrackerStatus(tracker, number, 'plan', { quiet: true });
      break;
    }
    case 'worktree': {
      cmdWorktree(number, root, opts);
      if (!opts.noStatus && !opts.dryRun) {
        setTrackerStatus(createTracker(root, { repo: opts.repo }), number, 'in-process', { quiet: true });
      }
      break;
    }
    case 'guard': cmdGuard(root, { ...opts, issue: number }); break;
    case 'evidence-init': cmdEvidenceInit(number, root); break;
    case 'evidence-commit': cmdEvidenceCommit(number, root); break;
    case 'evidence-mirror': cmdEvidenceMirror(number, root, opts); break;
    case 'evidence-urls': cmdEvidenceUrls(number, root, opts); break;
    case 'report-check': cmdReportCheck(number, root); break;
    case 'migrate': cmdMigrate(root, opts); break;
    case 'sync-base': cmdSyncBase(root, opts); break;
    default: usage();
  }
}

/**
 * 이 파일이 직접 실행된 진입점인지 판별한다.
 *
 * 경로 문자열끼리 비교한다. `file://` 를 손으로 이어붙이면 공백·특수문자가 든 경로에서
 * 퍼센트 인코딩이 빠져 어긋나므로 fileURLToPath 를 쓴다.
 *
 * 심볼릭 링크로 설치된 스킬(`~/.claude/skills/<name>` → 저장소)에서는 두 값의 기준이 다르다.
 * Node ESM 로더는 모듈 URL 을 realpath 로 정규화하는 반면 `process.argv[1]` 은 링크 경로
 * 그대로다. 그래서 **양쪽 모두** realpath 로 풀어 비교한다. 한쪽만 풀면
 * `--preserve-symlinks-main` 으로 실행할 때 반대 방향으로 다시 어긋난다.
 */
function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const here = fileURLToPath(metaUrl);
  const resolved = path.resolve(entry);
  if (here === resolved) return true;   // 일반 실행 — 파일시스템 접근 없이 끝난다
  try {
    return realpathSync(here) === realpathSync(resolved);
  } catch {
    // 같은 경로였다면 위에서 이미 true 다. 여기서 실패했다면 진입점이 아니다.
    return false;
  }
}

if (isMainModule(import.meta.url)) main();
