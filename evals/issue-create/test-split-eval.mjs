#!/usr/bin/env node
import assert from 'node:assert/strict';
import { aggregateScores, parseModelJson, scoreCase } from './split-eval-lib.mjs';

const expected = {
  requirements: [
    { id: 'r1', text: 'API 응답에 상태를 추가한다', label: 'enhancement' },
    { id: 'r2', text: '목록에 상태를 표시한다', label: 'enhancement' },
    { id: 'r3', text: '레거시 스크립트를 제거한다', label: 'chore' },
  ],
  expected_groups: [['r1', 'r2'], ['r3']],
  expected_group_labels: ['enhancement', 'chore'],
  expected_issue_count: 2,
  decision: 'partial',
};
const response = parseModelJson('```json\n{"decision":"partial","requirements":[{"id":"a","quote":"API 응답에 상태를 추가한다"},{"id":"b","quote":"목록에 상태를 표시한다"},{"id":"c","quote":"레거시 스크립트를 제거한다"}],"groups":[{"requirement_ids":["a","b"],"label":"enhancement"},{"requirement_ids":["c"],"label":"chore"}]}\n```');
const score = scoreCase(expected, response);
assert.equal(score.grouping_exact, 1);
assert.equal(score.issue_count_correct, 1);
assert.equal(score.decision_correct, 1);
const metrics = aggregateScores([{ score }]);
assert.equal(metrics.atom_f1, 1);
assert.equal(metrics.grouping_exact_accuracy, 1);
console.log('✓ split eval scorer tests passed');
