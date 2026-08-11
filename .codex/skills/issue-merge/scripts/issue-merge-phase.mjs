import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import {
  PHASE_API_VERSION,
  PHASE_CONTRACT_ID,
  canonicalJsonBytes,
  parseCanonicalJson,
  phaseApprovalId,
  validatePhaseEnvelope,
} from './issue-phase-contract.mjs';

const REQUEST_CONTRACT_ID = 'issue-merge-phase-api-v1';
const PHASE_IDS = [
  'issue-merge.base-tree',
  'issue-merge.inventory',
  'issue-merge.map',
  'issue-merge.candidate',
  'issue-merge.preflight-plan',
  'issue-merge.resolve-review',
  'issue-merge.merge-verify',
  'issue-merge.close-cleanup',
  'issue-merge.handback',
];
const REQUEST_KEYS = ['apiVersion', 'checkpoint', 'contractId', 'data', 'phaseId'];
const CHECKPOINT_KEYS = ['attempt', 'id'];
const DATA_KEYS = new Set([
  'action', 'accumulatedOnto', 'approvalId', 'autoClosed', 'baseBranch', 'baseCommit', 'baseHead',
  'body', 'bodySha256', 'branch', 'candidate', 'checksSha256', 'ci', 'cleanupApproved',
  'closedIssues', 'conflictAttempt', 'criticVerdict', 'decision', 'decisionApproved',
  'detached', 'evidence', 'expectedBaseHead', 'expectedBodySha256', 'expectedChecksSha256',
  'expectedHeadSha', 'expectedOnto', 'headSha', 'integrationPassed', 'issue', 'issueClosed',
  'issueState', 'mapped', 'mergeApproved', 'mergeObserved', 'mergeSha', 'mergedSha', 'mode',
  'onto', 'order', 'pr', 'preflightClean', 'preflightCommit', 'pushApproved', 'reopenApproved',
  'registeredWorktree', 'repositoryRoot', 'retainEvidenceBranches', 'reviewed',
  'triggerRepairApproved', 'worktreeRemoved', 'subcheckpoint', 'triggerCount', 'verifiedIssues',
  'worktree', 'worktreeRoot', 'worktrees',
]);
const STRING_DATA_KEYS = new Set([
  'action', 'accumulatedOnto', 'approvalId', 'baseBranch', 'baseCommit', 'baseHead', 'body', 'bodySha256',
  'branch', 'checksSha256', 'ci', 'criticVerdict', 'decision', 'expectedBaseHead',
  'expectedBodySha256', 'expectedChecksSha256', 'expectedHeadSha', 'expectedOnto', 'headSha',
  'issueState', 'mergeSha', 'mergedSha', 'mode', 'onto', 'preflightCommit',
  'registeredWorktree', 'repositoryRoot', 'subcheckpoint', 'worktree', 'worktreeRoot',
]);
const BOOLEAN_DATA_KEYS = new Set([
  'autoClosed', 'candidate', 'cleanupApproved', 'decisionApproved', 'detached',
  'integrationPassed', 'issueClosed', 'mapped', 'mergeApproved', 'mergeObserved',
  'preflightClean', 'pushApproved', 'reopenApproved', 'retainEvidenceBranches', 'reviewed',
  'triggerRepairApproved', 'worktreeRemoved',
]);
const INTEGER_DATA_KEYS = new Set(['conflictAttempt', 'issue', 'triggerCount']);
const ARRAY_DATA_KEYS = new Set(['closedIssues', 'order', 'verifiedIssues', 'worktrees']);

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
};

const parseRequest = (requestPath) => {
  if (typeof requestPath !== 'string' || !path.isAbsolute(requestPath)) {
    throw new TypeError('--request must be an absolute JSON path');
  }
  const request = parseCanonicalJson(readFileSync(requestPath));
  exactKeys(request, REQUEST_KEYS, 'request');
  exactKeys(request.checkpoint, CHECKPOINT_KEYS, 'request.checkpoint');
  if (request.apiVersion !== PHASE_API_VERSION) throw new TypeError('Unsupported apiVersion');
  if (request.contractId !== REQUEST_CONTRACT_ID) throw new TypeError('Unsupported contractId');
  if (!PHASE_IDS.includes(request.phaseId)) throw new TypeError('Unknown issue-merge phaseId');
  if (typeof request.checkpoint.id !== 'string' || request.checkpoint.id.length === 0) {
    throw new TypeError('checkpoint.id must be a non-empty string');
  }
  if (!Number.isSafeInteger(request.checkpoint.attempt) || request.checkpoint.attempt < 1) {
    throw new TypeError('checkpoint.attempt must be a positive safe integer');
  }
  if (request.data === null || typeof request.data !== 'object' || Array.isArray(request.data)) {
    throw new TypeError('data must be an object');
  }
  for (const key of Object.keys(request.data)) {
    if (!DATA_KEYS.has(key)) throw new TypeError(`Unknown data property: ${key}`);
    const value = request.data[key];
    if (STRING_DATA_KEYS.has(key) && (typeof value !== 'string' || value.length === 0)) {
      throw new TypeError(`data.${key} must be a non-empty string`);
    }
    if (BOOLEAN_DATA_KEYS.has(key) && typeof value !== 'boolean') {
      throw new TypeError(`data.${key} must be boolean`);
    }
    if (INTEGER_DATA_KEYS.has(key) && (!Number.isSafeInteger(value) || value < 0)) {
      throw new TypeError(`data.${key} must be a non-negative safe integer`);
    }
    if (ARRAY_DATA_KEYS.has(key) && !Array.isArray(value)) {
      throw new TypeError(`data.${key} must be an array`);
    }
  }
  if (request.data.evidence !== undefined) {
    exactKeys(request.data.evidence, ['after', 'before', 'report'], 'data.evidence');
    if (!Number.isSafeInteger(request.data.evidence.before)
      || !Number.isSafeInteger(request.data.evidence.after)
      || typeof request.data.evidence.report !== 'boolean') {
      throw new TypeError('data.evidence has invalid field types');
    }
  }
  if (request.data.pr !== undefined) {
    if (Number.isSafeInteger(request.data.pr) && request.data.pr > 0) return request;
    exactKeys(request.data.pr, ['headSha', 'number'], 'data.pr');
    if (!Number.isSafeInteger(request.data.pr.number) || request.data.pr.number < 1
      || typeof request.data.pr.headSha !== 'string' || request.data.pr.headSha.length === 0) {
      throw new TypeError('data.pr has invalid field types');
    }
  }
  return request;
};

const envelope = (request, {
  data = {},
  facts = [],
  effect = null,
  held = effect !== null,
} = {}) => validatePhaseEnvelope({
  apiVersion: PHASE_API_VERSION,
  contractId: PHASE_CONTRACT_ID,
  phaseId: request.phaseId,
  checkpoint: {
    id: request.checkpoint.id,
    owner: 'issue-merge',
    attempt: request.checkpoint.attempt,
  },
  ok: true,
  data,
  observedFacts: facts,
  proposedEffect: effect,
  handback: held
    ? { disposition: 'held', resume: 'same', retry: 'reconcile' }
    : { disposition: 'complete', resume: 'next', retry: 'never' },
  error: null,
});

const fact = (kind, value) => ({ kind, value });
const effect = (type, classification, approvalId, request) => ({
  approvalId,
  classification,
  type,
  request,
});
const hold = (request, holdCode, data = {}, proposedEffect = null, facts = []) => envelope(request, {
  data: { ...data, holdCode },
  facts,
  effect: proposedEffect,
  held: true,
});
const requiredString = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} is required`);
  return value;
};
const requiredPositive = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be positive`);
  return value;
};
const pathError = (code, message) => {
  throw new TypeError(`${code}: ${message}`);
};
const normalizedAbsolutePath = (value, label) => {
  requiredString(value, label);
  if (!path.isAbsolute(value) || path.resolve(value) !== value) {
    pathError('PATH_NOT_NORMALIZED', `${label} must be a normalized absolute path`);
  }
  return value;
};
const isWithin = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative)
    && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};
const rejectSymlinkAncestors = (target, label) => {
  const parsed = path.parse(target);
  let current = parsed.root;
  for (const part of target.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT') break;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      pathError('PATH_SYMLINK', `${label} must not contain a symlink ancestor`);
    }
  }
};
const verifiedDirectory = (value, label) => {
  const target = normalizedAbsolutePath(value, label);
  rejectSymlinkAncestors(target, label);
  if (!existsSync(target) || !lstatSync(target).isDirectory()) {
    pathError('PATH_ROOT_INVALID', `${label} must be an existing directory`);
  }
  const real = realpathSync(target);
  if (real !== target) pathError('PATH_SYMLINK', `${label} must resolve without symlinks`);
  return real;
};
const registeredWorktrees = (repositoryRoot) => {
  let output;
  try {
    const topLevel = execFileSync(
      'git',
      ['-C', repositoryRoot, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', timeout: 3000 },
    ).trim();
    if (realpathSync(topLevel) !== repositoryRoot) {
      pathError('REPOSITORY_AUTHORITY_INVALID', 'repositoryRoot must be the git top level');
    }
    output = execFileSync(
      'git',
      ['-C', repositoryRoot, 'worktree', 'list', '--porcelain', '-z'],
      { encoding: 'utf8', timeout: 3000 },
    );
  } catch (error) {
    if (error instanceof TypeError) throw error;
    pathError('REPOSITORY_AUTHORITY_INVALID', 'repositoryRoot must expose its git worktree registry');
  }
  return output.split('\0\0').filter(Boolean).map((record) => {
    const fields = record.split('\0');
    return {
      branch: fields.find((field) => field.startsWith('branch '))?.slice('branch '.length) ?? null,
      worktree: fields.find((field) => field.startsWith('worktree '))?.slice('worktree '.length) ?? null,
    };
  });
};
const verifiedCleanupTarget = (data, { allowRemoved = false } = {}) => {
  const repositoryRoot = verifiedDirectory(data.repositoryRoot, 'repositoryRoot');
  const worktreeRoot = verifiedDirectory(data.worktreeRoot, 'worktreeRoot');
  const registeredWorktree = normalizedAbsolutePath(data.registeredWorktree, 'registeredWorktree');
  const worktree = normalizedAbsolutePath(data.worktree, 'worktree');
  if (worktree !== registeredWorktree) {
    pathError('WORKTREE_AUTHORITY_MISMATCH', 'worktree must equal registeredWorktree');
  }
  if (!isWithin(worktreeRoot, worktree) || worktree === worktreeRoot) {
    pathError('PATH_OUTSIDE_ROOT', 'worktree must be a child of worktreeRoot');
  }
  rejectSymlinkAncestors(worktree, 'worktree');
  const worktreeExists = existsSync(worktree);
  if (!worktreeExists && !allowRemoved) {
    pathError('PATH_ROOT_INVALID', 'worktree must be an existing directory');
  }
  const verifiedWorktree = worktreeExists ? verifiedDirectory(worktree, 'worktree') : worktree;
  if (verifiedWorktree === repositoryRoot) {
    pathError('WORKTREE_AUTHORITY_MISMATCH', 'cleanup must not target repositoryRoot');
  }
  const expectedBranch = `refs/heads/${requiredString(data.branch, 'branch')}`;
  if (worktreeExists) {
    const registered = registeredWorktrees(repositoryRoot).some((entry) => (
      entry.worktree === verifiedWorktree && entry.branch === expectedBranch
    ));
    if (!registered) {
      pathError('WORKTREE_NOT_REGISTERED', 'worktree and branch must match the git worktree registry');
    }
  }
  return {
    branch: data.branch,
    repositoryRoot,
    worktree: verifiedWorktree,
    worktreeRoot,
  };
};
const argvEffect = (type, argv, classification = 'local-idempotent', id = null) => (
  effect(type, classification, id, { argv })
);
const approvalEffect = ({
  effectRequest,
  immutableState,
  request,
  type,
}) => {
  const proposed = {
    classification: 'approval-required',
    request: effectRequest,
    type,
  };
  return effect(
    type,
    proposed.classification,
    phaseApprovalId({
      checkpoint: request.checkpoint,
      effect: proposed,
      immutableState: { phaseId: request.phaseId, ...immutableState },
      namespace: 'issue-merge',
    }),
    effectRequest,
  );
};

const describe = (request) => envelope(request, {
  data: { phaseId: request.phaseId, requestContractId: REQUEST_CONTRACT_ID },
});

const phaseBaseTree = (request) => {
  const data = request.data;
  if (data.mode === 'describe' || Object.keys(data).length === 0) return describe(request);
  if (data.detached === false) return hold(request, 'BASE_TREE_NOT_DETACHED');
  const argv = ['base-tree'];
  if (data.action === 'remove') argv.push('--remove');
  if (data.baseBranch) argv.push('--base', requiredString(data.baseBranch, 'baseBranch'));
  return hold(request, 'EFFECT_PROPOSED', { detached: true }, argvEffect('base-tree', argv));
};

const phaseInventory = (request) => {
  if (request.data.mode === 'describe' || Object.keys(request.data).length === 0) return describe(request);
  if (Array.isArray(request.data.worktrees)) {
    return envelope(request, {
      data: { count: request.data.worktrees.length, worktrees: request.data.worktrees },
      facts: [fact('worktree-inventory', { count: request.data.worktrees.length })],
    });
  }
  return hold(request, 'EFFECT_PROPOSED', {}, argvEffect('inventory', ['inventory']));
};

const phaseMap = (request) => {
  if (request.data.mode === 'describe' || Object.keys(request.data).length === 0) return describe(request);
  if (request.data.mapped !== true) return hold(request, 'WORKTREE_ISSUE_MAPPING_REQUIRED');
  return envelope(request, { data: { mapped: true } });
};

const phaseCandidate = (request) => {
  if (request.data.mode === 'describe' || Object.keys(request.data).length === 0) return describe(request);
  const { evidence, pr } = request.data;
  const complete = evidence !== null && typeof evidence === 'object'
    && Number.isSafeInteger(evidence.before) && evidence.before > 0
    && Number.isSafeInteger(evidence.after) && evidence.after > 0
    && evidence.report === true
    && pr !== null && typeof pr === 'object'
    && Number.isSafeInteger(pr.number) && pr.number > 0
    && typeof pr.headSha === 'string' && pr.headSha.length > 0;
  if (!complete) return hold(request, 'EVIDENCE_INCOMPLETE', { candidate: false });
  return envelope(request, {
    data: { candidate: true, issue: request.data.issue, branch: request.data.branch, pr },
    facts: [fact('candidate-evidence', { evidence, pr })],
  });
};

const phasePreflightPlan = (request) => {
  if (request.data.mode === 'describe' || Object.keys(request.data).length === 0) return describe(request);
  const { branch, onto, expectedOnto, baseHead, expectedBaseHead, preflightClean } = request.data;
  if (onto !== expectedOnto) return hold(request, 'STALE_ONTO', { onto, expectedOnto });
  if (baseHead !== expectedBaseHead) return hold(request, 'STALE_BASE', { baseHead, expectedBaseHead });
  if (preflightClean === false) return hold(request, 'PREFLIGHT_NOT_CLEAN');
  if (typeof request.data.preflightCommit === 'string' && request.data.preflightCommit.length > 0) {
    return envelope(request, {
      data: { branch, onto, accumulatedCommit: request.data.preflightCommit, preflightClean: true },
      facts: [fact('cumulative-preflight', { branch, onto, commit: request.data.preflightCommit })],
    });
  }
  return hold(
    request,
    'EFFECT_PROPOSED',
    { branch, onto },
    argvEffect('cumulative-preflight', [
      'preflight', '--branch', requiredString(branch, 'branch'),
      '--onto', requiredString(onto, 'onto'),
    ]),
    [fact('cumulative-base', { onto, baseHead })],
  );
};

const phaseResolveReview = (request) => {
  if (request.data.mode === 'describe' || Object.keys(request.data).length === 0) return describe(request);
  const data = request.data;
  const attempt = requiredPositive(data.conflictAttempt, 'conflictAttempt');
  if (attempt > 2) return hold(request, 'CONFLICT_ATTEMPTS_EXHAUSTED', { conflictAttempt: attempt });
  if (data.criticVerdict === 'block') return hold(request, 'CRITIC_BLOCK', { conflictAttempt: attempt });
  if (data.criticVerdict === 'revise') return hold(request, 'CRITIC_REVISION_REQUIRED', { conflictAttempt: attempt });
  if (data.action === 'critic') {
    if (data.criticVerdict !== 'proceed') return hold(request, 'CRITIC_RESULT_REQUIRED');
    return envelope(request, { data: { criticVerdict: 'proceed', conflictAttempt: attempt } });
  }
  const worktree = requiredString(data.worktree, 'worktree');
  if (data.action === 'push') {
    const branch = requiredString(data.branch, 'branch');
    return hold(request, data.pushApproved === true ? 'EFFECT_PROPOSED' : 'CONFLICT_PUSH_APPROVAL_REQUIRED', {
      conflictAttempt: attempt,
    }, approvalEffect({
      effectRequest: { argv: ['resolve', '--worktree', worktree, '--continue', '--push'] },
      immutableState: { branch, conflictAttempt: attempt, worktree },
      request,
      type: 'conflict-resolution-push',
    }));
  }
  const suffix = data.action === 'abort' ? ['--abort']
    : data.action === 'continue' ? ['--continue'] : [];
  return hold(request, 'EFFECT_PROPOSED', { conflictAttempt: attempt }, argvEffect(
    `conflict-${data.action ?? 'start'}`,
    ['resolve', '--worktree', worktree, ...suffix],
  ));
};

const triggerIssues = (body) => {
  const issues = [];
  const pattern = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#([0-9]+)\b/giu;
  for (const match of String(body ?? '').matchAll(pattern)) issues.push(Number(match[1]));
  return issues;
};

const staleMergeCode = (data) => {
  if (data.onto !== data.accumulatedOnto) return 'STALE_ONTO';
  if (data.baseHead !== data.expectedBaseHead) return 'STALE_BASE';
  if (data.headSha !== data.expectedHeadSha) return 'STALE_HEAD';
  if (data.bodySha256 !== data.expectedBodySha256) return 'STALE_BODY';
  if (data.checksSha256 !== data.expectedChecksSha256) return 'STALE_CHECKS';
  if (data.preflightClean !== true) return 'PREFLIGHT_NOT_CLEAN';
  if (data.criticVerdict !== 'proceed') return 'CRITIC_BLOCK';
  if (data.triggerCount !== 0) return 'AUTO_CLOSE_TRIGGER_REMAINS';
  if (data.ci !== 'success') return 'CI_NOT_SUCCESSFUL';
  if (data.mergeApproved !== true) return 'MERGE_APPROVAL_REQUIRED';
  return null;
};

const integrationFailure = (request) => {
  const data = request.data;
  const issue = requiredPositive(data.issue, 'issue');
  if (data.decision === 'revert-rework' && data.decisionApproved !== true) {
    return hold(request, 'RECOVERY_APPROVAL_REQUIRED', { decision: data.decision }, approvalEffect({
      effectRequest: { issue, mergeSha: data.mergeSha },
      immutableState: { decision: data.decision },
      request,
      type: 'merge-revert-rework',
    }));
  }
  if (data.decision === 'follow-up-issue' && data.decisionApproved !== true) {
    return hold(request, 'RECOVERY_APPROVAL_REQUIRED', { decision: data.decision }, approvalEffect({
      effectRequest: { issue, mergeSha: data.mergeSha },
      immutableState: { decision: data.decision },
      request,
      type: 'integration-follow-up-issue',
    }));
  }
  if (!['revert-rework', 'follow-up-issue', 'accept-failure'].includes(data.decision)
    || data.decisionApproved !== true) {
    return hold(request, 'INTEGRATION_OWNER_DECISION_REQUIRED');
  }
  if (data.autoClosed === true && data.reopenApproved !== true) {
    return hold(request, 'REOPEN_APPROVAL_REQUIRED', { decision: data.decision }, approvalEffect({
      effectRequest: { issue },
      immutableState: { autoClosed: true, decision: data.decision, mergeSha: data.mergeSha },
      request,
      type: 'issue-reopen',
    }));
  }
  return envelope(request, {
    data: { integrationPassed: false, acceptedDecision: data.decision, reopenApproved: data.reopenApproved === true },
    facts: [fact('integration-verification', { passed: false, mergeSha: data.mergeSha })],
  });
};

const phaseMergeVerify = (request) => {
  if (request.data.mode === 'describe' || Object.keys(request.data).length === 0) return describe(request);
  const data = request.data;
  const checkpoint = data.subcheckpoint;
  if (checkpoint === 'trigger-inspection' || checkpoint === 'trigger-reinspection') {
    const issues = triggerIssues(data.body);
    if (checkpoint === 'trigger-reinspection' && issues.length > 0) {
      return hold(request, 'AUTO_CLOSE_TRIGGER_REMAINS', { triggerCount: issues.length, triggerIssues: issues });
    }
    if (issues.length > 0) {
      const pr = requiredPositive(data.pr, 'pr');
      return hold(request, 'TRIGGER_REPAIR_APPROVAL_REQUIRED', {
        triggerCount: issues.length,
        triggerIssues: issues,
      }, approvalEffect({
        effectRequest: { pr, triggerIssues: issues },
        immutableState: { bodySha256: data.bodySha256 ?? null },
        request,
        type: 'pr-body-trigger-repair',
      }), [fact('pr-body-trigger-scan', { count: issues.length })]);
    }
    return envelope(request, {
      data: { triggerCount: 0, triggerIssues: [] },
      facts: [fact('pr-body-trigger-scan', { count: 0 })],
    });
  }
  if (checkpoint === 'ci') {
    return data.ci === 'success' ? envelope(request, { data: { ci: 'success' } })
      : hold(request, 'CI_NOT_SUCCESSFUL', { ci: data.ci });
  }
  if (checkpoint === 'merge') {
    const code = staleMergeCode(data);
    if (code) return hold(request, code);
    const pr = requiredPositive(data.pr, 'pr');
    if (data.mergeObserved === true) {
      return envelope(request, {
        data: { pr, onto: data.onto, mergedSha: requiredString(data.mergedSha, 'mergedSha') },
        facts: [fact('provider-merge-state', { pr, merged: true, mergedSha: data.mergedSha })],
      });
    }
    return hold(request, 'EFFECT_PROPOSED', { pr, onto: data.onto }, approvalEffect({
      effectRequest: {
        argv: ['merge', '--pr', String(pr), '--method', 'squash'],
        onto: data.onto,
      },
      immutableState: {
        bodySha256: data.bodySha256,
        checksSha256: data.checksSha256,
        headSha: data.headSha,
      },
      request,
      type: 'pr-merge',
    }), [fact('merge-gates', {
      preflightClean: true,
      criticVerdict: 'proceed',
      triggerCount: 0,
      ci: 'success',
    })]);
  }
  if (checkpoint === 'base-refresh') {
    return hold(request, 'EFFECT_PROPOSED', {}, argvEffect('base-refresh', ['base-tree']));
  }
  if (checkpoint === 'integration-verification') {
    if (data.integrationPassed !== true) return integrationFailure(request);
    return envelope(request, {
      data: { integrationPassed: true, issue: data.issue, mergeSha: data.mergeSha },
      facts: [fact('integration-verification', { passed: true, mergeSha: data.mergeSha })],
    });
  }
  if (checkpoint === 'trigger-repair') {
    if (data.triggerRepairApproved !== true) return hold(request, 'TRIGGER_REPAIR_APPROVAL_REQUIRED');
    return envelope(request, { data: { repairApproved: true } });
  }
  if (checkpoint === 'merge-approval') {
    return data.mergeApproved === true ? envelope(request, { data: { mergeApproved: true } })
      : hold(request, 'MERGE_APPROVAL_REQUIRED');
  }
  return hold(request, 'UNKNOWN_MERGE_SUBCHECKPOINT', { subcheckpoint: checkpoint });
};

const phaseCloseCleanup = (request) => {
  if (request.data.mode === 'describe' || Object.keys(request.data).length === 0) return describe(request);
  const data = request.data;
  const issue = requiredPositive(data.issue, 'issue');
  if (data.integrationPassed !== true) return hold(request, 'INTEGRATION_NOT_VERIFIED');
  if (data.subcheckpoint === 'close') {
    if (data.issueClosed === true) {
      return envelope(request, {
        data: { issue, issueClosed: true },
        facts: [fact('tracker-issue-state', { issue, closed: true })],
      });
    }
    return hold(request, 'EFFECT_PROPOSED', { issue }, approvalEffect({
      effectRequest: { argv: ['close', '--issue', String(issue)] },
      immutableState: { integrationPassed: true, issue },
      request,
      type: 'verified-issue-close',
    }));
  }
  if (data.subcheckpoint !== 'cleanup') return hold(request, 'UNKNOWN_CLEANUP_SUBCHECKPOINT');
  if (data.issueClosed !== true) return hold(request, 'ISSUE_NOT_CLOSED');
  const authority = verifiedCleanupTarget(data, { allowRemoved: data.worktreeRemoved === true });
  const cleanupEffect = approvalEffect({
    effectRequest: {
      argv: [
        'cleanup', '--worktree', authority.worktree,
        '--branch', authority.branch,
      ],
      retainRemoteBranches: true,
    },
    immutableState: {
      integrationPassed: true,
      issue,
      issueClosed: true,
      repositoryRoot: authority.repositoryRoot,
      worktreeRoot: authority.worktreeRoot,
    },
    request,
    type: 'closed-issue-worktree-cleanup',
  });
  if (data.cleanupApproved !== true) {
    return hold(request, 'CLEANUP_APPROVAL_REQUIRED', {}, cleanupEffect);
  }
  if (data.approvalId !== cleanupEffect.approvalId) {
    return hold(request, 'CLEANUP_APPROVAL_MISMATCH');
  }
  if (data.worktreeRemoved === true) {
    return envelope(request, {
      data: { issue, worktreeRemoved: true, retainEvidenceBranches: true },
      facts: [fact('git-worktree-state', { worktree: authority.worktree, removed: true })],
    });
  }
  return hold(request, 'EFFECT_PROPOSED', {
    issue,
    retainEvidenceBranches: true,
  }, cleanupEffect);
};

const handlers = {
  'issue-merge.base-tree': phaseBaseTree,
  'issue-merge.inventory': phaseInventory,
  'issue-merge.map': phaseMap,
  'issue-merge.candidate': phaseCandidate,
  'issue-merge.preflight-plan': phasePreflightPlan,
  'issue-merge.resolve-review': phaseResolveReview,
  'issue-merge.merge-verify': phaseMergeVerify,
  'issue-merge.close-cleanup': phaseCloseCleanup,
  'issue-merge.handback': (request) => envelope(request, {
    data: {
      closedIssues: request.data.closedIssues ?? [],
      verifiedIssues: request.data.verifiedIssues ?? [],
      retainEvidenceBranches: true,
    },
  }),
};

export const cmdPhase = (args) => {
  try {
    const request = parseRequest(args.request);
    const result = handlers[request.phaseId](request);
    process.stdout.write(`${canonicalJsonBytes(result).toString('utf8')}\n`);
    if (result.handback.disposition === 'held') process.exitCode = 3;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`ERROR: invalid phase request: ${message}\n`);
    process.exitCode = 2;
  }
};
