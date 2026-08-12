import assert from 'node:assert/strict';
import { deriveExecution, renderHtml } from '../.claude/skills/issue-viz/scripts/issue-viz.mjs';

const node = (number, status = 'open', extra = {}) => ({ number, status, title: `Issue ${number}`, labels: [], ...extra });
const graph = {
  snapshot: { status: 'complete' },
  nodes: { 1: node(1), 2: node(2), 3: node(3), 4: node(4), 5: node(5) },
  edges: [
    { from: 2, to: 1, type: 'depends-on' }, { from: 3, to: 1, type: 'depends-on' },
    { from: 4, to: 2, type: 'depends-on' }, { from: 5, to: 3, type: 'depends-on' },
  ],
};
const execution = deriveExecution(graph);
assert.deepEqual(execution.criticalPaths, [['1', '2', '4'], ['1', '3', '5']]);
assert.equal(execution.stateOf(graph.nodes[1]), 'ready');
assert.equal(execution.stateOf(graph.nodes[4]), 'blocked');

const cycle = deriveExecution({ ...graph, edges: [{ from: 1, to: 2, type: 'depends-on' }, { from: 2, to: 1, type: 'depends-on' }] });
assert.deepEqual(cycle.cycle, ['1', '2', '1']);
assert.equal(cycle.canExecute, false);
assert.equal(deriveExecution({ ...graph, snapshot: {} }).reason, 'SNAPSHOT_REASON_UNAVAILABLE');
const html = renderHtml({ ...graph, nodes: { 1: node(1, 'open', { title: '</script><img src=x onerror=alert(1)>', context: { scope: { value: 'unknown', reason: 'missing', source: 'fixture' } } }) } });
assert.ok(!html.includes('</script><img'));
assert.ok(html.includes('작업 맥락'));
console.log('issue-viz V2 tests passed');
