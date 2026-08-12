#!/usr/bin/env node
/** issue-onboard 그래프를 V2 이슈 탐색 HTML·webp로 렌더한다. */
import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { repoRoot, WORKSPACE_DIR, GRAPH_FILE_NAME } from './issue-common.mjs';

export const DEFAULT_OUT = `${WORKSPACE_DIR}/viz/graph.html`;
export function loadGraph(root) {
  const file = path.join(root, WORKSPACE_DIR, GRAPH_FILE_NAME);
  if (!existsSync(file)) throw new Error(`${WORKSPACE_DIR}/${GRAPH_FILE_NAME} 이 없다. 먼저 issue-sync 를 실행하라.`);
  const graph = JSON.parse(readFileSync(file, 'utf8'));
  return { nodes: graph.nodes ?? {}, edges: graph.edges ?? [], provider: graph.provider ?? 'github', snapshot: graph.snapshot ?? {}, updatedAt: graph.updatedAt };
}

export function deriveExecution(graph) {
  const nodes = Object.values(graph.nodes ?? {});
  const by = Object.fromEntries(nodes.map((node) => [String(node.number), node]));
  const active = nodes.filter((node) => node.status !== 'close');
  const prereqs = Object.fromEntries(nodes.map((node) => [String(node.number), []]));
  for (const edge of graph.edges ?? []) if (edge.type === 'depends-on' && prereqs[String(edge.from)]) prereqs[String(edge.from)].push(String(edge.to));
  Object.values(prereqs).forEach((list) => list.sort((a, b) => Number(a) - Number(b)));
  const marks = {}, stack = [];
  let cycle = null;
  function visit(id) {
    if (cycle || marks[id] === 2) return;
    if (marks[id] === 1) { cycle = [...stack.slice(stack.indexOf(id)), id]; return; }
    marks[id] = 1; stack.push(id); (prereqs[id] ?? []).forEach(visit); stack.pop(); marks[id] = 2;
  }
  Object.keys(prereqs).sort((a, b) => Number(a) - Number(b)).forEach(visit);
  const snapshotReady = graph.snapshot?.status === 'complete';
  const reason = snapshotReady ? null : graph.snapshot?.reason || 'SNAPSHOT_REASON_UNAVAILABLE';
  const stateOf = (node) => {
    if (node.status === 'close') return 'done';
    if ((prereqs[String(node.number)] ?? []).some((id) => !by[id] || by[id].status !== 'close')) return 'blocked';
    return node.status === 'open' ? 'ready' : 'in-progress';
  };
  const paths = [];
  if (snapshotReady && !cycle) {
    const openIds = new Set(active.map((node) => String(node.number)));
    const memo = {};
    function bestTo(id) {
      if (memo[id]) return memo[id];
      const options = (prereqs[id] ?? []).filter((pre) => openIds.has(pre)).map((pre) => bestTo(pre).map((path) => [...path, id]));
      const flat = options.flat();
      const longest = flat.length ? Math.max(...flat.map((path) => path.length)) : 1;
      return memo[id] = flat.filter((path) => path.length === longest).length ? flat.filter((path) => path.length === longest) : [[id]];
    }
    const all = active.flatMap((node) => bestTo(String(node.number)));
    const longest = all.length ? Math.max(...all.map((path) => path.length)) : 0;
    const unique = new Map(all.filter((path) => path.length === longest).map((path) => [path.join(','), path]));
    paths.push(...[...unique.values()].sort((a, b) => a.map(Number).join(',').localeCompare(b.map(Number).join(','), 'en', { numeric: true })));
  }
  return { active, complete: nodes.filter((node) => node.status === 'close'), shown: nodes, prereqs, cycle, reason, canExecute: snapshotReady && !cycle, stateOf, criticalPaths: paths };
}

const CLIENT_JS = String.raw`(function(){
var nodes=Object.values(GRAPH.nodes),edges=GRAPH.edges||[],by={};nodes.forEach(function(n){by[n.number]=n});
var selected=null,mode='context',query='',filters={status:{},labels:{},types:{}};
function esc(v){return String(v==null?'':typeof v==='object'?JSON.stringify(v):v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function safeUrl(v){try{var url=new URL(String(v));return url.protocol==='https:'&&url.hostname==='github.com'?url.href:'#'}catch(error){return'#'}}
function derive(){var pre={};nodes.forEach(function(n){pre[n.number]=[]});edges.forEach(function(e){if(e.type==='depends-on'&&pre[e.from])pre[e.from].push(e.to)});var marks={},walk=[],cycle=null;function visit(id){if(cycle||marks[id]===2)return;if(marks[id]===1){cycle=walk.slice(walk.indexOf(id)).concat(id);return}marks[id]=1;walk.push(id);(pre[id]||[]).slice().sort(function(a,b){return a-b}).forEach(visit);walk.pop();marks[id]=2}Object.keys(pre).sort(function(a,b){return a-b}).forEach(visit);function state(n){if(n.status==='close')return'done';if((pre[n.number]||[]).some(function(id){return !by[id]||by[id].status!=='close'}))return'blocked';return n.status==='open'?'ready':'in-progress'}var ready=GRAPH.snapshot&&GRAPH.snapshot.status==='complete'&&!cycle;var active=nodes.filter(function(n){return n.status!=='close'}),ids={};active.forEach(function(n){ids[n.number]=1});var memo={};function longest(id){if(memo[id])return memo[id];var paths=(pre[id]||[]).filter(function(x){return ids[x]}).map(longest).flatMap(function(ps){return ps.map(function(p){return p.concat(id)})});var length=paths.length?Math.max.apply(null,paths.map(function(p){return p.length})):1;return memo[id]=paths.filter(function(p){return p.length===length})||[[id]]}var all=ready?active.flatMap(function(n){return longest(n.number)}):[],max=all.length?Math.max.apply(null,all.map(function(p){return p.length})):0,seen={},critical=[];all.filter(function(p){return p.length===max}).forEach(function(p){var k=p.join(',');if(!seen[k]){seen[k]=1;critical.push(p)}});critical.sort(function(a,b){return a.join(',').localeCompare(b.join(','),undefined,{numeric:true})});return{pre:pre,cycle:cycle,can:ready,state:state,active:active,critical:critical}}
var execution=derive();if(GRAPH.execution){execution.can=GRAPH.execution.can;execution.cycle=GRAPH.execution.cycle;execution.critical=GRAPH.execution.critical;execution.state=function(n){return GRAPH.execution.states[n.number]}}
function hay(n){var rel=edges.filter(function(e){return e.from===n.number||e.to===n.number});return [n.number,n.title,n.status,(n.labels||[]).join(' '),JSON.stringify(n.context||{}),JSON.stringify(n.provenance||{}),JSON.stringify(rel)].join(' ').toLowerCase()}
function shown(n){var keys=function(x){return Object.keys(x).filter(function(k){return x[k]})};var q=query.toLowerCase(),s=keys(filters.status),l=keys(filters.labels),t=keys(filters.types);return(!q||hay(n).indexOf(q)>=0)&&(!s.length||s.indexOf(n.status)>=0)&&(!l.length||(n.labels||[]).some(function(x){return l.indexOf(x)>=0}))&&(!t.length||edges.some(function(e){return(e.from===n.number||e.to===n.number)&&t.indexOf(e.type)>=0}))}
function options(){return{status:[].concat.apply([],nodes.map(function(n){return[n.status]})).filter(function(v,i,a){return a.indexOf(v)===i}).sort(),labels:[].concat.apply([],nodes.map(function(n){return n.labels||[]})).filter(function(v,i,a){return a.indexOf(v)===i}).sort(),types:edges.map(function(e){return e.type}).filter(function(v,i,a){return a.indexOf(v)===i}).sort()}}
function chips(kind,label,items){return '<fieldset><legend>'+label+'</legend>'+items.map(function(v){return '<button class="chip '+(filters[kind][v]?'on':'')+'" data-filter="'+kind+'" data-value="'+esc(v)+'">'+esc(v)+'</button>'}).join('')+'</fieldset>'}
function related(id){var set={};edges.forEach(function(e){if(e.from===id)set[e.to]=1;if(e.to===id)set[e.from]=1});return set}
function card(n,rel){var state=execution.state(n),classes='node '+state+(selected===n.number?' selected':'')+(rel[n.number]?' related':''),number=Number(n.number);return '<button class="'+classes+'" data-node="'+number+'"><b>#'+number+'</b><span>'+esc(n.title)+'</span><small>'+esc(state)+' · '+esc((n.labels||[]).join(', ')||'라벨 없음')+'</small></button>'}
function context(list){var rel=selected==null?{}:related(selected);return '<div id="list" class="context-list">'+list.map(function(n){return card(n,rel)}).join('')+'</div>'}
function executionView(list){if(!execution.can)return '<section class="blocked-execution"><h2>실행 순서를 계산할 수 없습니다</h2><p>'+esc(execution.cycle?'CYCLE: '+execution.cycle.join(' → '):((GRAPH.snapshot||{}).reason||'SNAPSHOT_REASON_UNAVAILABLE'))+'</p></section>';var groups=['ready','in-progress','blocked'];return '<div id="execution"><section class="run-summary">'+groups.map(function(g){return '<div><b>'+g+'</b><strong>'+nodes.filter(function(n){return execution.state(n)===g}).length+'</strong></div>'}).join('')+'</section><section class="paths"><h2>최장 실행 경로</h2>'+(execution.critical.length?execution.critical.map(function(path){return '<ol>'+path.map(function(id){return '<li>#'+id+' '+esc(by[id].title)+'</li>'}).join('')+'</ol>'}).join(''):'<p>미완료 이슈가 없습니다.</p>')+'</section><div id="list" class="execution-list">'+list.map(function(n){return card(n,{})}).join('')+'</div></div>'}
function drawer(){var n=by[selected];if(!n)return '';var rel=edges.filter(function(e){return e.from===n.number||e.to===n.number});var context=Object.entries(n.context||{}).map(function(pair){var key=pair[0],value=pair[1];var unknown=value&&typeof value==='object'&&value.value==='unknown';return '<li><b>'+esc(key)+'</b>: '+esc(unknown?'unknown':typeof value==='object'?JSON.stringify(value):value)+(unknown?'<small> 사유: '+esc(value.reason||'없음')+' · 출처: '+esc(value.source||'없음')+'</small>':'')+'</li>'}).join('')||'<li>없음</li>';return '<aside id="drawer"><button id="close" aria-label="닫기">×</button><h2>#'+Number(n.number)+' '+esc(n.title)+'</h2><a href="'+esc(safeUrl(n.url))+'" target="_blank" rel="noopener">GitHub에서 보기</a><h3>실행 분류</h3><p>'+esc(execution.state(n))+'</p><h3>양방향 관계와 rationale</h3><ul>'+rel.map(function(e){var other=e.from===n.number?e.to:e.from;return '<li>#'+Number(other)+' · '+esc(e.type)+'<small>'+esc(e.rationale||'근거 없음')+'</small></li>'}).join('')+'</ul><h3>Context</h3><ul>'+context+'</ul><h3>Node provenance</h3><pre></pre><h3>Edge provenance</h3><pre></pre><h3>Raw JSON</h3><pre></pre></aside>'}
function render(keepFocus){var list=nodes.filter(shown),opts=options(),active=nodes.filter(function(n){return n.status!=='close'}).length,diag=execution.cycle?'CYCLE: '+execution.cycle.join(' → ')+' · 실행 순서 제어가 차단되었습니다.':!execution.can?((GRAPH.snapshot||{}).reason||'SNAPSHOT_REASON_UNAVAILABLE')+' · 실행 순서 제어가 차단되었습니다.':'';var focusAt=keepFocus&&document.activeElement&&document.activeElement.id==='search'?document.activeElement.selectionStart:null;app.innerHTML='<header><div role="group"><button data-mode="context" class="'+(mode==='context'?'active':'')+'">작업 맥락</button><button data-mode="execution" class="'+(mode==='execution'?'active':'')+'">실행 순서</button></div><input id="search" type="search" placeholder="번호, 제목, 라벨, 상태, context, 관계 근거 검색" value="'+esc(query)+'"><strong>활성 '+active+' · 완료 '+(nodes.length-active)+' · 표시 '+list.length+'</strong><div class="filters">'+chips('status','상태',opts.status)+chips('labels','라벨',opts.labels)+chips('types','관계',opts.types)+'</div>'+(diag?'<p role="alert" class="diag">'+esc(diag)+'</p>':'')+'</header><section id="workspace" class="'+(selected==null?'no-drawer':'')+'"><main>'+ (mode==='context'?context(list):executionView(list))+'</main>'+drawer()+'</section>';var n=by[selected],d=document.getElementById('drawer');if(n&&d){var pre=d.querySelectorAll('pre'),rel=edges.filter(function(e){return e.from===n.number||e.to===n.number});pre[0].textContent=JSON.stringify(n.provenance||{},null,2);pre[1].textContent=JSON.stringify(rel.map(function(e){return e.provenance||{}}),null,2);pre[2].textContent=JSON.stringify(n,null,2)}app.querySelectorAll('[data-mode]').forEach(function(b){b.onclick=function(){mode=b.dataset.mode;render(false)}});app.querySelectorAll('[data-filter]').forEach(function(b){b.onclick=function(){var k=b.dataset.filter,v=b.dataset.value;filters[k][v]=!filters[k][v];render(false)}});app.querySelectorAll('[data-node]').forEach(function(b){b.onclick=function(){selected=Number(b.dataset.node);render(false);var target=document.querySelector('[data-node="'+selected+'"]');if(target)target.scrollIntoView({behavior:'smooth',block:'center'})}});var search=document.getElementById('search');search.oninput=function(){query=search.value;render(true)};var close=document.getElementById('close');if(close)close.onclick=function(){selected=null;render(false)};if(focusAt!=null){var next=document.getElementById('search');next.focus();next.setSelectionRange(focusAt,focusAt)}}
document.head.insertAdjacentHTML('beforeend','<style>@media(max-width:760px){fieldset{width:100%;flex-wrap:wrap;min-width:0}}</style>');var app=document.createElement('main');app.id='v2';document.body.appendChild(app);render(false);
})();`;

export function renderHtml(graph) {
  const run = deriveExecution(graph);
  const data = JSON.stringify({ ...graph, execution: { can: run.canExecute, cycle: run.cycle, critical: run.criticalPaths, states: Object.fromEntries(Object.values(graph.nodes).map((node) => [node.number, run.stateOf(node)])) } }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>이슈 탐색 — issue-viz</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef3f8;color:#182433;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#v2{min-height:100dvh;background:linear-gradient(135deg,#eef3f8,#f8fafc 44%,#e9f1f4)}#v2 header{display:grid;grid-template-columns:auto minmax(240px,1fr) auto;gap:12px;padding:18px 24px 14px;background:#172433;border-bottom:3px solid #42b6ad;box-shadow:0 10px 30px #17243329}#v2 input{padding:10px 13px;color:#edf5f7;border:1px solid #526475;border-radius:9px;background:#233448;outline:none}#v2 input:focus{border-color:#65d1c8;box-shadow:0 0 0 3px #65d1c833}#v2 header strong{color:#dcebf0;align-self:center;font-size:13px}button{font:inherit;cursor:pointer}#v2 button{transition:.16s}#v2 button:hover{transform:translateY(-1px)}#v2 button.active,#v2 .chip.on{background:#42b6ad;border-color:#42b6ad;color:#102128;font-weight:800}#v2 header [role=group]{display:flex;padding:3px;gap:3px;background:#0f1b29;border:1px solid #405267;border-radius:10px}#v2 header [role=group] button{color:#c9d8de;background:transparent;border-color:transparent;padding:7px 10px}.filters{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:13px;padding-top:3px}fieldset{display:flex;gap:5px;align-items:center;border:0;padding:0;margin:0}legend{color:#8fa8b1;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:0 4px 0 0}.chip{color:#c9d8de;border:1px solid #526475;border-radius:7px;background:#233448;font-size:11px;padding:4px 8px}.diag{grid-column:1/-1;margin:0;padding:8px 10px;color:#ffd5ce;background:#5a2026;border-radius:7px;font-weight:700}#workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);min-height:calc(100dvh - 154px)}#workspace.no-drawer{grid-template-columns:minmax(0,1fr)}#workspace main{min-width:0}#list{padding:20px 24px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(246px,100%),1fr));gap:11px;align-content:start}.node{min-height:112px;padding:13px 14px;min-width:0;text-align:left;border:1px solid #d9e3eb;border-left:5px solid #7e90a0;border-radius:10px;background:#fffffff2;box-shadow:0 4px 14px #1f304310}.node:hover,.node.related{border-color:#8ec9c4;box-shadow:0 9px 22px #1f30431f}.node.ready{border-left-color:#16a394}.node.blocked{border-left-color:#df9b42}.node.in-progress{border-left-color:#4e92d7}.node.done{opacity:.68}.node.selected{outline:3px solid #42b6ad;outline-offset:2px}.node b{color:#0d716b;font-size:12px}.node span,.node small{display:block;word-break:keep-all;overflow-wrap:break-word}.node span{margin-top:6px;font-weight:740;line-height:1.35}.node small{color:#627687;margin-top:8px;font-size:11px}#drawer{padding:25px 22px;border-left:1px solid #d9e3eb;background:#fbfdfe;overflow:auto;word-break:keep-all;overflow-wrap:break-word;box-shadow:-12px 0 30px #1f30430a}#drawer h2{margin:0 28px 8px 0;font-size:19px;line-height:1.35}#drawer h3{margin:22px 0 7px;color:#597080;font-size:11px;letter-spacing:.07em;text-transform:uppercase}#drawer a{color:#087d77;font-weight:700}#drawer li small{display:block;color:#627687;margin:4px 0 8px}#drawer pre{white-space:pre-wrap;font-size:11px;background:#edf3f6;border:1px solid #dce6ec;border-radius:8px;padding:10px}#close{float:right;color:#5c7180;border:0;background:transparent;font-size:24px}.run-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;padding:20px 24px 0}.run-summary div,.paths{padding:14px;border:1px solid #d9e3eb;border-radius:10px;background:#fffffff2}.run-summary b{display:block;color:#627687;font-size:12px}.run-summary strong{font-size:28px}.paths{margin:12px 24px}.paths h2{margin:0 0 8px;font-size:15px}.paths ol{margin:8px 0;padding-left:24px}.blocked-execution{margin:24px;padding:20px;border:1px solid #e6b2aa;border-radius:10px;background:#fff6f4}.blocked-execution h2{margin-top:0}@media(max-width:760px){#v2 header{grid-template-columns:1fr;padding:14px}.filters{gap:8px}#workspace,#workspace.no-drawer{grid-template-columns:1fr}#list{padding:14px;grid-template-columns:1fr}#drawer{border-left:0;border-top:1px solid #d9e1ec;max-height:48dvh}.run-summary{padding:14px;gap:8px}.paths{margin:0 14px 14px}}
</style></head><body><script>var GRAPH=${data};</script><script>${CLIENT_JS}</script></body></html>`;
}
export function outputPath(root, value) {
  const target = path.resolve(root, value);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('출력 경로는 저장소 안이어야 한다.');
  return target;
}
function browserBinary() {
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'Google Chrome']
    : ['google-chrome', 'chromium', 'chromium-browser'];
  return candidates.find((candidate) => candidate.includes('/') ? existsSync(candidate) : spawnSync('which', [candidate], { stdio: 'ignore' }).status === 0) ?? null;
}

function captureWebp(html, image) {
  const browser = browserBinary();
  if (!browser) return { ok: false, reason: 'browser-unavailable' };
  const png = `${image}.png`;
  mkdirSync(path.dirname(image), { recursive: true });
  const screenshot = spawnSync(browser, ['--headless=new', '--disable-gpu', '--window-size=1440,900', '--virtual-time-budget=1200', `--screenshot=${png}`, `file://${html}`], { encoding: 'utf8' });
  if (screenshot.status !== 0 || !existsSync(png)) return { ok: false, reason: 'screenshot-failed' };
  const converted = spawnSync('cwebp', ['-q', '82', png, '-o', image], { encoding: 'utf8' });
  rmSync(png, { force: true });
  if (converted.status !== 0 || !existsSync(image)) return { ok: false, reason: 'webp-conversion-failed' };
  return { ok: true };
}

function cmdRender(root, opts) {
  const graph = loadGraph(root);
  const out = outputPath(root, opts.out ?? DEFAULT_OUT);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderHtml(graph), 'utf8');
  console.log(`✓ 렌더 완료 — 노드 ${Object.keys(graph.nodes).length}개, 엣지 ${graph.edges.length}개\nOUT=${out}`);
  if (opts.imageOut) {
    const image = outputPath(root, opts.imageOut);
    const result = captureWebp(out, image);
    console.log(`IMAGE_STATUS=${result.ok ? 'ok' : 'unavailable'}`);
    console.log(`IMAGE_OUT=${result.ok ? image : ''}`);
    if (!result.ok) console.log(`IMAGE_REASON=${result.reason}`);
  }
  if (opts.open) spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [out], { stdio: 'ignore' });
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) { console.log('Usage: node issue-viz.mjs render [--out <path>] [--image-out <path.webp>] [--open]'); return; }
  const opts = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === 'render') continue;
    if (args[i] === '--out') opts.out = args[++i];
    else if (args[i] === '--image-out') opts.imageOut = args[++i];
    else if (args[i] === '--open') opts.open = true;
    else throw new Error(`알 수 없는 옵션: ${args[i]}`);
  }
  cmdRender(repoRoot(), opts);
}
function isMain(metaUrl) { const entry = process.argv[1]; if (!entry) return false; const here = fileURLToPath(metaUrl); try { return realpathSync(here) === realpathSync(path.resolve(entry)); } catch { return false; } }
if (isMain(import.meta.url)) { try { main(); } catch (error) { console.error(`✗ ${error.message}`); process.exit(1); } }
