#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  EDGE_TYPES, digest, normalizeEdge, parseDecisionComments, decisionEdge,
  validateGraphV2, duplicateScore, duplicateVerdict, evaluateDuplicate, measureFieldQuality, resolveDecisions,
} from '../.codex/skills/issue-todo/scripts/issue-graph-v2.mjs';
import { deriveStatus, classify } from '../.codex/skills/issue-todo/scripts/issue-todo.mjs';

assert.deepEqual(EDGE_TYPES, ['depends-on', 'parent-of', 'duplicate-of', 'relates-to', 'supersedes']);
assert.deepEqual(normalizeEdge({ from: 9, to: 4, type: 'relates-to' }), { from: 4, to: 9, type: 'relates-to' });
assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));

const body = `<!-- issue-graph-v2-decision
{"version":1,"id":"duplicate-9-4","action":"relation","decision":"approved","type":"duplicate-of","from":9,"to":4,"graphRevision":"sha256:fixture","evidence":["https://example.test/evidence"]}
-->`;
const [decision] = parseDecisionComments([{ id: 'comment-1', url: 'https://example.test/comment-1', author: { login: 'reviewer' }, createdAt: '2026-08-12T00:00:00Z', body }]);
const edge = decisionEdge(decision);
assert.equal(edge.decisionId, 'duplicate-9-4');
assert.equal(edge.provenance.commentId, 'comment-1');
assert.deepEqual(resolveDecisions([{ ...decision, decision: 'approved' }, { ...decision, decision: 'revoked', source: { ...decision.source, updatedAt: '2026-08-13T00:00:00Z' } }]), []);

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
const scheduling = classify({
  nodes: { '1': { status: 'close' }, '2': { status: 'open' }, '3': { status: 'open' } },
  edges: [
    { from: 2, to: 1, type: 'depends-on' },
    { from: 2, to: 3, type: 'parent-of' },
    { from: 3, to: 2, type: 'duplicate-of' },
    { from: 3, to: 2, type: 'relates-to' },
    { from: 3, to: 1, type: 'supersedes' },
  ],
});
assert.deepEqual(scheduling.ready, [2, 3], 'depends-on 외 관계는 일정을 바꾸지 않음');

const base = { number: 100, status: 'open', subject: 'graph cache', outcome: 'reject partial sync', scope: 'issue-todo', acceptance: 'plan is blocked' };
const cases = [
  ['표현만 다름', { ...base, number: 101 }, 'duplicate-review-required'],
  ['같은 컴포넌트 다른 결과', { ...base, number: 102, outcome: 'render HTML graph' }, 'distinct'],
  ['같은 증상 다른 트리거', { ...base, number: 103, scope: 'issue-viz' }, 'distinct'],
  ['키워드만 겹침', { ...base, number: 104, subject: 'cache', outcome: 'improve speed', scope: 'build', acceptance: 'fast' }, 'distinct'],
  ['닫힌 이슈', { ...base, number: 105, status: 'close' }, 'distinct'],
  ['본문 불완전', { ...base, number: 106, scope: 'unknown' }, 'review-or-create'],
  ['여러 후보 중 완전 일치', { ...base, number: 107 }, 'duplicate-review-required'],
  ['범위 일부 겹침', { ...base, number: 108, scope: 'issue-create' }, 'distinct'],
  ['명시적 예외 뒤에도 후보', { ...base, number: 109 }, 'duplicate-review-required'],
  ['승인 원본 폐기', { ...base, number: 110, acceptance: 'unknown' }, 'review-or-create'],
];
for (const [name, target, verdict] of cases) {
  const result = evaluateDuplicate(base, target);
  assert.equal(result.verdict, verdict, name);
  assert.equal(Object.keys(result.conditions).length, 4, `${name}: 네 조건 출력`);
}
assert.equal(evaluateDuplicate(base, { ...base, number: 111 }).conditions.acceptance.result, 'match');
const quality = measureFieldQuality([
  { problem: { correct: true, expected: true }, scope: { correct: true, expected: true } },
  { problem: { correct: true, expected: true }, scope: { value: 'unknown' } },
], ['problem', 'scope']);
assert.deepEqual(quality.problem, { accuracy: 1, recall: 1, unknownRate: 0, samples: 2 });
assert.equal(quality.scope.unknownRate, 0.5);

console.log('test-issue-graph-v2: 통과');
