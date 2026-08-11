#!/usr/bin/env node
/**
 * issue-todo.mjs — 이슈를 DAG(방향성 비순환 그래프)로 관리하는 보조 스크립트.
 *
 * 기존 파이프라인(issue-create → issue-start → issue-end → issue-merge)은 이슈를
 * 독립 단위로만 다루고 이슈 사이의 의존/순서를 저장하지 않는다. 이 스크립트는
 * `.issue/graph.json` 에 노드(이슈) + 타입 엣지(의존)를 두고, ready-frontier 와
 * 우선순위를 반영한 todo 를 산출한다. 시각화는 issue-viz 가 맡는다.
 *
 * 서브커맨드:
 *   sync                트래커에서 열린·닫힌 이슈를 노드로 갱신하고, 본문의
 *                       "depends on #N" 류 참조를 엣지로 자동 감지한다.
 *   link <from> <to>    from --<type>--> to 엣지를 근거와 함께 추가한다.
 *   unlink <from> <to>  일치하는 엣지를 제거한다.
 *   plan (todo)         위상정렬 + ready/blocked/in-progress/done 분류로 todo 를 낸다.
 *   next                의존·우선순위를 반영해 다음 착수 이슈 1건을 추천한다.
 *   validate            사이클·dangling 엣지·close 불일치를 점검한다.
 *
 * 엣지 방향 규약: `from --depends-on--> to` = "from 은 to 가 close 전엔 착수 불가".
 * blocks 는 depends-on 의 역방향으로 취급한다(A blocks B == B depends-on A).
 * relates-on/parent-of/duplicate-of 는 순서 제약이 아니라 정보성 엣지다.
 *
 * 이슈 백엔드는 ~/.issue/settings.json 의 provider 설정이 정한다(github 기본 | jira).
 * 트래커 호출은 전부 issue-tracker.mjs 를 거친다.
 *
 * 요구사항: git, Node 18+, (github 면 gh 로그인 / jira 면 baseUrl·projectKey·토큰)
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { repoRoot, WORKSPACE_DIR, GRAPH_FILE_NAME, isStatusLabel, typeLabels, parseIssueNumber } from './issue-common.mjs';
import { createTracker } from './issue-tracker.mjs';

export const GRAPH_VERSION = 1;
export const GRAPH_FILE = GRAPH_FILE_NAME;

/** 저장 가능한 엣지 타입. 앞 둘만 순서 제약이다. */
export const EDGE_TYPES = ['depends-on', 'blocks', 'relates-to', 'parent-of', 'duplicate-of'];
export const ORDERING_TYPES = new Set(['depends-on', 'blocks']);

/** 진행 상태를 세 부류로. done 만 "끝난 것"으로 본다. */
const DONE = 'close';
const IN_PROGRESS = new Set(['plan', 'in-process', 'review']);

/* --------------------------------------------------------------- graph I/O */

export function graphPath(root) {
  return path.join(root, WORKSPACE_DIR, GRAPH_FILE);
}

export function emptyGraph(provider = 'github') {
  return { version: GRAPH_VERSION, provider, updatedAt: null, nodes: {}, edges: [] };
}

export function loadGraph(root, provider = 'github') {
  const file = graphPath(root);
  if (!existsSync(file)) return emptyGraph(provider);
  try {
    const g = JSON.parse(readFileSync(file, 'utf8'));
    return { ...emptyGraph(provider), ...g, nodes: g.nodes ?? {}, edges: g.edges ?? [] };
  } catch (e) {
    console.error(`✗ ${WORKSPACE_DIR}/${GRAPH_FILE} 파싱 실패: ${e.message}`);
    process.exit(1);
  }
}

/** 결정적 순서로 저장한다 — diff 가 안정되도록 노드는 번호순, 엣지는 (from,to,type) 순. */
export function saveGraph(root, graph, { now } = {}) {
  const nodes = {};
  for (const k of Object.keys(graph.nodes).sort((a, b) => Number(a) - Number(b))) nodes[k] = graph.nodes[k];
  const edges = [...graph.edges].sort((a, b) =>
    a.from - b.from || a.to - b.to || String(a.type).localeCompare(String(b.type)));
  const out = { version: GRAPH_VERSION, provider: graph.provider, updatedAt: now ?? graph.updatedAt, nodes, edges };
  const file = graphPath(root);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  return file;
}

/* --------------------------------------------------------------- 상태 파생 */

/** 라벨과 트래커 state 로 노드 상태를 정한다. status:* 라벨 우선, 없으면 state 로 폴백. */
export function deriveStatus(labels = [], state) {
  const status = labels.map((l) => (typeof l === 'string' ? l : l.name)).find(isStatusLabel);
  if (status) return status.slice('status:'.length);
  return String(state ?? '').toUpperCase() === 'CLOSED' ? 'close' : 'open';
}

/** 노드에서 우선순위 랭크를 뽑는다. P0=0 … 라벨 없으면 뒤로. */
export function priorityRank(node) {
  if (typeof node.priority === 'number') return node.priority;
  for (const name of node.labels ?? []) {
    const m = /^p([0-3])$/i.exec(name);
    if (m) return Number(m[1]);
  }
  return 9;
}

/* --------------------------------------------------------- 의존 그래프 계산 */

/**
 * 순서 제약 엣지를 "prereq(선행) 맵" 으로 정규화한다.
 * depends-on {from,to} → from 의 선행에 to.
 * blocks     {from,to} → to 의 선행에 from.
 * 반환: Map<number, Set<number>> — 노드 → 선행 노드 집합.
 */
export function prereqMap(graph) {
  const map = new Map();
  const add = (node, dep) => {
    if (!map.has(node)) map.set(node, new Set());
    map.get(node).add(dep);
  };
  for (const num of Object.keys(graph.nodes)) map.set(Number(num), map.get(Number(num)) ?? new Set());
  for (const e of graph.edges) {
    if (e.type === 'depends-on') add(e.from, e.to);
    else if (e.type === 'blocks') add(e.to, e.from);
  }
  return map;
}

/** 순서 엣지에서 사이클을 찾는다. 있으면 노드 배열(사이클 경로), 없으면 null. */
export function findCycle(graph) {
  const prereq = prereqMap(graph);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const stack = [];
  let cycle = null;
  const visit = (n) => {
    if (cycle) return;
    color.set(n, GRAY);
    stack.push(n);
    for (const dep of prereq.get(n) ?? []) {
      if (!prereq.has(dep)) continue; // 알 수 없는 노드는 dangling — validate 가 따로 잡는다
      const c = color.get(dep) ?? WHITE;
      if (c === GRAY) { cycle = [...stack.slice(stack.indexOf(dep)), dep]; return; }
      if (c === WHITE) visit(dep);
      if (cycle) return;
    }
    stack.pop();
    color.set(n, BLACK);
  };
  for (const n of prereq.keys()) if ((color.get(n) ?? WHITE) === WHITE) visit(n);
  return cycle;
}

/**
 * 각 노드를 ready / blocked / in-progress / done 으로 분류한다.
 * blocked: 선행 중 close 가 아닌 것이 있음.
 * in-progress: plan/in-process/review.
 * ready: open + 선행이 전부 close.
 */
export function classify(graph) {
  const prereq = prereqMap(graph);
  const statusOf = (num) => graph.nodes[String(num)]?.status ?? 'open';
  const out = { ready: [], blocked: [], inProgress: [], done: [] };
  for (const num of Object.keys(graph.nodes).map(Number)) {
    const st = statusOf(num);
    if (st === DONE) { out.done.push(num); continue; }
    const blockers = [...(prereq.get(num) ?? [])].filter((d) => statusOf(d) !== DONE);
    if (blockers.length) { out.blocked.push({ num, blockers }); continue; }
    if (IN_PROGRESS.has(st)) { out.inProgress.push(num); continue; }
    out.ready.push(num);
  }
  const byPrio = (a, b) => priorityRank(graph.nodes[String(a)]) - priorityRank(graph.nodes[String(b)]) || a - b;
  out.ready.sort(byPrio);
  out.inProgress.sort(byPrio);
  out.blocked.sort((a, b) => byPrio(a.num, b.num));
  out.done.sort((a, b) => a - b);
  return out;
}

/* --------------------------------------------------------------- sync 파싱 */

/** 본문에서 의존 참조를 뽑는다. 반환: [{ type, to }]. */
export function parseDependencies(body = '') {
  const refs = [];
  const text = String(body);
  const grab = (re, type) => {
    let m;
    while ((m = re.exec(text)) !== null) refs.push({ type, to: Number(m[1]) });
  };
  // "depends on #N", "depends-on #N", "blocked by #N", "needs #N" → depends-on
  grab(/\bdepends[\s-]?on\s+#(\d{1,6})/gi, 'depends-on');
  grab(/\bblocked[\s-]?by\s+#(\d{1,6})/gi, 'depends-on');
  grab(/\bneeds\s+#(\d{1,6})/gi, 'depends-on');
  // "blocks #N" → blocks
  grab(/\bblocks\s+#(\d{1,6})/gi, 'blocks');
  return refs;
}

/* ------------------------------------------------------------------- 명령 */

function cmdSync(root, tracker, opts) {
  const list = tracker.issueList({
    state: opts.state ?? 'all',
    limit: Number(opts.limit ?? 200),
    fields: 'number,title,labels,url,state,body',
  });
  if (list === null) {
    console.log('SYNCED=0');
    console.log('SYNC_FAILED=1');
    return;
  }
  const graph = loadGraph(root, tracker.provider);
  graph.provider = tracker.provider;

  // 노드 갱신 (제목·상태·라벨·url 은 트래커가 정본).
  for (const it of list) {
    const labels = (it.labels ?? []).map((l) => l.name);
    graph.nodes[String(it.number)] = {
      number: it.number,
      title: it.title,
      status: deriveStatus(it.labels ?? [], it.state),
      labels: typeLabels(labels),
      url: it.url,
      ...(graph.nodes[String(it.number)]?.priority !== undefined
        ? { priority: graph.nodes[String(it.number)].priority } : {}),
    };
  }

  // sync 가 만든 엣지는 매번 다시 계산한다. 손으로 건 엣지(createdBy=link)는 보존한다.
  const manual = graph.edges.filter((e) => e.createdBy !== 'sync');
  const auto = [];
  const seen = new Set(manual.map((e) => `${e.from}|${e.to}|${e.type}`));
  const now = opts.now ?? new Date().toISOString();
  for (const it of list) {
    for (const { type, to } of parseDependencies(it.body ?? '')) {
      if (to === it.number) continue;
      const key = `${it.number}|${to}|${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      auto.push({ from: it.number, to, type, rationale: '본문 참조에서 자동 감지', createdBy: 'sync', createdAt: now });
    }
  }
  graph.edges = [...manual, ...auto];

  const file = saveGraph(root, graph, { now });
  const cycle = findCycle(graph);

  console.log(`✓ sync 완료 — 노드 ${Object.keys(graph.nodes).length}개, 엣지 ${graph.edges.length}개 (자동 ${auto.length}, 수동 ${manual.length})`);
  console.log(`  저장: ${path.relative(root, file)}`);
  if (cycle) console.log(`  ! 경고: 순환 의존 감지 ${cycle.join(' → ')} (validate 로 확인)`);
  console.log('');
  console.log(`SYNCED=${Object.keys(graph.nodes).length}`);
  console.log(`EDGES=${graph.edges.length}`);
  console.log(`AUTO_EDGES=${auto.length}`);
  console.log(`CYCLE=${cycle ? cycle.join('>') : ''}`);
}

function cmdLink(root, tracker, from, to, opts) {
  if (from == null || to == null) { console.error('✗ from 과 to 이슈 번호가 필요하다 (예: link 61 60)'); process.exit(1); }
  const type = opts.type ?? 'depends-on';
  if (!EDGE_TYPES.includes(type)) {
    console.error(`✗ 알 수 없는 엣지 타입: ${type} — ${EDGE_TYPES.join(' | ')} 중 하나`);
    process.exit(1);
  }
  if (from === to) { console.error('✗ 자기 자신을 가리키는 엣지는 만들 수 없다.'); process.exit(1); }

  const graph = loadGraph(root, tracker.provider);
  const key = (e) => `${e.from}|${e.to}|${e.type}`;
  const cand = { from, to, type };
  if (graph.edges.some((e) => key(e) === key(cand))) {
    console.log(`· 이미 있는 엣지: ${from} --${type}--> ${to}`);
    console.log('LINKED=0');
    return;
  }
  const now = opts.now ?? new Date().toISOString();
  graph.edges.push({ from, to, type, rationale: opts.why ?? '', createdBy: 'link', createdAt: now });

  // 순서 제약 엣지면 사이클을 유발하지 않는지 확인한다. 유발하면 되돌린다.
  if (ORDERING_TYPES.has(type)) {
    const cycle = findCycle(graph);
    if (cycle) {
      console.error(`✗ 이 엣지는 순환을 만든다: ${cycle.join(' → ')} — 추가하지 않았다.`);
      process.exit(2);
    }
  }
  saveGraph(root, graph, { now });
  console.log(`✓ 엣지 추가 — ${from} --${type}--> ${to}${opts.why ? `  (${opts.why})` : ''}`);
  console.log('');
  console.log('LINKED=1');
}

function cmdUnlink(root, tracker, from, to, opts) {
  if (from == null || to == null) { console.error('✗ from 과 to 이슈 번호가 필요하다.'); process.exit(1); }
  const graph = loadGraph(root, tracker.provider);
  const before = graph.edges.length;
  graph.edges = graph.edges.filter((e) =>
    !(e.from === from && e.to === to && (!opts.type || e.type === opts.type)));
  const removed = before - graph.edges.length;
  if (removed) saveGraph(root, graph, { now: opts.now ?? new Date().toISOString() });
  console.log(removed ? `✓ 엣지 ${removed}개 제거 — ${from} → ${to}` : `· 제거할 엣지 없음 — ${from} → ${to}`);
  console.log('');
  console.log(`UNLINKED=${removed}`);
}

function label(graph, num) {
  const n = graph.nodes[String(num)];
  return n ? `#${num} ${n.title}` : `#${num} (그래프에 없음)`;
}

function cmdPlan(root, tracker, opts) {
  const graph = loadGraph(root, tracker.provider);
  if (!Object.keys(graph.nodes).length) {
    console.log('그래프가 비어 있다. 먼저 `sync` 를 실행하라.');
    console.log('READY_NUMBERS=');
    return;
  }
  const c = classify(graph);
  const prio = (num) => { const r = priorityRank(graph.nodes[String(num)]); return r < 9 ? ` [P${r}]` : ''; };

  if (opts.json) {
    console.log(JSON.stringify({
      ready: c.ready, blocked: c.blocked, inProgress: c.inProgress, done: c.done,
    }, null, 2));
    return;
  }

  console.log('# 이슈 DAG todo\n');
  console.log(`## ▶ 착수 가능 (ready) — ${c.ready.length}개`);
  if (c.ready.length) for (const n of c.ready) console.log(`  - ${label(graph, n)}${prio(n)}`);
  else console.log('  (없음)');
  console.log('');
  console.log(`## ⏳ 진행 중 (in-progress) — ${c.inProgress.length}개`);
  if (c.inProgress.length) for (const n of c.inProgress) console.log(`  - ${label(graph, n)} (${graph.nodes[String(n)].status})`);
  else console.log('  (없음)');
  console.log('');
  console.log(`## ⛔ 막힘 (blocked) — ${c.blocked.length}개`);
  if (c.blocked.length) for (const b of c.blocked) console.log(`  - ${label(graph, b.num)}  ← 대기: ${b.blockers.map((x) => `#${x}`).join(', ')}`);
  else console.log('  (없음)');
  console.log('');
  console.log(`## ✔ 완료 (done) — ${c.done.length}개`);
  if (c.done.length) console.log(`  ${c.done.map((x) => `#${x}`).join(', ')}`);
  else console.log('  (없음)');
  console.log('');
  console.log(`READY_NUMBERS=${c.ready.join(' ')}`);
  console.log(`BLOCKED_NUMBERS=${c.blocked.map((b) => b.num).join(' ')}`);
  console.log(`IN_PROGRESS_NUMBERS=${c.inProgress.join(' ')}`);
  console.log(`DONE_NUMBERS=${c.done.join(' ')}`);
}

function cmdNext(root, tracker) {
  const graph = loadGraph(root, tracker.provider);
  const c = classify(graph);
  if (!c.ready.length) {
    console.log(c.inProgress.length
      ? `착수 가능한 이슈가 없다. 진행 중: ${c.inProgress.map((n) => `#${n}`).join(', ')}`
      : '착수 가능한 이슈가 없다. `sync` 로 그래프를 갱신하거나 막힌 이슈의 선행을 끝내라.');
    console.log('NEXT_ISSUE=');
    return;
  }
  const n = c.ready[0];
  console.log(`다음 착수 추천: ${label(graph, n)}`);
  console.log('');
  console.log(`NEXT_ISSUE=${n}`);
  console.log(`NEXT=$issue-start #${n}`);
}

function cmdValidate(root, tracker) {
  const graph = loadGraph(root, tracker.provider);
  const problems = [];

  const cycle = findCycle(graph);
  if (cycle) problems.push(`순환 의존: ${cycle.join(' → ')}`);

  for (const e of graph.edges) {
    if (!graph.nodes[String(e.from)]) problems.push(`dangling 엣지: from #${e.from} 노드 없음 (${e.from}→${e.to})`);
    if (!graph.nodes[String(e.to)]) problems.push(`dangling 엣지: to #${e.to} 노드 없음 (${e.from}→${e.to})`);
    if (!EDGE_TYPES.includes(e.type)) problems.push(`알 수 없는 엣지 타입: ${e.type} (${e.from}→${e.to})`);
  }

  // close 불일치: done 인 노드가 아직 done 이 아닌 선행에 의존.
  const prereq = prereqMap(graph);
  for (const num of Object.keys(graph.nodes).map(Number)) {
    if (graph.nodes[String(num)].status !== DONE) continue;
    for (const dep of prereq.get(num) ?? []) {
      const d = graph.nodes[String(dep)];
      if (d && d.status !== DONE) problems.push(`close 불일치: #${num} 는 done 인데 선행 #${dep} 가 미완`);
    }
  }

  if (!problems.length) {
    console.log('✓ 문제 없음 — DAG 정상, dangling·불일치 없음');
    console.log('');
    console.log('VALID=1');
    console.log('PROBLEMS=0');
    return;
  }
  console.log('✗ 문제 발견:');
  for (const p of problems) console.log(`  - ${p}`);
  console.log('');
  console.log('VALID=0');
  console.log(`PROBLEMS=${problems.length}`);
  process.exit(cycle ? 2 : 1);
}

/* ------------------------------------------------------------------- usage */

function usage(exitCode = 1) {
  console.error(`Usage:
  node issue-todo.mjs sync [--state open|closed|all] [--limit <n>]
  node issue-todo.mjs link <from> <to> [--type ${EDGE_TYPES.join('|')}] [--why "<근거>"]
  node issue-todo.mjs unlink <from> <to> [--type <type>]
  node issue-todo.mjs plan [--json]        (별칭: todo)
  node issue-todo.mjs next
  node issue-todo.mjs validate

엣지 방향: from --depends-on--> to = "from 은 to 가 close 전엔 착수 불가".
그래프: ${WORKSPACE_DIR}/${GRAPH_FILE} (base 브랜치에 커밋 — .gitignore 예외).
이슈 백엔드는 ~/.issue/settings.json 의 provider.type 이 정한다 (github 기본 | jira).
`);
  process.exit(exitCode);
}

/* ------------------------------------------------------------------- main */

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('-h') || argv.includes('--help')) usage(argv.length ? 0 : 1);

  let mode = argv[0];
  if (mode === 'todo') mode = 'plan';
  const MODES = ['sync', 'link', 'unlink', 'plan', 'next', 'validate'];
  if (!MODES.includes(mode)) { console.error(`✗ 알 수 없는 모드: ${argv[0]}`); usage(); }

  const opts = {};
  const positionals = [];
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '--type') opts.type = argv[++i];
    else if (arg === '--why') opts.why = argv[++i];
    else if (arg === '--state') opts.state = argv[++i];
    else if (arg === '--limit') opts.limit = argv[++i];
    else if (arg === '--repo') opts.repo = argv[++i];
    else if (arg.startsWith('-')) { console.error(`✗ 알 수 없는 옵션: ${arg}`); usage(); }
    else positionals.push(arg);
  }

  const root = repoRoot();
  const tracker = createTracker(root, { repo: opts.repo });

  if (mode === 'sync') cmdSync(root, tracker, opts);
  else if (mode === 'link') cmdLink(root, tracker, parseIssueNumber(positionals[0]), parseIssueNumber(positionals[1]), opts);
  else if (mode === 'unlink') cmdUnlink(root, tracker, parseIssueNumber(positionals[0]), parseIssueNumber(positionals[1]), opts);
  else if (mode === 'plan') cmdPlan(root, tracker, opts);
  else if (mode === 'next') cmdNext(root, tracker);
  else if (mode === 'validate') cmdValidate(root, tracker);
}

/** 심볼릭 링크로 설치돼도 진입점 판별이 어긋나지 않게 realpath 로 비교한다. */
function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const here = fileURLToPath(metaUrl);
  const resolved = path.resolve(entry);
  if (here === resolved) return true;
  try { return realpathSync(here) === realpathSync(resolved); } catch { return false; }
}

if (isMainModule(import.meta.url)) main();
