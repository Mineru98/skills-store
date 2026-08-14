import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deriveExecution, renderHtml, outputPath, krTokenize, miniSearchInline } from '../.claude/skills/issue-viz/scripts/issue-viz.mjs';

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
assert.ok(html.includes('edge-chips'));
assert.ok(html.includes('edge-pop'));
assert.ok(html.includes('edge-hit'));
assert.ok(html.includes('해소됨'));
assert.ok(html.includes('근거 갱신 필요'));
assert.ok(html.includes('추정'));
assert.ok(html.includes('650'));
assert.ok(html.includes("ev.key==='Escape'"));
assert.ok(html.includes('<details><summary>Raw JSON'));
assert.ok(html.includes('e.rationale||e.type'), 'rationale 폴백 경로');

// --- #96 MiniSearch 맥락 검색 ---
assert.deepEqual(krTokenize('그래프를'), ['그래프를', '그래', '래프', '프를'], '한글 bigram');
assert.ok(krTokenize('DAG 관리 스킬').includes('dag'), '소문자 정규화');
assert.ok(krTokenize('그래프 갱신'.normalize('NFD')).includes('그래프'), 'NFD 입력 NFC 정규화');
assert.ok(miniSearchInline().startsWith('/*! MiniSearch'), 'vendored 파일 + MIT 배너');
assert.ok(html.includes('MiniSearch'), '렌더 HTML 에 MiniSearch 인라인');
assert.ok(html.includes('function krTokenize'), '클라이언트 토크나이저');
assert.ok(html.includes('rel-results'), '관계 결과 그룹');
assert.ok(html.includes('<mark>'), '스니펫 하이라이트');
assert.ok(html.includes('hay(n).indexOf(q)>=0'), 'substring fallback 유지');
assert.ok(!html.includes('cdn.') && !html.includes('unpkg'), '외부 CDN 참조 없음');
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
