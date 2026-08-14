import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deriveExecution, renderHtml, outputPath } from '../.claude/skills/issue-viz/scripts/issue-viz.mjs';

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
assert.ok(html.includes("mode='execution'"));
assert.ok(html.includes('id="lanes"'));
assert.ok(html.includes('지금 착수'));
assert.ok(html.includes('toggle-done'));
assert.ok(html.includes('toggle-active-edges'));
assert.ok(html.includes('완료 대기'));
assert.ok(html.includes('function drawEdges()'));
const hostile = renderHtml({ ...graph, nodes: { 1: node(1, 'open', { url: 'https://github.com/\" onfocus=\"alert(1)' }) } });
assert.match(hostile, /function safeUrl\(v\)\{try\{var url=new URL/);
assert.match(hostile, /href="'\+esc\(safeUrl\(n.url\)\)\+'"/);
assert.match(hostile, /'<li>#'\+esc\(id\)/);
const temporaryRepo = mkdtempSync(path.join(os.tmpdir(), 'issue-viz-output-'));
const outside = mkdtempSync(path.join(os.tmpdir(), 'issue-viz-outside-'));
assert.throws(() => outputPath(temporaryRepo, '../escape.html'), /저장소 안/);
assert.match(outputPath(temporaryRepo, '.issue/viz/graph.html'), /\.issue\/viz\/graph\.html$/);
symlinkSync(outside, path.join(temporaryRepo, 'linked'));
assert.throws(() => outputPath(temporaryRepo, 'linked/escape.html'), /저장소 안/);
rmSync(temporaryRepo, { recursive: true, force: true });
rmSync(outside, { recursive: true, force: true });
console.log('issue-viz V2 tests passed');
