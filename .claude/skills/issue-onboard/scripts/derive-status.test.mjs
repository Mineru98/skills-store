import assert from 'node:assert/strict';
import test from 'node:test';

import { classify, deriveStatus } from './issue-onboard.mjs';

test('tracker CLOSED and MERGED states override stale status labels', () => {
  assert.equal(deriveStatus([{ name: 'status:open' }], 'CLOSED'), 'close');
  assert.equal(deriveStatus([{ name: 'status:plan' }], 'MERGED'), 'close');
});
test('open issues retain status labels or fall back to open', () => {
  assert.equal(deriveStatus([{ name: 'status:plan' }], 'OPEN'), 'plan');
  assert.equal(deriveStatus([], 'OPEN'), 'open');
});

test('a closed derived node is classified as done', () => {
  const graph = {
    nodes: {
      '101': { status: deriveStatus([{ name: 'status:open' }], 'CLOSED'), labels: [] },
    },
    edges: [],
  };
  assert.deepEqual(classify(graph).done, [101]);
});
