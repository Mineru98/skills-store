#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  EDGE_TYPES, digest, normalizeEdge, parseDecisionComments, decisionEdge,
  validateGraphV2, duplicateScore, duplicateVerdict,
} from '../.codex/skills/issue-todo/scripts/issue-graph-v2.mjs';
import { deriveStatus } from '../.codex/skills/issue-todo/scripts/issue-todo.mjs';

assert.deepEqual(EDGE_TYPES, ['depends-on', 'parent-of', 'duplicate-of', 'relates-to', 'supersedes']);
assert.deepEqual(normalizeEdge({ from: 9, to: 4, type: 'relates-to' }), { from: 4, to: 9, type: 'relates-to' });
assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));

const body = `<!-- issue-graph-v2-decision
{"version":1,"id":"duplicate-9-4","action":"relation","decision":"approved","type":"duplicate-of","from":9,"to":4,"evidence":["https://example.test/evidence"]}
-->`;
const [decision] = parseDecisionComments([{ id: 'comment-1', url: 'https://example.test/comment-1', author: { login: 'reviewer' }, createdAt: '2026-08-12T00:00:00Z', body }]);
const edge = decisionEdge(decision);
assert.equal(edge.decisionId, 'duplicate-9-4');
assert.equal(edge.provenance.commentId, 'comment-1');

const graph = {
  version: 2,
  snapshot: { status: 'complete' },
  nodes: { '4': { number: 4 }, '9': { number: 9 } },
  edges: [edge],
};
assert.deepEqual(validateGraphV2(graph), []);
assert.match(validateGraphV2({ ...graph, snapshot: { status: 'partial' } })[0], /snapshot/);
assert.match(validateGraphV2({ ...graph, edges: [{ ...edge, decisionId: undefined }] })[0], /duplicate-of/);
assert.match(validateGraphV2({ ...graph, edges: [{ from: 4, to: 9, type: 'parent-of', provenance: {} }, { from: 9, to: 4, type: 'parent-of', provenance: {} }] }).join('\n'), /parent-of 순환/);

const score = duplicateScore(
  { title: 'cache sync fails on partial GitHub page', scope: 'issue graph snapshot', mechanism: 'pagination', acceptance: 'reject partial cache' },
  { title: 'partial GitHub page breaks cache sync', scope: 'issue graph snapshot', mechanism: 'pagination', acceptance: 'reject partial cache' },
);
assert.equal(duplicateVerdict(score), 'review-required');
assert.equal(duplicateVerdict(0.8), 'candidate');
assert.equal(duplicateVerdict(0.2), 'distinct');
assert.equal(deriveStatus([], 'MERGED'), 'close');

console.log('test-issue-graph-v2: 통과');
