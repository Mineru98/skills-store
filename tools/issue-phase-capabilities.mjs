/**
 * Strict issue-phase capability bundle construction and compatibility verification.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PHASE_API_VERSION,
  PHASE_IDS,
  canonicalJsonBytes,
  parseCanonicalJson,
} from './issue-phase-contract.mjs';

const BUNDLE_PATH = 'contracts/issue-phase-capability-bundle-v1.json';
const REQUEST_CONTRACTS = {
  'issue-start': 'contracts/issue-start-phase-api-v1.json',
  'issue-end': 'contracts/issue-end-phase-api-v1.json',
  'issue-merge': 'contracts/issue-merge-phase-api-v1.json',
};
const SCRIPT_NAMES = {
  'issue-start': 'issue-start.mjs',
  'issue-end': 'issue-end.mjs',
  'issue-merge': 'issue-merge.mjs',
};
const MIRRORS = Object.freeze([
  Object.freeze({ id: 'claude', root: '.claude' }),
  Object.freeze({ id: 'codex', root: '.codex' }),
]);

export class CapabilityCompatibilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CapabilityCompatibilityError';
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new CapabilityCompatibilityError(code, message);
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_BUNDLE', `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail('INVALID_BUNDLE', `${label} must contain exactly ${expected.join(', ')}`);
  }
};
const uniqueSorted = (values) => [...new Set(values)].sort();
const effect = (type, approvalClass) => Object.freeze({ approvalClass, type });
const checkpoint = (owner, requestFields = ['id', 'owner', 'attempt']) => Object.freeze({
  owner,
  requestFields: Object.freeze(requestFields),
  responseOwner: owner,
});
const query = (kind, fields) => Object.freeze({ fields: Object.freeze(fields), kind });

const START_EFFECTS = {
  'issue-start.fetch': [effect('tracker-fetch', 'local-idempotent')],
  'issue-start.classify': [effect('classification-review', 'local-idempotent')],
  'issue-start.plan': [effect('write-reviewed-plan', 'local-idempotent')],
  'issue-start.worktree': [effect('create-issue-worktree', 'local-idempotent')],
  'issue-start.before': [effect('capture-before', 'local-idempotent')],
  'issue-start.implement': [effect('implementation-worker', 'local-idempotent')],
  'issue-start.commit': [effect('implementation-commit', 'local-idempotent')],
  'issue-start.after': [effect('capture-after', 'local-idempotent')],
  'issue-start.publish-evidence': [effect('publish-evidence', 'approval-required')],
  'issue-start.comment': [effect('tracker-comment', 'approval-required')],
  'issue-start.sync-base': [effect('sync-base-checkout', 'local-idempotent')],
};
const END_EFFECTS = {
  'issue-end.before-recapture': [
    effect('pure-tree-create', 'local-idempotent'),
    effect('before-capture', 'local-idempotent'),
  ],
  'issue-end.after-recapture': [effect('after-capture', 'local-idempotent')],
  'issue-end.publish-evidence': [effect('branch-push', 'approval-required')],
  'issue-end.sync-base': [effect('sync-base', 'local-idempotent')],
  'issue-end.comment': [effect('tracker-comment', 'approval-required')],
  'issue-end.review-approval': [effect('review-approval', 'approval-required')],
  'issue-end.pr': [
    effect('pr-create', 'approval-required'),
    effect('status-review', 'local-idempotent'),
  ],
};
const MERGE_EFFECTS = {
  'issue-merge.base-tree': [effect('base-tree', 'local-idempotent')],
  'issue-merge.inventory': [effect('inventory', 'local-idempotent')],
  'issue-merge.preflight-plan': [effect('cumulative-preflight', 'local-idempotent')],
  'issue-merge.resolve-review': [
    effect('conflict-start', 'local-idempotent'),
    effect('conflict-continue', 'local-idempotent'),
    effect('conflict-abort', 'local-idempotent'),
    effect('conflict-resolution-push', 'approval-required'),
  ],
  'issue-merge.merge-verify': [
    effect('pr-body-trigger-repair', 'approval-required'),
    effect('pr-merge', 'approval-required'),
    effect('base-refresh', 'local-idempotent'),
    effect('merge-revert-rework', 'approval-required'),
    effect('integration-follow-up-issue', 'approval-required'),
    effect('issue-reopen', 'approval-required'),
  ],
  'issue-merge.close-cleanup': [
    effect('verified-issue-close', 'approval-required'),
    effect('closed-issue-worktree-cleanup', 'approval-required'),
  ],
};
const EFFECTS = { ...START_EFFECTS, ...END_EFFECTS, ...MERGE_EFFECTS };

const QUERY_BY_SKILL = {
  'issue-start': query('effect-receipt-and-checkpoint', [
    'checkpoint.id', 'state.completedPhases', 'effectResult.approvalId',
    'effectResult.status', 'effectResult.receipt',
  ]),
  'issue-end': query('current-evidence-provider-and-head', [
    'input.expectedHeadSha', 'input.headSha', 'input.evidencePublished',
    'input.openPr', 'input.reportDigest',
  ]),
  'issue-merge': query('cumulative-provider-and-integration-state', [
    'data.expectedBaseHead', 'data.expectedHeadSha', 'data.expectedOnto',
    'data.bodySha256', 'data.checksSha256', 'data.integrationPassed',
  ]),
};

const phaseRecord = (phaseId) => {
  const skill = phaseId.split('.')[0];
  return Object.freeze({
    approvalClasses: Object.freeze(uniqueSorted((EFFECTS[phaseId] ?? []).map((item) => item.approvalClass))),
    checkpoint: checkpoint(skill, skill === 'issue-merge' ? ['id', 'attempt'] : undefined),
    effects: Object.freeze(EFFECTS[phaseId] ?? []),
    invocation: Object.freeze([
      'node',
      `{mirrorRoot}/skills/${skill}/scripts/${SCRIPT_NAMES[skill]}`,
      'phase',
      '--request',
      '<absolute-canonical-json>',
    ]),
    phaseId,
    reconciliationQueries: Object.freeze([QUERY_BY_SKILL[skill]]),
    requestSchemaPath: REQUEST_CONTRACTS[skill],
    skill,
  });
};

export const PHASE_CAPABILITIES = Object.freeze(PHASE_IDS.map(phaseRecord));

const artifactPaths = () => {
  const paths = [
    'README.md',
    'scripts/build-phase-capability-bundle.mjs',
    'scripts/check-shared.sh',
    'scripts/sync-shared.sh',
    'scripts/test-phase-compatibility.mjs',
    'schemas/issue-phase/capability-bundle-v1.schema.json',
    'schemas/issue-phase/phase-envelope-v1.schema.json',
    'schemas/issue-phase/phase-protocol-v1.json',
    'tools/issue-phase-capabilities.mjs',
    'tools/issue-common.mjs',
    'tools/issue-docs.mjs',
    'tools/issue-media.mjs',
    'tools/issue-phase-contract.mjs',
    'tools/issue-tracker.mjs',
    ...Object.values(REQUEST_CONTRACTS),
  ];
  for (const mirror of MIRRORS) {
    for (const skill of Object.keys(REQUEST_CONTRACTS)) {
      const base = `${mirror.root}/skills/${skill}`;
      paths.push(
        `${base}/SKILL.md`,
        `${base}/${REQUEST_CONTRACTS[skill]}`,
        `${base}/schemas/issue-phase/capability-bundle-v1.schema.json`,
        `${base}/schemas/issue-phase/phase-envelope-v1.schema.json`,
        `${base}/schemas/issue-phase/phase-protocol-v1.json`,
        `${base}/scripts/issue-common.mjs`,
        `${base}/scripts/issue-docs.mjs`,
        `${base}/scripts/issue-media.mjs`,
        `${base}/scripts/issue-phase-contract.mjs`,
        `${base}/scripts/issue-tracker.mjs`,
        `${base}/scripts/${SCRIPT_NAMES[skill]}`,
      );
      if (skill !== 'issue-end') paths.push(`${base}/scripts/${skill}-phase.mjs`);
    }
  }
  return uniqueSorted(paths);
};

const assertRelativePath = (relativePath) => {
  if (typeof relativePath !== 'string'
    || relativePath.length === 0
    || path.isAbsolute(relativePath)
    || relativePath.includes('\\')
    || path.posix.normalize(relativePath) !== relativePath
    || relativePath === '..'
    || relativePath.startsWith('../')) {
    fail('UNSAFE_PATH', `Unsafe repository-relative path: ${String(relativePath)}`);
  }
};

const readSafeFile = (root, relativePath) => {
  assertRelativePath(relativePath);
  const rootReal = realpathSync(root);
  let current = rootReal;
  for (const part of relativePath.split('/')) {
    current = path.join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) fail('SYMLINK_PATH', `Symlink is forbidden: ${relativePath}`);
  }
  const real = realpathSync(current);
  if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) {
    fail('UNSAFE_PATH', `Path escaped repository root: ${relativePath}`);
  }
  if (!lstatSync(real).isFile()) fail('UNSAFE_PATH', `Capability artifact is not a file: ${relativePath}`);
  return readFileSync(real);
};

const closureFor = (root) => {
  const entries = artifactPaths().map((relativePath) => ({
    path: relativePath,
    sha256: sha256(readSafeFile(root, relativePath)),
  }));
  return {
    algorithm: 'sha256-raw-bytes',
    entries,
    sha256: sha256(canonicalJsonBytes({ algorithm: 'sha256-raw-bytes', entries })),
  };
};

const capabilityPreimage = (bundle) => {
  const { capabilitySetSha256: _digest, ...preimage } = bundle;
  return preimage;
};

export function buildCapabilityBundle(root) {
  const bundle = {
    apiVersion: PHASE_API_VERSION,
    bundleId: 'issue-phase-capability-bundle-v1',
    closure: closureFor(root),
    mirrors: MIRRORS,
    phases: PHASE_CAPABILITIES,
    repositoryOrigin: 'https://github.com/Mineru98/skills-store',
    schemaVersion: 1,
  };
  return {
    ...bundle,
    capabilitySetSha256: sha256(canonicalJsonBytes(bundle)),
  };
}

const validatePhase = (phase, index) => {
  exactKeys(phase, [
    'approvalClasses', 'checkpoint', 'effects', 'invocation', 'phaseId',
    'reconciliationQueries', 'requestSchemaPath', 'skill',
  ], `phases[${index}]`);
  if (!PHASE_IDS.includes(phase.phaseId)) return;
  if (phase.skill !== phase.phaseId.split('.')[0]) fail('INVALID_BUNDLE', `Wrong skill for ${phase.phaseId}`);
  assertRelativePath(phase.requestSchemaPath);
  if (!Array.isArray(phase.invocation) || phase.invocation.some((part) => typeof part !== 'string')) {
    fail('INVALID_BUNDLE', `Invalid invocation for ${phase.phaseId}`);
  }
  for (const part of phase.invocation) {
    if (path.isAbsolute(part)) fail('UNSAFE_PATH', `Absolute invocation path for ${phase.phaseId}`);
  }
  if (!Array.isArray(phase.effects) || !Array.isArray(phase.approvalClasses)
    || !Array.isArray(phase.reconciliationQueries) || phase.reconciliationQueries.length === 0) {
    fail('INVALID_BUNDLE', `Incomplete capability record for ${phase.phaseId}`);
  }
  exactKeys(phase.checkpoint, ['owner', 'requestFields', 'responseOwner'], `checkpoint ${phase.phaseId}`);
  for (const item of phase.effects) {
    exactKeys(item, ['approvalClass', 'type'], `effect ${phase.phaseId}`);
    if (!['local-idempotent', 'approval-required', 'uncertain-non-idempotent'].includes(item.approvalClass)) {
      fail('INVALID_BUNDLE', `Unknown approval class for ${phase.phaseId}`);
    }
  }
  const declaredClasses = uniqueSorted(phase.effects.map((item) => item.approvalClass));
  if (JSON.stringify(declaredClasses) !== JSON.stringify(phase.approvalClasses)) {
    fail('INVALID_BUNDLE', `Approval class drift for ${phase.phaseId}`);
  }
  for (const item of phase.reconciliationQueries) {
    exactKeys(item, ['fields', 'kind'], `reconciliation query ${phase.phaseId}`);
    if (typeof item.kind !== 'string' || !Array.isArray(item.fields) || item.fields.length === 0) {
      fail('INVALID_BUNDLE', `Invalid reconciliation query for ${phase.phaseId}`);
    }
  }
};

const verifyMirrors = (root) => {
  const canonicalBundle = readSafeFile(root, BUNDLE_PATH);
  for (const mirror of MIRRORS) {
    for (const skill of Object.keys(REQUEST_CONTRACTS)) {
      const base = `${mirror.root}/skills/${skill}`;
      const pairs = [
        [REQUEST_CONTRACTS[skill], `${base}/${REQUEST_CONTRACTS[skill]}`],
        ['schemas/issue-phase/capability-bundle-v1.schema.json', `${base}/schemas/issue-phase/capability-bundle-v1.schema.json`],
        ['schemas/issue-phase/phase-envelope-v1.schema.json', `${base}/schemas/issue-phase/phase-envelope-v1.schema.json`],
        ['schemas/issue-phase/phase-protocol-v1.json', `${base}/schemas/issue-phase/phase-protocol-v1.json`],
      ];
      for (const [canonical, installed] of pairs) {
        if (!readSafeFile(root, canonical).equals(readSafeFile(root, installed))) {
          fail('MIRROR_DRIFT', `${installed} differs from ${canonical}`);
        }
      }
      if (!canonicalBundle.equals(readSafeFile(root, `${base}/${BUNDLE_PATH}`))) {
        fail('MIRROR_DRIFT', `${base}/${BUNDLE_PATH} differs from ${BUNDLE_PATH}`);
      }
    }
  }
};

export function verifyCapabilityBundle(root) {
  const bytes = readSafeFile(root, BUNDLE_PATH);
  let bundle;
  try {
    bundle = parseCanonicalJson(bytes);
  } catch (error) {
    fail('INVALID_BUNDLE', error instanceof Error ? error.message : String(error));
  }
  exactKeys(bundle, [
    'apiVersion', 'bundleId', 'capabilitySetSha256', 'closure', 'mirrors',
    'phases', 'repositoryOrigin', 'schemaVersion',
  ], 'bundle');
  if (!Array.isArray(bundle.phases)) fail('INVALID_BUNDLE', 'phases must be an array');
  const actualIds = bundle.phases.map((phase) => phase.phaseId);
  if (actualIds.length !== PHASE_IDS.length
    || JSON.stringify(actualIds) !== JSON.stringify(PHASE_IDS)) {
    fail('PHASE_SET_MISMATCH', 'Capability phase IDs must equal the exact 13/11/9 inventory');
  }
  bundle.phases.forEach(validatePhase);
  if (!canonicalJsonBytes(bundle.phases).equals(canonicalJsonBytes(PHASE_CAPABILITIES))) {
    fail('NORMATIVE_PHASE_MISMATCH', 'Capability phases differ from the independent normative oracle');
  }
  if (!canonicalJsonBytes(bundle.mirrors).equals(canonicalJsonBytes(MIRRORS))) {
    fail('NORMATIVE_MIRROR_MISMATCH', 'Capability mirrors differ from the independent normative oracle');
  }
  verifyMirrors(root);
  exactKeys(bundle.closure, ['algorithm', 'entries', 'sha256'], 'closure');
  if (bundle.closure.algorithm !== 'sha256-raw-bytes' || !Array.isArray(bundle.closure.entries)) {
    fail('INVALID_BUNDLE', 'Invalid raw-byte closure');
  }
  const expectedPaths = artifactPaths();
  const actualPaths = bundle.closure.entries.map((entry) => entry.path);
  actualPaths.forEach(assertRelativePath);
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    fail('CLOSURE_SET_MISMATCH', 'Closure paths are not the complete sorted artifact set');
  }
  for (const [index, entry] of bundle.closure.entries.entries()) {
    exactKeys(entry, ['path', 'sha256'], `closure.entries[${index}]`);
    const actualHash = sha256(readSafeFile(root, entry.path));
    if (entry.sha256 !== actualHash) {
      fail('CLOSURE_HASH_MISMATCH', `Raw-byte digest mismatch: ${entry.path}`);
    }
  }
  const closureDigest = sha256(canonicalJsonBytes({
    algorithm: bundle.closure.algorithm,
    entries: bundle.closure.entries,
  }));
  if (closureDigest !== bundle.closure.sha256) fail('CLOSURE_HASH_MISMATCH', 'Closure digest mismatch');
  const capabilityDigest = sha256(canonicalJsonBytes(capabilityPreimage(bundle)));
  if (capabilityDigest !== bundle.capabilitySetSha256) {
    fail('CAPABILITY_DIGEST_MISMATCH', 'Capability set digest mismatch');
  }
  return {
    capabilitySetSha256: capabilityDigest,
    closureEntries: bundle.closure.entries.length,
    closureSha256: closureDigest,
    eligible: true,
    mirrorCount: bundle.mirrors.length,
    phaseCount: bundle.phases.length,
  };
}

const endInputs = {
  'issue-end.context': {
    branch: 'feat/49', dirty: false, expectedHeadSha: 'a'.repeat(40), headSha: 'a'.repeat(40),
    isLinkedWorktree: true, issue: 49, openPr: null,
  },
  'issue-end.approval-evidence': {
    evidenceChanged: false, evidenceComplete: true, evidencePublished: true, humanEvidenceApproved: true,
  },
  'issue-end.before-recapture': { beforeCaptured: true, pureTreeReady: true, required: false },
  'issue-end.after-recapture': { afterCaptured: true, required: false },
  'issue-end.report': {
    humanReportApproved: true, reportDigest: 'b'.repeat(64), reportPresent: true, reportValid: true,
  },
  'issue-end.publish-evidence': {
    branchPushApproved: false, branchPushed: true, evidencePublished: true,
    headSha: 'a'.repeat(40), required: false,
  },
  'issue-end.sync-base': { baseSynced: true, blocked: false, required: false },
  'issue-end.comment': { commentPublished: true, evidencePublished: true, required: false },
  'issue-end.review-approval': {
    reportApproved: true, reportDigest: 'b'.repeat(64), reviewApproved: true,
  },
  'issue-end.pr': {
    branchPushed: true, expectedHeadSha: 'a'.repeat(40), headSha: 'a'.repeat(40),
    openPr: { headSha: 'a'.repeat(40), number: 7, url: 'https://example.test/pr/7' },
    prCreateApproved: false, reviewApproved: true, statusReview: true,
  },
  'issue-end.handback': {
    nextActions: ['issue-merge', 'issue-start', 'issue-create', 'stop'],
    pr: { number: 7, url: 'https://example.test/pr/7' }, statusReview: true,
  },
};

const invokeRequest = (root, mirror, skill, request, directory) => {
  const requestPath = path.join(directory, `${skill}-${request.phaseId.replaceAll('.', '-')}.json`);
  writeFileSync(requestPath, canonicalJsonBytes(request));
  return spawnSync(
    process.execPath,
    [
      path.join(root, mirror.root, 'skills', skill, 'scripts', SCRIPT_NAMES[skill]),
      'phase',
      '--request',
      requestPath,
    ],
    { encoding: 'utf8', timeout: 5_000 },
  );
};

const invokeInstalledMirror = (root, mirror, phases) => {
  const directory = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'issue-phase-probe-')));
  const outcomes = new Map();
  try {
    let startState = {
      issue: 49,
      baseCheckout: path.join(directory, 'base'),
      issueWorktree: null,
      branch: null,
      completedPhases: [],
      beforeCaptured: false,
      implementationCommitted: false,
      evidenceCommitted: false,
      evidencePushed: false,
      commentPublished: false,
      baseSynced: false,
    };
    mkdirSync(startState.baseCheckout, { recursive: true });
    const startInput = {
      baseDirty: false,
      issueBody: 'Compatibility probe',
      classification: 'backend',
      planPath: path.join(startState.baseCheckout, 'plan.md'),
      intendedWorktree: path.join(directory, 'issue-49'),
      intendedBranch: 'feat/49-probe',
      commitMessage: 'test: compatibility probe',
      beforeArtifact: path.join(directory, 'issue-49', 'before.json'),
      afterArtifact: path.join(directory, 'issue-49', 'after.json'),
      commentFile: path.join(directory, 'issue-49', 'comment.md'),
      baseBranch: 'main',
    };
    for (const phase of phases) {
      let request;
      if (phase.skill === 'issue-start') {
        request = {
          apiVersion: PHASE_API_VERSION,
          contractId: 'issue-start-phase-api-v1',
          phaseId: phase.phaseId,
          checkpoint: {
            id: `${phase.phaseId}:${startState.completedPhases.length}`,
            owner: 'issue-start',
            attempt: 1,
          },
          state: startState,
          input: startInput,
          effectResult: null,
        };
      } else if (phase.skill === 'issue-end') {
        request = {
          apiVersion: PHASE_API_VERSION,
          contractId: 'issue-end-phase-api-v1',
          phaseId: phase.phaseId,
          checkpoint: { id: `${phase.phaseId}:probe`, owner: 'issue-end', attempt: 1 },
          input: endInputs[phase.phaseId],
        };
      } else {
        request = {
          apiVersion: PHASE_API_VERSION,
          contractId: 'issue-merge-phase-api-v1',
          phaseId: phase.phaseId,
          checkpoint: { id: `${phase.phaseId}:probe`, attempt: 1 },
          data: {},
        };
      }
      let result = invokeRequest(root, mirror, phase.skill, request, directory);
      const effectTypes = [];
      if (result.status === 3 && phase.skill === 'issue-start') {
        const held = parseCanonicalJson(result.stdout);
        if (held.proposedEffect) {
          effectTypes.push(held.proposedEffect.type);
          request.effectResult = {
            approvalId: held.proposedEffect.approvalId,
            status: 'succeeded',
            receipt: `fake-provider:${phase.phaseId}`,
          };
          result = invokeRequest(root, mirror, phase.skill, request, directory);
        }
      }
      if (result.status === 0 && phase.skill === 'issue-start') {
        startState = parseCanonicalJson(result.stdout).data.state;
      }
      outcomes.set(phase.phaseId, { effectTypes, status: result.status, stderr: result.stderr });
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  return outcomes;
};

export async function probeCapabilityBundle(root, options = {}) {
  const verified = verifyCapabilityBundle(root);
  for (const mirror of MIRRORS) {
    const installed = options.invoke ? null : invokeInstalledMirror(root, mirror, PHASE_CAPABILITIES);
    for (const phase of PHASE_CAPABILITIES) {
      const outcome = options.invoke
        ? await options.invoke({ mirror, phase })
        : installed.get(phase.phaseId);
      if (outcome.status !== 0) {
        fail('PROVIDER_FAILURE', `${mirror.id}:${phase.phaseId} exited ${outcome.status}`);
      }
      const declared = new Set(phase.effects.map((item) => item.type));
      for (const effectType of outcome.effectTypes ?? []) {
        if (!declared.has(effectType)) {
          fail('UNDOCUMENTED_EFFECT', `${mirror.id}:${phase.phaseId} emitted ${effectType}`);
        }
      }
    }
  }
  return { ...verified, probedInvocations: MIRRORS.length * PHASE_CAPABILITIES.length };
}
