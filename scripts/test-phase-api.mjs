#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  EFFECT_CLASSIFICATIONS,
  LEGAL_EXIT_CODES,
  PHASE_API_VERSION,
  PHASE_CONTRACT_ID,
  PHASE_IDS,
  canonicalJsonBytes,
  canonicalJsonSha256,
  parseCanonicalJson,
  validatePhaseEnvelope,
} from '../tools/issue-phase-contract.mjs';
import './test-phase-api-issue-start.mjs';

const runSkill = (skill, args) => spawnSync(
  process.execPath,
  [`.codex/skills/${skill}/scripts/${skill}.mjs`, ...args],
  { encoding: 'utf8' },
);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const runModule = (modulePath, source) => spawnSync(
  process.execPath,
  ['--input-type=module', '--eval', `import * as contract from ${JSON.stringify(modulePath)};\n${source}`],
  { encoding: 'utf8' },
);

test('legacy issue-start help keeps its stdout and successful exit', () => {
  // Given: the existing human-oriented issue-start CLI.
  // When: its documented help flag is invoked.
  const result = runSkill('issue-start', ['--help']);

  // Then: the legacy success exit and first usage line remain unchanged.
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.split('\n')[0], 'Usage:');
  assert.match(result.stderr, /node issue-start\.mjs fetch <issue-number>/);
  assert.equal(sha256(result.stderr), 'fdf6e15cb5b7365dbd39a7039fae0be33c31e4bd866adb00f0d721d45c7585db');
});

const legacyHelpDigests = {
  'issue-end': '7c5928b20935726f9e89f41b613e3d3374618854ec3a45408104803490d3f4d7',
  'issue-merge': '7daab03694acb17077acd4c7d2c129c2606436e66d603d3251f26ac26ecdd478',
};

for (const skill of ['issue-end', 'issue-merge']) {
  test(`legacy ${skill} help keeps its stdout and failing exit`, () => {
    // Given: an existing human-oriented lifecycle CLI without a help dispatch.
    // When: the historical --help input is invoked.
    const result = runSkill(skill, ['--help']);

    // Then: its legacy usage-only stdout and exit code remain unchanged.
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr.split('\n')[0].startsWith(`Usage: node ${skill}.mjs`), true);
    assert.equal(sha256(result.stderr), legacyHelpDigests[skill]);
  });
}

const completeEnvelope = {
  apiVersion: PHASE_API_VERSION,
  contractId: PHASE_CONTRACT_ID,
  phaseId: 'issue-start.intake',
  checkpoint: { id: 'intake-complete', owner: 'issue-start', attempt: 1 },
  ok: true,
  data: { issue: 49 },
  observedFacts: [{ kind: 'tracker-state', value: { state: 'OPEN' } }],
  proposedEffect: null,
  handback: { disposition: 'complete', resume: 'next', retry: 'never' },
  error: null,
};

test('[active-required] protocol accepts the strict complete envelope and exact inventory', () => {
  // Given: a complete versioned phase response.
  // When: it crosses the shared machine boundary.
  const parsed = validatePhaseEnvelope(completeEnvelope);

  // Then: the exact protocol values survive and all planned phase IDs are registered.
  assert.deepEqual(parsed, completeEnvelope);
  assert.equal(PHASE_IDS.length, 33);
  assert.equal(new Set(PHASE_IDS).size, PHASE_IDS.length);
  assert.deepEqual(LEGAL_EXIT_CODES, {
    completed: 0,
    internalError: 1,
    invalidRequest: 2,
    held: 3,
  });
  assert.deepEqual(EFFECT_CLASSIFICATIONS, [
    'local-idempotent',
    'approval-required',
    'uncertain-non-idempotent',
  ]);
  assert.equal(validatePhaseEnvelope({
    ...completeEnvelope,
    proposedEffect: {
      approvalId: 'approval-49-push',
      classification: 'approval-required',
      type: 'git-push',
      request: { argv: ['git', 'push'] },
    },
    handback: { disposition: 'held', resume: 'same', retry: 'reconcile' },
  }).handback.disposition, 'held');
});

test('[active-required] protocol rejects unknown properties, phase IDs, effects, and ownership', () => {
  const invalidEnvelopes = [
    { ...completeEnvelope, surprise: true },
    { ...completeEnvelope, phaseId: 'issue-start.unknown' },
    {
      ...completeEnvelope,
      proposedEffect: {
        approvalId: null,
        classification: 'magic',
        type: 'push',
        request: {},
      },
      handback: { disposition: 'held', resume: 'same', retry: 'reconcile' },
    },
    { ...completeEnvelope, checkpoint: { ...completeEnvelope.checkpoint, owner: 'issue-end' } },
  ];

  for (const envelope of invalidEnvelopes) {
    assert.throws(() => validatePhaseEnvelope(envelope));
  }
});

test('[active-required] protocol enforces failure and handback resume/retry invariants', () => {
  const invalidEnvelopes = [
    { ...completeEnvelope, ok: false },
    { ...completeEnvelope, error: { code: 'FAILED', message: 'no', retryable: false } },
    { ...completeEnvelope, handback: { disposition: 'complete', resume: 'same', retry: 'never' } },
    {
      ...completeEnvelope,
      proposedEffect: {
        approvalId: null,
        classification: 'local-idempotent',
        type: 'write-local',
        request: {},
      },
    },
    {
      ...completeEnvelope,
      ok: false,
      proposedEffect: { classification: 'approval-required', type: 'push', request: {} },
      handback: { disposition: 'failed', resume: 'none', retry: 'never' },
      error: { code: 'FAILED', message: 'no', retryable: false },
    },
  ];

  for (const envelope of invalidEnvelopes) {
    assert.throws(() => validatePhaseEnvelope(envelope));
  }
});

test('[active-required] protocol schema rejects a successful failed-handback envelope', () => {
  const invalidEnvelope = {
    ...completeEnvelope,
    handback: { disposition: 'failed', resume: 'none', retry: 'never' },
  };
  const validator = [
    'import json,sys',
    'from jsonschema import Draft202012Validator',
    'schema=json.load(open(sys.argv[1], encoding="utf-8"))',
    'instance=json.load(sys.stdin)',
    'sys.exit(0 if Draft202012Validator(schema).is_valid(instance) else 2)',
  ].join(';');
  const result = spawnSync(
    'python3',
    ['-c', validator, 'schemas/issue-phase/phase-envelope-v1.schema.json'],
    { encoding: 'utf8', input: JSON.stringify(invalidEnvelope) },
  );

  assert.equal(result.status, 2, result.stderr);
});

test('[active-required] canonical matches the official RFC 8785 serialization and digest vector', () => {
  // RFC 8785 sections 3.2.2 and 3.2.3.
  const value = {
    numbers: [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],
    string: "€$\u000f\nA'B\"\\\\\"/",
    literals: [null, true, false],
  };
  const expected = '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}';
  const expectedHex = '7b226c69746572616c73223a5b6e756c6c2c747275652c66616c73655d2c226e756d62657273223a5b3333333333333333332e333333333333332c31652b33302c342e352c302e3030322c31652d32375d2c22737472696e67223a22e282ac245c75303030665c6e4127425c225c5c5c5c5c222f227d';

  assert.equal(canonicalJsonBytes(value).toString('utf8'), expected);
  assert.equal(canonicalJsonBytes(value).toString('hex'), expectedHex);
  assert.equal(canonicalJsonSha256(value), '2d5e01a318d0f0879ab568c4be289c8b1f64ef8921a53c6277d5e069978baacb');
});

test('[active-required] canonical sorts property names by raw UTF-16 code units', () => {
  const vector = {
    '\u20ac': 'Euro Sign',
    '\r': 'Carriage Return',
    '\ufb33': 'Hebrew Letter Dalet With Dagesh',
    1: 'One',
    '\ud83d\ude00': 'Emoji: Grinning Face',
    '\u0080': 'Control',
    '\u00f6': 'Latin Small Letter O With Diaeresis',
  };

  assert.equal(
    canonicalJsonBytes(vector).toString('utf8'),
    '{"\\r":"Carriage Return","1":"One","":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}',
  );
});

test('[active-required] canonical parser rejects duplicate keys, BOM, invalid numbers, and invalid Unicode', () => {
  const invalidInputs = [
    '{"x":1,"x":2}',
    '\ufeff{"x":1}',
    Buffer.from('\ufeff{"x":1}', 'utf8'),
    '{"x":1.0}',
    '{"x":9007199254740993}',
    '{"x":"\\udead"}',
    '{"x":"\\ud800"}',
    '{"\\ud800":1}',
  ];

  for (const input of invalidInputs) {
    assert.throws(() => parseCanonicalJson(input));
  }
});

test('[active-required] canonical rejects unsupported runtime values', () => {
  for (const value of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    { x: undefined },
    new Date(0),
    '\ud800',
    { '\ud800': 1 },
  ]) {
    assert.throws(() => canonicalJsonBytes(value));
  }
});

test('[active-required] protocol mirrors expose the same canonical library surface', () => {
  const source = "process.stdout.write(contract.canonicalJsonBytes({z:1,a:2}).toString('hex'))";
  const expectedHex = '7b2261223a322c227a223a317d';
  const modules = [
    './tools/issue-phase-contract.mjs',
    './.claude/skills/issue-start/scripts/issue-phase-contract.mjs',
    './.codex/skills/issue-start/scripts/issue-phase-contract.mjs',
  ];

  for (const modulePath of modules) {
    const result = runModule(modulePath, source);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, expectedHex);
  }
});
