import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PHASE_API_VERSION,
  canonicalJsonBytes,
  canonicalJsonSha256,
  parseCanonicalJson,
  validatePhaseEnvelope,
} from './issue-phase-contract.mjs';

export const ISSUE_START_PHASE_CONTRACT_ID = 'issue-start-phase-api-v1';
export const ISSUE_START_PHASES = Object.freeze([
  'issue-start.intake',
  'issue-start.fetch',
  'issue-start.classify',
  'issue-start.plan',
  'issue-start.worktree',
  'issue-start.before',
  'issue-start.implement',
  'issue-start.commit',
  'issue-start.after',
  'issue-start.publish-evidence',
  'issue-start.comment',
  'issue-start.sync-base',
  'issue-start.handback',
]);

class RequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const reject = (code, message) => {
  throw new RequestError(code, message);
};

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const exactKeys = (value, names, label) => {
  if (!isRecord(value)) reject('INVALID_REQUEST', `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...names].sort();
  if (actual.length !== expected.length
    || actual.some((name, index) => name !== expected[index])) {
    reject('UNKNOWN_PROPERTY', `${label} must contain exactly: ${expected.join(', ')}`);
  }
};

const string = (value, label, nullable = false) => {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || value.length === 0) {
    reject('INVALID_REQUEST', `${label} must be a non-empty string`);
  }
};

const absolute = (value, label, nullable = false) => {
  string(value, label, nullable);
  if (value !== null && (!path.isAbsolute(value) || path.resolve(value) !== value)) {
    reject('INVALID_REQUEST', `${label} must be a normalized absolute path`);
  }
};

const boolean = (value, label) => {
  if (typeof value !== 'boolean') reject('INVALID_REQUEST', `${label} must be boolean`);
};

const validateState = (state) => {
  exactKeys(state, [
    'issue', 'baseCheckout', 'issueWorktree', 'branch', 'completedPhases',
    'beforeCaptured', 'implementationCommitted', 'evidenceCommitted', 'evidencePushed',
    'commentPublished', 'baseSynced',
  ], 'state');
  if (!Number.isSafeInteger(state.issue) || state.issue < 1 || state.issue > 999999) {
    reject('INVALID_REQUEST', 'state.issue must be an issue number');
  }
  absolute(state.baseCheckout, 'state.baseCheckout');
  absolute(state.issueWorktree, 'state.issueWorktree', true);
  string(state.branch, 'state.branch', true);
  if (!Array.isArray(state.completedPhases)
    || state.completedPhases.some((phase, index) => phase !== ISSUE_START_PHASES[index])) {
    reject('PHASE_SEQUENCE', 'state.completedPhases must be an exact phase prefix');
  }
  for (const name of [
    'beforeCaptured', 'implementationCommitted', 'evidenceCommitted', 'evidencePushed',
    'commentPublished', 'baseSynced',
  ]) boolean(state[name], `state.${name}`);
  if ((state.issueWorktree === null) !== (state.branch === null)) {
    reject('INVALID_REQUEST', 'state.issueWorktree and state.branch must be set together');
  }
};

const validateInput = (input) => {
  exactKeys(input, [
    'baseDirty', 'issueBody', 'classification', 'planPath', 'intendedWorktree',
    'intendedBranch', 'commitMessage', 'beforeArtifact', 'afterArtifact', 'commentFile',
    'baseBranch',
  ], 'input');
  boolean(input.baseDirty, 'input.baseDirty');
  string(input.issueBody, 'input.issueBody');
  if (input.classification !== null
    && !['frontend', 'backend', 'both', 'neither'].includes(input.classification)) {
    reject('INVALID_REQUEST', 'input.classification is invalid');
  }
  absolute(input.planPath, 'input.planPath');
  absolute(input.intendedWorktree, 'input.intendedWorktree');
  string(input.intendedBranch, 'input.intendedBranch');
  string(input.commitMessage, 'input.commitMessage');
  absolute(input.beforeArtifact, 'input.beforeArtifact');
  absolute(input.afterArtifact, 'input.afterArtifact');
  absolute(input.commentFile, 'input.commentFile');
  string(input.baseBranch, 'input.baseBranch');
};

const validateEffectResult = (result) => {
  if (result === null) return;
  exactKeys(result, ['approvalId', 'status', 'receipt'], 'effectResult');
  string(result.approvalId, 'effectResult.approvalId', true);
  if (!['succeeded', 'failed', 'unknown'].includes(result.status)) {
    reject('INVALID_REQUEST', 'effectResult.status is invalid');
  }
  string(result.receipt, 'effectResult.receipt');
};

const validateRequest = (request) => {
  exactKeys(request, [
    'apiVersion', 'contractId', 'phaseId', 'checkpoint', 'state', 'input', 'effectResult',
  ], 'request');
  if (request.apiVersion !== PHASE_API_VERSION) reject('API_VERSION', 'Unsupported apiVersion');
  if (request.contractId !== ISSUE_START_PHASE_CONTRACT_ID) {
    reject('CONTRACT_ID', 'Unsupported contractId');
  }
  if (!ISSUE_START_PHASES.includes(request.phaseId)) reject('PHASE_ID', 'Unknown issue-start phase');
  validateState(request.state);
  validateInput(request.input);
  validateEffectResult(request.effectResult);
  const expected = ISSUE_START_PHASES[request.state.completedPhases.length];
  if (request.phaseId !== expected) {
    reject('PHASE_SEQUENCE', `Expected ${expected ?? 'no further phase'}, received ${request.phaseId}`);
  }
  exactKeys(request.checkpoint, ['id', 'owner', 'attempt'], 'checkpoint');
  const checkpointId = `${request.phaseId}:${request.state.completedPhases.length}`;
  if (request.checkpoint.id !== checkpointId) reject('STALE_CHECKPOINT', `Expected ${checkpointId}`);
  if (request.checkpoint.owner !== 'issue-start') {
    reject('CHECKPOINT_OWNER', 'checkpoint.owner must be issue-start');
  }
  if (!Number.isSafeInteger(request.checkpoint.attempt) || request.checkpoint.attempt < 1) {
    reject('INVALID_REQUEST', 'checkpoint.attempt must be a positive safe integer');
  }
  if (request.state.issueWorktree === request.state.baseCheckout) {
    reject('BASE_CHECKOUT_TARGET', 'issue worktree must not be the base checkout');
  }
  return request;
};

const command = (argv, cwd) => ({ argv, cwd });

const proposedEffect = (request, scriptPath) => {
  const { phaseId, state, input } = request;
  const issue = String(state.issue);
  const effects = {
    'issue-start.fetch': {
      classification: 'local-idempotent',
      type: 'tracker-fetch',
      request: command([process.execPath, scriptPath, 'fetch', issue], state.baseCheckout),
    },
    'issue-start.classify': {
      classification: 'local-idempotent',
      type: 'classification-review',
      request: {
        issue: state.issue,
        issueBody: input.issueBody,
        allowed: ['frontend', 'backend', 'both', 'neither'],
      },
    },
    'issue-start.plan': {
      classification: 'local-idempotent',
      type: 'write-reviewed-plan',
      request: {
        issue: state.issue,
        classification: input.classification,
        path: input.planPath,
        requireEvidencePlan: true,
      },
    },
    'issue-start.worktree': {
      classification: 'local-idempotent',
      type: 'create-issue-worktree',
      request: command([
        process.execPath, scriptPath, 'worktree', issue,
        '--branch', input.intendedBranch, '--path', input.intendedWorktree,
      ], state.baseCheckout),
    },
    'issue-start.before': {
      classification: 'local-idempotent',
      type: 'capture-before',
      request: {
        cwd: state.issueWorktree,
        artifact: input.beforeArtifact,
        requireClean: true,
        assertNoTrackedEdits: true,
      },
    },
    'issue-start.implement': {
      classification: 'local-idempotent',
      type: 'implementation-worker',
      request: {
        cwd: state.issueWorktree,
        planPath: input.planPath,
        permissions: { network: false, remoteGit: false, trackerWrite: false },
      },
    },
    'issue-start.commit': {
      classification: 'local-idempotent',
      type: 'implementation-commit',
      request: {
        cwd: state.issueWorktree,
        steps: [
          command([process.execPath, scriptPath, 'guard', '--issue', issue], state.issueWorktree),
          command(['git', 'add', '-A', '--', ':!.issue'], state.issueWorktree),
          {
            kind: 'git-commit',
            ...command(['git', 'commit', '-m', input.commitMessage], state.issueWorktree),
            exclude: ['.issue/**'],
          },
        ],
      },
    },
    'issue-start.after': {
      classification: 'local-idempotent',
      type: 'capture-after',
      request: {
        cwd: state.issueWorktree,
        artifact: input.afterArtifact,
        compareTo: input.beforeArtifact,
        requireBoundingBox: true,
      },
    },
    'issue-start.publish-evidence': {
      classification: 'approval-required',
      type: 'publish-evidence',
      request: {
        cwd: state.issueWorktree,
        order: 'implementation-commit-before-evidence-commit-before-push',
        steps: [
          {
            kind: 'evidence-commit',
            ...command([process.execPath, scriptPath, 'evidence-commit', issue], state.issueWorktree),
          },
          {
            kind: 'branch-push',
            ...command(['git', 'push', '-u', 'origin', state.branch], state.issueWorktree),
          },
          {
            kind: 'evidence-mirror-push',
            ...command([
              process.execPath, scriptPath, 'evidence-mirror', issue, '--push',
            ], state.issueWorktree),
          },
        ],
      },
    },
    'issue-start.comment': {
      classification: 'approval-required',
      type: 'tracker-comment',
      request: command([
        'gh', 'issue', 'comment', issue, '--body-file', input.commentFile,
      ], state.issueWorktree),
    },
    'issue-start.sync-base': {
      classification: 'local-idempotent',
      type: 'sync-base-checkout',
      request: command([
        process.execPath, scriptPath, 'sync-base', '--base', input.baseBranch,
      ], state.issueWorktree),
    },
  };
  const effect = effects[phaseId];
  if (!effect) return null;
  const digest = canonicalJsonSha256(effect.request);
  return {
    approvalId: effect.classification === 'approval-required'
      ? `issue-start:${phaseId}:${digest}`
      : null,
    ...effect,
  };
};

const held = (request, reason, effect = null) => validatePhaseEnvelope({
  apiVersion: PHASE_API_VERSION,
  contractId: 'issue-phase-api-v1',
  phaseId: request.phaseId,
  checkpoint: request.checkpoint,
  ok: true,
  data: {
    reason,
    state: request.state,
    requestDigest: canonicalJsonSha256(request),
  },
  observedFacts: [{ kind: 'phase-held', value: { reason } }],
  proposedEffect: effect,
  handback: { disposition: 'held', resume: 'same', retry: 'reconcile' },
  error: null,
});

const completed = (request) => {
  const state = {
    ...request.state,
    completedPhases: [...request.state.completedPhases, request.phaseId],
  };
  if (request.phaseId === 'issue-start.worktree') {
    state.issueWorktree = request.input.intendedWorktree;
    state.branch = request.input.intendedBranch;
  } else if (request.phaseId === 'issue-start.before') {
    state.beforeCaptured = true;
  } else if (request.phaseId === 'issue-start.commit') {
    state.implementationCommitted = true;
  } else if (request.phaseId === 'issue-start.publish-evidence') {
    state.evidenceCommitted = true;
    state.evidencePushed = true;
  } else if (request.phaseId === 'issue-start.comment') {
    state.commentPublished = true;
  } else if (request.phaseId === 'issue-start.sync-base') {
    state.baseSynced = true;
  }
  return validatePhaseEnvelope({
    apiVersion: PHASE_API_VERSION,
    contractId: 'issue-phase-api-v1',
    phaseId: request.phaseId,
    checkpoint: {
      id: `${request.phaseId}:complete:${canonicalJsonSha256(state)}`,
      owner: 'issue-start',
      attempt: request.checkpoint.attempt,
    },
    ok: true,
    data: {
      completedPhase: request.phaseId,
      nextPhase: ISSUE_START_PHASES[state.completedPhases.length] ?? null,
      state,
    },
    observedFacts: [{ kind: 'phase-complete', value: { receipt: request.effectResult?.receipt ?? null } }],
    proposedEffect: null,
    handback: { disposition: 'complete', resume: 'next', retry: 'never' },
    error: null,
  });
};

const precondition = (request) => {
  if (request.input.baseDirty && request.phaseId !== 'issue-start.intake') return 'DIRTY_BASE';
  if (request.phaseId === 'issue-start.before'
    && (request.state.issueWorktree === null || request.state.branch === null)) {
    return 'ISSUE_WORKTREE_REQUIRED';
  }
  if (request.phaseId === 'issue-start.implement' && !request.state.beforeCaptured) {
    return 'BEFORE_REQUIRED';
  }
  if (['issue-start.commit', 'issue-start.after'].includes(request.phaseId)
    && !request.state.beforeCaptured) return 'BEFORE_REQUIRED';
  if (request.phaseId === 'issue-start.after' && !request.state.implementationCommitted) {
    return 'IMPLEMENTATION_COMMIT_REQUIRED';
  }
  if (request.phaseId === 'issue-start.publish-evidence'
    && !request.state.implementationCommitted) return 'IMPLEMENTATION_COMMIT_REQUIRED';
  if (request.phaseId === 'issue-start.comment' && !request.state.evidencePushed) {
    return 'EVIDENCE_PUSH_REQUIRED';
  }
  if (request.phaseId === 'issue-start.sync-base' && !request.state.commentPublished) {
    return 'COMMENT_REQUIRED';
  }
  if (request.phaseId === 'issue-start.handback' && !request.state.baseSynced) {
    return 'BASE_SYNC_REQUIRED';
  }
  return null;
};

const executeTransition = (request, scriptPath) => {
  const blocked = precondition(request);
  if (blocked) return { exitCode: 3, envelope: held(request, blocked) };
  const effect = proposedEffect(request, scriptPath);
  if (effect === null) return { exitCode: 0, envelope: completed(request) };
  if (request.effectResult === null) {
    return { exitCode: 3, envelope: held(request, 'EFFECT_APPROVAL_OR_EXECUTION_REQUIRED', effect) };
  }
  if (request.effectResult.approvalId !== effect.approvalId) {
    reject('EFFECT_HANDSHAKE', 'effectResult.approvalId does not match the proposed effect');
  }
  if (request.effectResult.status !== 'succeeded') {
    return { exitCode: 3, envelope: held(request, 'EFFECT_RECONCILIATION_REQUIRED') };
  }
  return { exitCode: 0, envelope: completed(request) };
};

export function runIssueStartPhase(argv, scriptPath) {
  try {
    if (argv.length !== 2 || argv[0] !== '--request') {
      reject('PHASE_USAGE', 'phase requires exactly --request <absolute-json>');
    }
    const requestPath = argv[1];
    if (!path.isAbsolute(requestPath)) reject('REQUEST_PATH_ABSOLUTE', 'request path must be absolute');
    const request = validateRequest(parseCanonicalJson(readFileSync(requestPath)));
    const result = executeTransition(request, path.resolve(scriptPath));
    process.stdout.write(canonicalJsonBytes(result.envelope));
    return result.exitCode;
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'INTERNAL_ERROR';
    const message = error instanceof Error ? error.message : 'Unknown phase error';
    process.stderr.write(`${code}: ${message}\n`);
    return error instanceof RequestError || code !== 'INTERNAL_ERROR' ? 2 : 1;
  }
}
