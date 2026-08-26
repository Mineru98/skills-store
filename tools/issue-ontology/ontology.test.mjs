import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertAction,
  loadOntology,
  validateActionDocument,
  validateGraphDocument,
} from './validate.mjs';
import {
  EDGE_TYPES,
  validateGraphV2,
} from '../../.claude/skills/issue-onboard/scripts/issue-graph-v2.mjs';
import { readyFact } from '../../.claude/skills/issue-start/scripts/issue-start.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name) => JSON.parse(readFileSync(
  path.join(root, 'tools/issue-ontology/fixtures', name),
  'utf8',
));

test('valid graph passes Ajv and the schema contains the live snapshot keys', () => {
  const graph = fixture('graph-valid.json');
  const result = validateGraphDocument(graph);
  assert.equal(result.valid, true);
  assert.deepEqual(Object.keys(graph.snapshot).sort(), ['digest', 'fetchedAt', 'reason', 'status']);
});

test('Ajv rejects blocks and unknown graph root properties', () => {
  const graph = fixture('graph-valid.json');
  graph.edges[0].type = 'blocks';
  assert.equal(validateGraphDocument(graph).valid, false);

  const extra = fixture('graph-valid.json');
  extra.pr = {};
  assert.equal(validateGraphDocument(extra).valid, false);
});

test('the walker rejects a parent-of cycle after Ajv shape validation', () => {
  const graph = fixture('graph-parent-cycle.json');
  assert.equal(validateGraphDocument(graph).valid, true);
  assert.ok(validateGraphV2(graph).some((problem) => problem.includes('parent-of 순환')));
});

test('the schema edge enum stays aligned with the onboard walker', () => {
  const schema = loadOntology().ajv.getSchema(
    'https://skills-store.local/schemas/graph-v2.schema.json',
  );
  assert.ok(schema);
  const edgeSchema = schema.schema.$defs.edge.properties.type;
  assert.deepEqual(edgeSchema.enum, EDGE_TYPES);
});

test('start requires an open tracker issue and a ready result when checked', () => {
  const base = {
    gitRepo: true,
    trackerAuth: true,
    issueExists: true,
    trackerStateOpen: true,
  };
  assert.doesNotThrow(() => assertAction('start', { ...base, readyChecked: false }));
  assert.doesNotThrow(() => assertAction('start', {
    ...base,
    readyChecked: true,
    ready: true,
  }));
  assert.throws(() => assertAction('start', { ...base, readyChecked: true }), /schema validation failed/);
  assert.throws(() => assertAction('start', {
    ...base,
    trackerStateOpen: false,
    readyChecked: false,
  }), /schema validation failed/);
});

test('create has only git and tracker preconditions', () => {
  const schema = JSON.parse(readFileSync(
    path.join(root, 'tools/issue-ontology/schemas/actions/create.schema.json'),
    'utf8',
  ));
  assert.equal(Object.hasOwn(schema.properties, 'issue'), false);
  assert.equal(validateActionDocument({
    action: 'create',
    observed: { gitRepo: true, trackerAuth: true },
  }).valid, true);
  assert.throws(() => assertAction('create', {
    gitRepo: true,
    trackerAuth: false,
  }), /schema validation failed/);
});

test('end and merge require complete before and after evidence', () => {
  const end = { gitRepo: true, trackerAuth: true, issueExists: true, evidenceComplete: false };
  assert.throws(() => assertAction('end', end), /schema validation failed/);
  assert.doesNotThrow(() => assertAction('end', { ...end, evidenceComplete: true }));

  const merge = {
    action: 'merge',
    graphPresent: true,
    observed: { gitRepo: true, trackerAuth: true, issueExists: true, evidenceComplete: false },
  };
  assert.throws(() => assertAction(merge), /schema validation failed/);
  assert.doesNotThrow(() => assertAction({
    ...merge,
    observed: { ...merge.observed, evidenceComplete: true },
  }));
});

test('missing island is an explicit skip for the human end guard', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'issue-ontology-'));
  const script = path.join(root, '.claude/skills/issue-end/scripts/issue-end.mjs');
  const result = spawnSync(process.execPath, [script, 'ontology-guard', '--skip-ok'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ISSUE_ONTOLOGY_ROOT: empty },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /ONTOLOGY_SKIPPED=1/);
});

test('a failed sibling plan probe keeps start ready unchecked', () => {
  const isolated = mkdtempSync(path.join(tmpdir(), 'issue-start-'));
  mkdirSync(path.join(isolated, '.issue'), { recursive: true });
  writeFileSync(path.join(isolated, '.issue', 'graph.json'), '{}');
  assert.deepEqual(readyFact(101, isolated), { readyChecked: false });
});
