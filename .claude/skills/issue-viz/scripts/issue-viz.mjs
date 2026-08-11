#!/usr/bin/env node
/**
 * issue-viz.mjs — issue-todo 가 만든 .issue/graph.json 을 인터랙티브 HTML 로 렌더한다.
 *
 * semantica 의 Knowledge Explorer(force-directed + ego-mode)를 참고하되,
 * 외부 CDN 없이 바닐라 JS 힘-지향 시뮬레이션으로 자립형 HTML 1파일을 만든다.
 * 오프라인에서도 열린다. DAG 분류·critical-path 계산은 브라우저에서 한다.
 *
 * 서브커맨드:
 *   render   graph.json 을 읽어 HTML 을 생성한다(기본).
 *
 * 옵션:
 *   --out <path>              출력 경로 (기본 .issue/viz/graph.html)
 *   --view full|ready|critical-path|ego   초기 뷰 (기본 full)
 *   --focus <n>              ego 뷰의 중심 이슈 번호
 *   --open                   생성 후 브라우저로 연다
 *
 * 요구사항: Node 18+, .issue/graph.json (issue-todo sync 로 생성)
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { repoRoot, WORKSPACE_DIR, GRAPH_FILE_NAME } from './issue-common.mjs';

export const DEFAULT_OUT = `${WORKSPACE_DIR}/viz/graph.html`;

export function loadGraph(root) {
  const file = path.join(root, WORKSPACE_DIR, GRAPH_FILE_NAME);
  if (!existsSync(file)) {
    console.error(`✗ ${WORKSPACE_DIR}/${GRAPH_FILE_NAME} 이 없다. 먼저 issue-todo sync 를 실행하라.`);
    process.exit(1);
  }
  try {
    const g = JSON.parse(readFileSync(file, 'utf8'));
    return { nodes: g.nodes ?? {}, edges: g.edges ?? [], provider: g.provider ?? 'github', updatedAt: g.updatedAt };
  } catch (e) {
    console.error(`✗ graph.json 파싱 실패: ${e.message}`);
    process.exit(1);
  }
}

/** 브라우저에서 도는 클라이언트 스크립트. 백틱·${}} 를 피해 문자열 연결로 쓴다(외부 템플릿과 충돌 방지). */
const CLIENT_JS = String.raw`
(function () {
  var NODES = Object.values(GRAPH.nodes);
  var EDGES = GRAPH.edges || [];
  var ORDER = { 'depends-on': 1, 'blocks': 1 };
  var STATUS_COLOR = {
    open: '#3b82f6', plan: '#eab308', 'in-process': '#22c55e',
    review: '#a855f7', close: '#9ca3af'
  };
  var TYPE_COLOR = {
    'depends-on': '#ef4444', 'blocks': '#f97316',
    'relates-to': '#64748b', 'parent-of': '#0ea5e9', 'duplicate-of': '#94a3b8'
  };

  // ---- 파생: 선행 맵, 분류, critical-path ----
  function prereqMap() {
    var m = {};
    NODES.forEach(function (n) { m[n.number] = {}; });
    EDGES.forEach(function (e) {
      if (e.type === 'depends-on') { m[e.from] = m[e.from] || {}; m[e.from][e.to] = 1; }
      else if (e.type === 'blocks') { m[e.to] = m[e.to] || {}; m[e.to][e.from] = 1; }
    });
    return m;
  }
  var PRE = prereqMap();
  var byNum = {};
  NODES.forEach(function (n) { byNum[n.number] = n; });
  function statusOf(num) { return (byNum[num] || {}).status || 'open'; }
  function classOf(num) {
    if (statusOf(num) === 'close') return 'done';
    var blockers = Object.keys(PRE[num] || {}).filter(function (d) { return statusOf(d) !== 'close'; });
    if (blockers.length) return 'blocked';
    if (statusOf(num) === 'open') return 'ready';
    return 'in-progress';
  }
  // 최장 의존 사슬(노드 집합)
  function criticalPath() {
    var memo = {}, parent = {};
    function depth(num) {
      if (memo[num] !== undefined) return memo[num];
      memo[num] = 0;
      var deps = Object.keys(PRE[num] || {});
      for (var i = 0; i < deps.length; i++) {
        if (!byNum[deps[i]]) continue;
        var d = depth(deps[i]) + 1;
        if (d > memo[num]) { memo[num] = d; parent[num] = deps[i]; }
      }
      return memo[num];
    }
    var best = -1, tail = null;
    NODES.forEach(function (n) { var d = depth(n.number); if (d > best) { best = d; tail = n.number; } });
    var set = {}, cur = tail;
    while (cur != null) { set[cur] = 1; cur = parent[cur]; }
    return set;
  }
  var CRIT = criticalPath();
  function egoSet(focus, hops) {
    var set = {}, frontier = {};
    set[focus] = 1; frontier[focus] = 1;
    for (var h = 0; h < hops; h++) {
      var next = {};
      EDGES.forEach(function (e) {
        if (frontier[e.from]) { if (!set[e.to]) { set[e.to] = 1; next[e.to] = 1; } }
        if (frontier[e.to]) { if (!set[e.from]) { set[e.from] = 1; next[e.from] = 1; } }
      });
      frontier = next;
    }
    return set;
  }

  // ---- force 시뮬레이션 ----
  var W = window.innerWidth, H = window.innerHeight - 46;
  var sim = NODES.map(function (n, i) {
    var a = (i / NODES.length) * Math.PI * 2;
    return { num: n.number, x: W / 2 + Math.cos(a) * 250 + (i % 7) * 13,
             y: H / 2 + Math.sin(a) * 250 + (i % 5) * 11, vx: 0, vy: 0 };
  });
  var pos = {};
  sim.forEach(function (p) { pos[p.num] = p; });
  var links = EDGES.filter(function (e) { return pos[e.from] && pos[e.to]; });

  function tick() {
    for (var i = 0; i < sim.length; i++) {
      var a = sim[i];
      for (var j = i + 1; j < sim.length; j++) {
        var b = sim[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy || 1;
        var f = 3200 / d2;
        var d = Math.sqrt(d2);
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    links.forEach(function (e) {
      var a = pos[e.from], b = pos[e.to];
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var f = (d - 120) * 0.02;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    });
    sim.forEach(function (a) {
      a.vx += (W / 2 - a.x) * 0.002; a.vy += (H / 2 - a.y) * 0.002;
      a.vx *= 0.85; a.vy *= 0.85;
      a.x += a.vx; a.y += a.vy;
    });
  }
  for (var it = 0; it < 320; it++) tick();

  // ---- SVG 렌더 ----
  var svg = document.getElementById('g');
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  var view = { mode: INIT_VIEW, focus: INIT_FOCUS, hops: 1 };
  function visible(num) {
    if (view.mode === 'full') return true;
    if (view.mode === 'ready') return classOf(num) === 'ready';
    if (view.mode === 'critical-path') return !!CRIT[num];
    if (view.mode === 'ego') return view.focus != null && egoSet(view.focus, view.hops)[num];
    return true;
  }

  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var defs = el('defs', {});
    Object.keys(TYPE_COLOR).forEach(function (t) {
      var m = el('marker', { id: 'arrow-' + t, viewBox: '0 0 10 10', refX: 18, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      m.appendChild(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: TYPE_COLOR[t] }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    links.forEach(function (e) {
      if (!visible(e.from) || !visible(e.to)) return;
      var a = pos[e.from], b = pos[e.to];
      var line = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: TYPE_COLOR[e.type] || '#888', 'stroke-width': ORDER[e.type] ? 2 : 1.2,
        'stroke-dasharray': ORDER[e.type] ? '' : '5,4',
        'marker-end': 'url(#arrow-' + (e.type) + ')', opacity: 0.75 });
      var t = document.createElementNS(NS, 'title');
      t.textContent = '#' + e.from + ' --' + e.type + '--> #' + e.to + (e.rationale ? ' (' + e.rationale + ')' : '');
      line.appendChild(t);
      svg.appendChild(line);
    });

    NODES.forEach(function (n) {
      if (!visible(n.number)) return;
      var p = pos[n.number];
      var cls = classOf(n.number);
      var color = STATUS_COLOR[statusOf(n.number)] || '#3b82f6';
      var nature = (n.labels || []).map(function (l) { return String(l).toLowerCase(); });
      var isBack = nature.indexOf('backend') >= 0 || nature.indexOf('api') >= 0;
      var isFront = nature.indexOf('frontend') >= 0 || nature.indexOf('ui') >= 0;
      var g = el('g', { transform: 'translate(' + p.x + ',' + p.y + ')', style: 'cursor:pointer' });
      var shape;
      if (isBack && !isFront) shape = el('rect', { x: -11, y: -11, width: 22, height: 22, rx: 3 });
      else if (isFront && !isBack) shape = el('circle', { r: 12 });
      else shape = el('circle', { r: 12 });
      shape.setAttribute('fill', color);
      shape.setAttribute('opacity', cls === 'done' ? 0.35 : 1);
      shape.setAttribute('stroke', CRIT[n.number] && view.mode !== 'critical-path' ? '#111' : '#fff');
      shape.setAttribute('stroke-width', cls === 'ready' ? 3 : 1.5);
      g.appendChild(shape);
      var label = el('text', { x: 0, y: 26, 'text-anchor': 'middle', 'font-size': 10, fill: '#334155' });
      label.textContent = '#' + n.number;
      g.appendChild(label);
      var tt = document.createElementNS(NS, 'title');
      tt.textContent = '#' + n.number + ' ' + n.title + '\n상태: ' + statusOf(n.number) + ' / ' + cls
        + (n.labels && n.labels.length ? '\n라벨: ' + n.labels.join(', ') : '');
      g.appendChild(tt);
      g.addEventListener('click', function () { if (n.url) window.open(n.url, '_blank'); });
      svg.appendChild(g);
    });
    document.getElementById('status').textContent =
      '뷰: ' + view.mode + (view.mode === 'ego' && view.focus != null ? ' #' + view.focus : '')
      + ' · 노드 ' + NODES.filter(function (n) { return visible(n.number); }).length + '/' + NODES.length;
  }

  function setView(mode) { view.mode = mode; draw(); }
  window.__setView = setView;
  window.__ego = function () {
    var v = document.getElementById('ego').value.replace('#', '').trim();
    if (v) { view.mode = 'ego'; view.focus = Number(v); draw(); }
  };
  draw();
})();
`;

function renderHtml(graph, { view, focus }) {
  const data = JSON.stringify({ nodes: graph.nodes, edges: graph.edges, provider: graph.provider });
  const legendStatus = [
    ['open', '#3b82f6'], ['plan', '#eab308'], ['in-process', '#22c55e'],
    ['review', '#a855f7'], ['close(흐림)', '#9ca3af'],
  ].map(([k, c]) => `<span class="lg"><i style="background:${c}"></i>${k}</span>`).join('');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>이슈 DAG — issue-viz</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
  #bar { height: 46px; display: flex; align-items: center; gap: 8px; padding: 0 12px;
         border-bottom: 1px solid #e2e8f0; background: #fff; flex-wrap: wrap; }
  #bar button { border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; padding: 5px 10px;
                font-size: 13px; cursor: pointer; }
  #bar button:hover { background: #f1f5f9; }
  #ego { width: 70px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }
  #status { margin-left: auto; font-size: 12px; color: #64748b; }
  .lg { font-size: 11px; color: #475569; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; }
  .lg i { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
  svg { display: block; width: 100vw; }
</style></head>
<body>
<div id="bar">
  <button onclick="__setView('full')">전체</button>
  <button onclick="__setView('ready')">착수 가능</button>
  <button onclick="__setView('critical-path')">임계 경로</button>
  <input id="ego" placeholder="#번호" onkeydown="if(event.key==='Enter')__ego()">
  <button onclick="__ego()">ego</button>
  ${legendStatus}
  <span id="status"></span>
</div>
<svg id="g" height="${'100'}"></svg>
<script>
  var GRAPH = ${data};
  var INIT_VIEW = ${JSON.stringify(view || 'full')};
  var INIT_FOCUS = ${focus != null ? Number(focus) : 'null'};
</script>
<script>
document.getElementById('g').setAttribute('height', window.innerHeight - 46);
${CLIENT_JS}
</script>
</body></html>
`;
}

function cmdRender(root, opts) {
  const graph = loadGraph(root);
  const out = path.resolve(root, opts.out ?? DEFAULT_OUT);
  mkdirSync(path.dirname(out), { recursive: true });
  const html = renderHtml(graph, { view: opts.view, focus: opts.focus });
  writeFileSync(out, html, 'utf8');
  const nodes = Object.keys(graph.nodes).length;
  console.log(`✓ 렌더 완료 — 노드 ${nodes}개, 엣지 ${graph.edges.length}개`);
  console.log(`  출력: ${path.relative(root, out)}`);
  console.log('');
  console.log(`OUT=${out}`);
  console.log(`NODES=${nodes}`);
  if (opts.open) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawnSync(opener, [out], { stdio: 'ignore' });
    console.log(`OPENED=1`);
  }
}

function usage(exitCode = 1) {
  console.error(`Usage:
  node issue-viz.mjs render [--out <path>] [--view full|ready|critical-path|ego] [--focus <n>] [--open]

graph.json(.issue/graph.json)을 자립형 인터랙티브 HTML 로 렌더한다. 먼저 issue-todo sync 로 그래프를 만든다.
기본 출력: ${DEFAULT_OUT}
`);
  process.exit(exitCode);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) usage(0);
  const mode = argv.length && !argv[0].startsWith('-') ? argv[0] : 'render';
  if (mode !== 'render') { console.error(`✗ 알 수 없는 모드: ${mode}`); usage(); }

  const opts = {};
  for (let i = (argv[0] === 'render' ? 1 : 0); i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--view') opts.view = argv[++i];
    else if (arg === '--focus') opts.focus = argv[++i];
    else if (arg === '--open') opts.open = true;
    else if (arg.startsWith('-')) { console.error(`✗ 알 수 없는 옵션: ${arg}`); usage(); }
  }
  cmdRender(repoRoot(), opts);
}

function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const here = fileURLToPath(metaUrl);
  const resolved = path.resolve(entry);
  if (here === resolved) return true;
  try { return realpathSync(here) === realpathSync(resolved); } catch { return false; }
}

if (isMainModule(import.meta.url)) main();
