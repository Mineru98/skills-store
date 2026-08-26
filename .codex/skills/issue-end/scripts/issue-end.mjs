#!/usr/bin/env node
/**
 * issue-end.mjs — 이슈 마무리 자동화(저장소 비종속).
 *
 * 서브커맨드
 *   context                     현재 상황 판단(워크트리 / 브랜치 / 이슈 / PR / 증거 완결성)을 JSON 으로 출력
 *   init      [--issue <n>]     증거 디렉터리(before/after) 생성 + .gitignore 블록 보장
 *   commit    [--issue <n>]     현재 브랜치에 증거 파일을 강제 add 하고 커밋
 *   mirror    [--issue <n>]     기본 브랜치 사본에 증거만 커밋. push 실패 시 evidence 브랜치 폴백
 *   urls      [--issue <n>]     이슈 코멘트에 붙일 raw 이미지 URL 출력
 *   pure-tree [--issue <n>]     변경 직전 상태의 detached 워크트리를 만든다 (before 재캡처용)
 *
 * 공통 옵션
 *   --issue <n>   이슈 번호. 생략 시 브랜치 이름에서 추론, 그래도 없으면 브랜치 slug 사용
 *
 * mirror 옵션
 *   --push        push 까지 수행(기본은 로컬 커밋만)
 *   --base <br>   기준 브랜치 고정 (기본: origin/HEAD 자동 판별)
 *
 * urls 옵션
 *   --mirrorRef <ref>  mirror 출력의 mirrorRef 를 그대로 넘긴다(폴백 시 base 가 아니다)
 *
 * pure-tree 옵션
 *   --ref <ref>   기준 ref 고정 (기본: git merge-base origin/<base> HEAD)
 *   --remove      만들어 둔 pure 워크트리를 정리한다
 *
 * 증거는 .issue/<key>/evidence/ 에 쌓이고, 이 경로만 .gitignore 예외로 커밋된다.
 *
 * 이슈 백엔드는 ~/.issue/settings.json 의 provider 설정이 정한다 (github 기본 | jira).
 * PR 은 코드 호스트(GitHub) 의 것이라 트래커와 무관하게 gitHost 를 쓴다.
 *
 * 요구사항: git, Node 18+, (github 면 gh 로그인 / jira 면 baseUrl·projectKey·토큰)
 */
import {
  mkdirSync, existsSync, readFileSync, rmSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  git, fail, parseArgs, repoRoot, currentBranch, isLinkedWorktree, detectBase,
  evidenceKey, evidenceDir, evidenceRel, listEvidence, ensureIgnoreBlock,
  mirrorEvidence, listWorktrees, issueDir, WORKSPACE_DIR, syncBaseCheckout,
} from './issue-common.mjs';
import { createTracker, gitHost, evidenceUrls, setTrackerStatus } from './issue-tracker.mjs';
import { publishDocumentation } from './issue-docs.mjs';
import { validateEvidenceReport } from './issue-media.mjs';
import {
  PHASE_API_VERSION,
  PHASE_CONTRACT_ID,
  canonicalJsonBytes,
  parseCanonicalJson,
  phaseApprovalId,
  validatePhaseEnvelope,
} from './issue-phase-contract.mjs';
import { gateAction, ontologyStatus } from './issue-ontology.mjs';

const USAGE = `Usage: node issue-end.mjs <context|init|commit|mirror|urls|report-check|ontology-guard|pure-tree|sync-base|status> [options]

  --issue <n>        이슈 번호 (생략 시 브랜치에서 추론)
  --base <branch>    기준 브랜치 고정
  --push             mirror 에서 push 까지 수행
  --mirrorRef <ref>  urls 에서 쓸 미러 ref
  --ref <ref>        pure-tree 기준 ref
  --remove           pure-tree 정리`;

/** before/after 각각에 파일이 있는지 — 증거 완결성 판단의 근거 */
function evidenceSummary(root, key) {
  const files = listEvidence(root, key);
  const phase = (p) => (p.includes('/before/') ? 'before' : p.includes('/after/') ? 'after' : 'other');
  return {
    total: files.length,
    before: files.filter((f) => phase(f) === 'before').length,
    after: files.filter((f) => phase(f) === 'after').length,
    hasComment: files.some((f) => f.endsWith('/comment.md')),
    files,
  };
}

/** 로컬 증거가 원격 기본/폴백 브랜치에 같은 blob으로 게시됐는지 확인한다. */
function evidencePublication(root, key, base, evidence) {
  const fallback = `evidence/issue-${key}`;
  git(['fetch', 'origin', base, '--prune'], { cwd: root });
  git([
    'fetch', 'origin',
    `refs/heads/${fallback}:refs/remotes/origin/${fallback}`,
  ], { cwd: root });

  const checked = [`origin/${base}`, `origin/${fallback}`]
    .filter((ref) => git(['rev-parse', '--verify', ref], { cwd: root }).code === 0)
    .map((ref) => {
      const missing = [];
      const changed = [];
      let matched = 0;
      for (const file of evidence.files) {
        const local = git(['hash-object', '--', file], { cwd: root });
        const remote = git(['rev-parse', '--verify', `${ref}:${file}`], { cwd: root });
        if (remote.code !== 0) missing.push(file);
        else if (local.code !== 0 || local.out !== remote.out) changed.push(file);
        else matched += 1;
      }
      return {
        ref: ref.replace(/^origin\//, ''),
        matched,
        missing,
        changed,
        published: evidence.files.length > 0
          && missing.length === 0
          && changed.length === 0,
      };
    });
  const published = checked.find((candidate) => candidate.published);
  return {
    published: Boolean(published),
    ref: published?.ref ?? null,
    checked,
  };
}

function pureTreePath(root, key) {
  return path.join(root, WORKSPACE_DIR, String(key), 'pure-tree');
}

// ---------------------------------------------------------------- commands

function cmdContext(args) {
  const root = repoRoot();
  const branch = currentBranch();
  const base = detectBase(root, 'origin', args.base);
  const { key, issue } = evidenceKey(args, branch);
  const repo = gitHost.repoInfo(root);
  const tracker = createTracker(root);
  const trackerAuth = tracker.auth();
  const evidence = evidenceSummary(root, key);
  const publication = evidencePublication(root, key, base, evidence);

  const ctx = {
    repoRoot: root,
    repo: repo?.nameWithOwner ?? null,
    isPrivate: repo?.isPrivate ?? null,
    isLinkedWorktree: isLinkedWorktree(),
    branch,
    baseBranch: base,
    onBaseBranch: branch === base,
    issue,
    issueSource: args.issue ? 'argument' : issue ? 'branch-name' : null,
    evidenceKey: key,
    evidenceDir: evidenceRel(root, key),
    evidence,
    // 증거가 부족하면 issue-end 는 PR 로 넘어가지 않고 재캡처부터 해야 한다.
    evidenceComplete: evidence.before > 0 && evidence.after > 0,
    // issue-start가 게시한 증거와 로컬 증거가 같아야 승인 뒤 PR로 바로 넘어갈 수 있다.
    evidencePublished: publication.published,
    evidencePublishedRef: publication.ref,
    evidencePublication: publication,
    dirty: git(['status', '--porcelain']).out.split('\n').filter(Boolean).length,
    ahead: null,
    upstream: git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).out || null,
    provider: tracker.provider,
    trackerAuth: trackerAuth.ok,
    trackerAuthDetail: trackerAuth.ok ? null : trackerAuth.detail,
    // 하위호환: 기존 소비자가 ghAuth 를 읽는다. github 트래커면 같은 값이다.
    ghAuth: gitHost.auth().ok,
    issueState: null,
    issueTitle: null,
    issueUrl: null,
    openPr: null,
    pureTree: existsSync(pureTreePath(root, key)) ? pureTreePath(root, key) : null,
    worktrees: listWorktrees(root),
  };

  if (ctx.upstream) {
    const c = git(['rev-list', '--count', `${ctx.upstream}..HEAD`]);
    ctx.ahead = c.code === 0 ? Number(c.out) : null;
  }

  if (ctx.trackerAuth && issue) {
    const j = tracker.issueView(issue);
    if (j) {
      ctx.issueState = j.state;
      ctx.issueTitle = j.title;
      ctx.issueUrl = j.url;
      ctx.issueKey = j.key;
    }
  }

  // PR 은 코드 호스트 소관이다. 트래커가 Jira 여도 여기는 GitHub 을 본다.
  if (ctx.ghAuth && branch) {
    ctx.openPr = gitHost.prForBranch(branch);
  }

  console.log(JSON.stringify(ctx, null, 2));
}

function cmdInit(args) {
  const root = repoRoot();
  const { key, issue } = evidenceKey(args, currentBranch());
  const before = path.join(evidenceDir(root, key), 'before');
  const after = path.join(evidenceDir(root, key), 'after');
  mkdirSync(before, { recursive: true });
  mkdirSync(after, { recursive: true });
  const touched = ensureIgnoreBlock(root);
  console.log(JSON.stringify({
    issue, evidenceKey: key, issueDir: issueDir(root, key), before, after, gitignoreUpdated: touched,
  }, null, 2));
}

function checkReport(root, key) {
  const reportFile = path.join(evidenceDir(root, key), 'comment.md');
  if (!existsSync(reportFile)) fail(`리포트가 없습니다: ${path.relative(root, reportFile)}`);
  const repo = gitHost.repoInfo(root);
  return {
    reportFile: path.relative(root, reportFile),
    ...validateEvidenceReport(readFileSync(reportFile, 'utf8'), { isPrivate: Boolean(repo?.isPrivate) }),
  };
}

function cmdReportCheck(args) {
  const root = repoRoot();
  const { key } = evidenceKey(args, currentBranch());
  const result = checkReport(root, key);
  console.log(JSON.stringify(result, null, 2));
  // 5 는 "리포트를 고쳐라", 6 은 "사람이 이미지를 올려야 한다". 스킬이 둘을 다르게 처리한다.
  if (!result.ok) process.exit(result.needsManualUpload ? 6 : 5);
}

function cmdCommit(args) {
  const root = repoRoot();
  const { key, issue } = evidenceKey(args, currentBranch());
  const reportFile = path.join(evidenceDir(root, key), 'comment.md');
  const report = checkReport(root, key);
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
  const subject = issue
    ? `docs(issue-${issue}): 작업 전후 증거 자료 추가`
    : `docs(evidence): ${key} 작업 전후 증거 자료 추가`;
  const c = git(['commit', '-m', subject], { cwd: root });
  if (c.code !== 0) fail(`git commit 실패: ${c.err || c.out}`);
  console.log(JSON.stringify({ committed: true, branch: currentBranch(), files }, null, 2));
}

function cmdMirror(args) {
  const root = repoRoot();
  const { key, issue } = evidenceKey(args, currentBranch());
  const result = mirrorEvidence({ root, key, issue, push: Boolean(args.push), base: args.base });
  console.log(JSON.stringify(result, null, 2));
}

function cmdUrls(args) {
  const root = repoRoot();
  const branch = currentBranch();
  const { key, issue } = evidenceKey(args, branch);
  console.log(JSON.stringify(
    evidenceUrls({ root, key, issue, branch, mirrorRef: args.mirrorRef, base: args.base }),
    null, 2,
  ));
}

function cmdSyncBase(args) {
  const root = repoRoot();
  console.log(JSON.stringify(syncBaseCheckout({ root, base: args.base }), null, 2));
}

function cmdStatus(args) {
  const root = repoRoot();
  const number = args._[0] ?? args.issue;
  const result = setTrackerStatus(createTracker(root, { repo: args.repo }), number, args._[1], { dryRun: args.dryRun });
  if (!result.status) { console.error(`✗ 상태 전환 실패: ${result.err}`); process.exit(2); }
  if (!result.ok) console.log('STATUS_FAILED=1');
}

/**
 * 변경 직전 상태의 detached 워크트리를 만든다.
 *
 * git stash 를 쓰지 않는 이유: 실패하면 사용자의 작업이 stash 에 갇히고,
 * 실행 중인 dev server 발밑에서 파일이 바뀌어 캡처가 오염된다.
 * 워크트리는 순수 추가 연산이라 실패해도 원복이 필요 없다.
 *
 * 기준은 브랜치 tip 이 아니라 merge-base 다. 그래야 "내 변경 직전"이 된다.
 */
function cmdPureTree(args) {
  const root = repoRoot();
  const { key } = evidenceKey(args, currentBranch());
  const target = pureTreePath(root, key);

  if (args.remove) {
    git(['worktree', 'remove', '--force', target], { cwd: root });
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    console.log(JSON.stringify({ removed: true, path: target }, null, 2));
    return;
  }

  if (existsSync(target)) {
    console.log(JSON.stringify({ path: target, created: false, reason: 'already exists' }, null, 2));
    return;
  }

  const base = detectBase(root, 'origin', args.base);
  git(['fetch', 'origin', base, '--prune'], { cwd: root });

  let ref = args.ref;
  if (!ref) {
    const mb = git(['merge-base', `origin/${base}`, 'HEAD'], { cwd: root });
    if (mb.code !== 0) fail(`merge-base 판별 실패: ${mb.err}`);
    ref = mb.out;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  const add = git(['worktree', 'add', '--detach', target, ref], { cwd: root });
  if (add.code !== 0) fail(`pure 워크트리 생성 실패: ${add.err}`);

  console.log(JSON.stringify({
    path: target,
    created: true,
    ref,
    base,
    note: '캡처가 끝나면 `pure-tree --remove` 로 정리하세요. 이 경로는 .issue/** 로 무시됩니다.',
  }, null, 2));
}

function cmdOntologyGuard(args) {
  const root = repoRoot();
  const status = ontologyStatus();
  if (!status.available) {
    if (args['skip-ok']) console.log('ONTOLOGY_SKIPPED=1');
    return;
  }

  const { key, issue } = evidenceKey(args, currentBranch());
  const tracker = createTracker(root);
  const trackerAuth = tracker.auth();
  const evidence = evidenceSummary(root, key);
  const guard = gateAction('end', {
    gitRepo: git(['rev-parse', '--show-toplevel'], { cwd: root }).code === 0,
    trackerAuth: trackerAuth.ok,
    issueExists: Boolean(issue),
    evidenceComplete: evidence.before > 0 && evidence.after > 0,
  });
  if (!guard.ok) {
    console.error('✗ end 온톨로지 guard 실패: ' + guard.error);
    process.exit(2);
  }
  console.log('ONTOLOGY_VALID=1');
}

function failedOntologyEnvelope(request, message) {
  return validatePhaseEnvelope({
    apiVersion: PHASE_API_VERSION,
    contractId: PHASE_CONTRACT_ID,
    phaseId: request.phaseId,
    checkpoint: request.checkpoint,
    ok: false,
    data: {},
    observedFacts: [],
    proposedEffect: null,
    handback: { disposition: 'failed', resume: 'none', retry: 'never' },
    error: { code: 'ONTOLOGY_GUARD', message, retryable: false },
  });
}

function phaseOntologyFailure(request) {
  if (ontologyStatus().available === false) return null;
  const root = repoRoot();
  const { key, issue } = evidenceKey({}, currentBranch(root));
  const trackerAuth = createTracker(root).auth();
  const evidence = evidenceSummary(root, key);
  const guard = gateAction('end', {
    gitRepo: git(['rev-parse', '--show-toplevel'], { cwd: root }).code === 0,
    trackerAuth: trackerAuth.ok,
    issueExists: Boolean(issue),
    evidenceComplete: evidence.before > 0 && evidence.after > 0,
  });
  return guard.ok ? null : failedOntologyEnvelope(request, guard.error);
}

// ---------------------------------------------------------------- machine phase API

const ISSUE_END_PHASE_CONTRACT_ID = 'issue-end-phase-api-v1';
const ISSUE_END_PHASE_IDS = new Set([
  'issue-end.context',
  'issue-end.approval-evidence',
  'issue-end.before-recapture',
  'issue-end.after-recapture',
  'issue-end.report',
  'issue-end.publish-evidence',
  'issue-end.sync-base',
  'issue-end.comment',
  'issue-end.review-approval',
  'issue-end.pr',
  'issue-end.handback',
]);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireExactKeys(value, keys, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly: ${expected.join(', ')}`);
  }
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`);
}

function requireString(value, label, pattern) {
  if (typeof value !== 'string' || value.length === 0 || (pattern && !pattern.test(value))) {
    throw new Error(`${label} is invalid`);
  }
}

function requireNullableRecord(value, label, keys) {
  if (value === null) return;
  requireExactKeys(value, keys, label);
}

function parsePhaseRequest(file) {
  if (!path.isAbsolute(file ?? '')) throw new Error('--request must be an absolute JSON path');
  const request = parseCanonicalJson(readFileSync(file));
  requireExactKeys(
    request,
    ['apiVersion', 'contractId', 'phaseId', 'checkpoint', 'input'],
    'request',
  );
  if (request.apiVersion !== PHASE_API_VERSION) throw new Error('unsupported apiVersion');
  if (request.contractId !== ISSUE_END_PHASE_CONTRACT_ID) throw new Error('unsupported contractId');
  if (!ISSUE_END_PHASE_IDS.has(request.phaseId)) throw new Error('unknown issue-end phaseId');
  requireExactKeys(request.checkpoint, ['id', 'owner', 'attempt'], 'checkpoint');
  requireString(request.checkpoint.id, 'checkpoint.id');
  if (request.checkpoint.owner !== 'issue-end') throw new Error('checkpoint.owner must be issue-end');
  if (!Number.isSafeInteger(request.checkpoint.attempt) || request.checkpoint.attempt < 1) {
    throw new Error('checkpoint.attempt must be a positive safe integer');
  }
  if (!isRecord(request.input)) throw new Error('input must be an object');
  return request;
}

const completed = (request, data, observedFacts = []) => validatePhaseEnvelope({
  apiVersion: PHASE_API_VERSION,
  contractId: PHASE_CONTRACT_ID,
  phaseId: request.phaseId,
  checkpoint: request.checkpoint,
  ok: true,
  data,
  observedFacts,
  proposedEffect: null,
  handback: { disposition: 'complete', resume: 'next', retry: 'never' },
  error: null,
});

const held = (request, data, proposedEffect = null, observedFacts = []) => validatePhaseEnvelope({
  apiVersion: PHASE_API_VERSION,
  contractId: PHASE_CONTRACT_ID,
  phaseId: request.phaseId,
  checkpoint: request.checkpoint,
  ok: true,
  data,
  observedFacts,
  proposedEffect,
  handback: { disposition: 'held', resume: 'same', retry: 'reconcile' },
  error: null,
});

const approvalEffect = (request, suffix, type, effectRequest) => {
  const proposed = {
    classification: 'approval-required',
    request: effectRequest,
    type,
  };
  return {
    approvalId: phaseApprovalId({
      checkpoint: request.checkpoint,
      effect: proposed,
      immutableState: { phaseId: request.phaseId, suffix },
      namespace: 'issue-end',
    }),
    ...proposed,
  };
};

const localEffect = (type, effectRequest) => ({
  approvalId: null,
  classification: 'local-idempotent',
  request: effectRequest,
  type,
});

function phaseContext(request) {
  const input = request.input;
  requireExactKeys(input, [
    'branch', 'dirty', 'expectedHeadSha', 'headSha', 'isLinkedWorktree', 'issue', 'openPr',
  ], 'input');
  requireString(input.branch, 'input.branch');
  requireBoolean(input.dirty, 'input.dirty');
  requireString(input.expectedHeadSha, 'input.expectedHeadSha', /^[0-9a-f]{40}$/);
  requireString(input.headSha, 'input.headSha', /^[0-9a-f]{40}$/);
  requireBoolean(input.isLinkedWorktree, 'input.isLinkedWorktree');
  if (!Number.isSafeInteger(input.issue) || input.issue < 1) throw new Error('input.issue is invalid');
  requireNullableRecord(input.openPr, 'input.openPr', ['headSha', 'number', 'url']);
  if (input.openPr !== null) {
    requireString(input.openPr.headSha, 'input.openPr.headSha', /^[0-9a-f]{40}$/);
    if (!Number.isSafeInteger(input.openPr.number) || input.openPr.number < 1) {
      throw new Error('input.openPr.number is invalid');
    }
    requireString(input.openPr.url, 'input.openPr.url');
  }
  const observedFacts = [
    { kind: 'head-sha', value: input.headSha },
    { kind: 'issue', value: input.issue },
  ];
  if (!input.isLinkedWorktree) {
    return held(request, { reason: 'linked-worktree-required' }, null, observedFacts);
  }
  if (input.dirty) return held(request, { reason: 'dirty-worktree' }, null, observedFacts);
  if (input.headSha !== input.expectedHeadSha) {
    return held(request, { reason: 'stale-head' }, null, observedFacts);
  }
  return completed(request, {
    branch: input.branch,
    issue: input.issue,
    openPr: input.openPr,
  }, observedFacts);
}

function phaseApprovalEvidence(request) {
  const input = request.input;
  requireExactKeys(input, [
    'evidenceChanged', 'evidenceComplete', 'evidencePublished', 'humanEvidenceApproved',
  ], 'input');
  for (const key of Object.keys(input)) requireBoolean(input[key], `input.${key}`);
  if (!input.humanEvidenceApproved) {
    return held(request, { reason: 'human-evidence-approval-required' });
  }
  return completed(request, {
    beforeRecaptureRequired: !input.evidenceComplete,
    evidencePublicationRequired: !input.evidencePublished || input.evidenceChanged,
    reconciliation: input.evidenceComplete
      && input.evidencePublished && !input.evidenceChanged ? 'published-current' : 'repair-required',
  });
}

function phaseBeforeRecapture(request) {
  const input = request.input;
  requireExactKeys(input, ['beforeCaptured', 'pureTreeReady', 'required'], 'input');
  for (const key of Object.keys(input)) requireBoolean(input[key], `input.${key}`);
  if (!input.required) return completed(request, { skipped: true });
  if (!input.pureTreeReady) {
    return held(request, { reason: 'pure-tree-required' }, localEffect('pure-tree-create', {
      command: 'pure-tree',
    }));
  }
  if (!input.beforeCaptured) {
    return held(request, { reason: 'before-capture-required' }, localEffect('before-capture', {
      source: 'pure-tree',
    }));
  }
  return completed(request, { recaptured: true });
}

function phaseAfterRecapture(request) {
  const input = request.input;
  requireExactKeys(input, ['afterCaptured', 'required'], 'input');
  requireBoolean(input.afterCaptured, 'input.afterCaptured');
  requireBoolean(input.required, 'input.required');
  if (!input.required) return completed(request, { skipped: true });
  if (!input.afterCaptured) {
    return held(request, { reason: 'after-capture-required' }, localEffect('after-capture', {
      source: 'current-head',
    }));
  }
  return completed(request, { recaptured: true });
}

function phaseReport(request) {
  const input = request.input;
  requireExactKeys(input, [
    'humanReportApproved', 'reportDigest', 'reportPresent', 'reportValid',
  ], 'input');
  requireBoolean(input.humanReportApproved, 'input.humanReportApproved');
  requireString(input.reportDigest, 'input.reportDigest', /^[0-9a-f]{64}$/);
  requireBoolean(input.reportPresent, 'input.reportPresent');
  requireBoolean(input.reportValid, 'input.reportValid');
  if (!input.reportPresent) return held(request, { reason: 'report-missing' });
  if (!input.reportValid) return held(request, { reason: 'report-invalid' });
  if (!input.humanReportApproved) return held(request, { reason: 'human-report-approval-required' });
  return completed(request, { reportDigest: input.reportDigest });
}

function phasePublishEvidence(request) {
  const input = request.input;
  requireExactKeys(input, [
    'branchPushApproved', 'branchPushed', 'evidencePublished', 'headSha', 'required',
  ], 'input');
  requireBoolean(input.branchPushApproved, 'input.branchPushApproved');
  requireBoolean(input.branchPushed, 'input.branchPushed');
  requireBoolean(input.evidencePublished, 'input.evidencePublished');
  requireString(input.headSha, 'input.headSha', /^[0-9a-f]{40}$/);
  requireBoolean(input.required, 'input.required');
  if (!input.required || input.evidencePublished) {
    return completed(request, { suppressed: true });
  }
  if (!input.branchPushApproved) {
    return held(request, { reason: 'branch-push-approval-required' }, approvalEffect(
      request,
      'branch-push',
      'branch-push',
      { command: 'mirror', headSha: input.headSha, push: true },
    ));
  }
  if (!input.branchPushed) {
    return held(request, { reason: 'branch-push-not-observed' });
  }
  return held(request, { reason: 'evidence-publication-not-reconciled' });
}

function phaseSyncBase(request) {
  const input = request.input;
  requireExactKeys(input, ['baseSynced', 'blocked', 'required'], 'input');
  requireBoolean(input.baseSynced, 'input.baseSynced');
  requireBoolean(input.blocked, 'input.blocked');
  requireBoolean(input.required, 'input.required');
  if (!input.required) return completed(request, { skipped: true });
  if (input.blocked) return held(request, { reason: 'base-sync-blocked' });
  if (!input.baseSynced) {
    return held(request, { reason: 'base-sync-required' }, localEffect('sync-base', {
      command: 'sync-base',
    }));
  }
  return completed(request, { synced: true });
}

function phaseComment(request) {
  const input = request.input;
  requireExactKeys(input, ['commentPublished', 'evidencePublished', 'required'], 'input');
  requireBoolean(input.commentPublished, 'input.commentPublished');
  requireBoolean(input.evidencePublished, 'input.evidencePublished');
  requireBoolean(input.required, 'input.required');
  if (!input.required) {
    return completed(request, { suppressed: true });
  }
  if (!input.commentPublished) {
    return held(request, { reason: 'comment-publication-approval-required' }, approvalEffect(
      request,
      'comment',
      'tracker-comment',
      { command: 'issue-comment' },
    ));
  }
  return completed(request, { published: true });
}

function phaseReviewApproval(request) {
  const input = request.input;
  requireExactKeys(input, ['reportApproved', 'reportDigest', 'reviewApproved'], 'input');
  requireBoolean(input.reportApproved, 'input.reportApproved');
  requireString(input.reportDigest, 'input.reportDigest', /^[0-9a-f]{64}$/);
  requireBoolean(input.reviewApproved, 'input.reviewApproved');
  if (!input.reportApproved) return held(request, { reason: 'report-approval-required' });
  if (!input.reviewApproved) {
    return held(request, { reason: 'review-approval-required' }, approvalEffect(
      request,
      'review',
      'review-approval',
      { reportDigest: input.reportDigest },
    ));
  }
  return completed(request, { reportDigest: input.reportDigest, reviewApproved: true });
}

function validateOpenPr(openPr) {
  requireNullableRecord(openPr, 'input.openPr', ['headSha', 'number', 'url']);
  if (openPr === null) return;
  requireString(openPr.headSha, 'input.openPr.headSha', /^[0-9a-f]{40}$/);
  if (!Number.isSafeInteger(openPr.number) || openPr.number < 1) {
    throw new Error('input.openPr.number is invalid');
  }
  requireString(openPr.url, 'input.openPr.url');
}

function phasePr(request) {
  const input = request.input;
  requireExactKeys(input, [
    'branchPushed', 'expectedHeadSha', 'headSha', 'openPr', 'prCreateApproved',
    'reviewApproved', 'statusReview',
  ], 'input');
  requireBoolean(input.branchPushed, 'input.branchPushed');
  requireString(input.expectedHeadSha, 'input.expectedHeadSha', /^[0-9a-f]{40}$/);
  requireString(input.headSha, 'input.headSha', /^[0-9a-f]{40}$/);
  validateOpenPr(input.openPr);
  requireBoolean(input.prCreateApproved, 'input.prCreateApproved');
  requireBoolean(input.reviewApproved, 'input.reviewApproved');
  requireBoolean(input.statusReview, 'input.statusReview');
  if (!input.reviewApproved) return held(request, { reason: 'review-approval-required' });
  if (!input.branchPushed) return held(request, { reason: 'branch-push-required' });
  if (input.headSha !== input.expectedHeadSha) return held(request, { reason: 'stale-head' });
  if (input.openPr !== null && input.openPr.headSha !== input.headSha) {
    return held(request, { reason: 'stale-pr-head' });
  }
  if (input.openPr === null && input.prCreateApproved) {
    return held(request, { reason: 'pr-outcome-uncertain' });
  }
  if (input.openPr === null) {
    return held(request, { reason: 'pr-create-approval-required' }, approvalEffect(
      request,
      'pr-create',
      'pr-create',
      { headSha: input.headSha, relatedIssueMode: 'related-only' },
    ));
  }
  if (!input.statusReview) {
    return held(request, {
      pr: input.openPr,
      reason: 'status-review-required',
    }, localEffect('status-review', {
      command: 'status',
      status: 'review',
    }));
  }
  return completed(request, { adoptedPr: input.openPr, status: 'review' });
}

function phaseHandback(request) {
  const input = request.input;
  requireExactKeys(input, ['nextActions', 'pr', 'statusReview'], 'input');
  if (!Array.isArray(input.nextActions)
    || input.nextActions.length !== 4
    || input.nextActions.some((action) => typeof action !== 'string')) {
    throw new Error('input.nextActions must contain four strings');
  }
  requireExactKeys(input.pr, ['number', 'url'], 'input.pr');
  if (!Number.isSafeInteger(input.pr.number) || input.pr.number < 1) {
    throw new Error('input.pr.number is invalid');
  }
  requireString(input.pr.url, 'input.pr.url');
  requireBoolean(input.statusReview, 'input.statusReview');
  if (!input.statusReview) return held(request, { reason: 'status-review-required' });
  return completed(request, { nextActions: input.nextActions, pr: input.pr, status: 'review' });
}

const PHASE_HANDLERS = {
  'issue-end.context': phaseContext,
  'issue-end.approval-evidence': phaseApprovalEvidence,
  'issue-end.before-recapture': phaseBeforeRecapture,
  'issue-end.after-recapture': phaseAfterRecapture,
  'issue-end.report': phaseReport,
  'issue-end.publish-evidence': phasePublishEvidence,
  'issue-end.sync-base': phaseSyncBase,
  'issue-end.comment': phaseComment,
  'issue-end.review-approval': phaseReviewApproval,
  'issue-end.pr': phasePr,
  'issue-end.handback': phaseHandback,
};

function cmdPhase(args) {
  try {
    const request = parsePhaseRequest(args.request);
    let envelope;
    if (request.phaseId === 'issue-end.pr') {
      envelope = phaseOntologyFailure(request);
      if (envelope) {
        process.stdout.write(canonicalJsonBytes(envelope));
        process.exitCode = 2;
        return;
      }
    }
    envelope = PHASE_HANDLERS[request.phaseId](request);
    process.stdout.write(canonicalJsonBytes(envelope));
    if (envelope.handback.disposition === 'held') process.exitCode = 3;
  } catch (error) {
    console.error(`PHASE_REQUEST_INVALID: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

// ---------------------------------------------------------------- entry

const [, , sub, ...rest] = process.argv;
const args = parseArgs(rest, ['push', 'json', 'dry-run', 'remove', 'skip-ok']);

switch (sub) {
  case 'context': cmdContext(args); break;
  case 'init': cmdInit(args); break;
  case 'commit': cmdCommit(args); break;
  case 'mirror': cmdMirror(args); break;
  case 'urls': cmdUrls(args); break;
  case 'report-check': cmdReportCheck(args); break;
  case 'ontology-guard': cmdOntologyGuard(args); break;
  case 'sync-base': cmdSyncBase(args); break;
  case 'status': cmdStatus(args); break;
  case 'pure-tree': cmdPureTree(args); break;
  case 'phase': cmdPhase(args); break;
  default:
    console.error(USAGE);
    process.exit(1);
}
