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
import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, renameSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { repoRoot, WORKSPACE_DIR, GRAPH_FILE_NAME, isStatusLabel, typeLabels, parseIssueNumber } from './issue-common.mjs';
import { createTracker } from './issue-tracker.mjs';
import {
  GRAPH_VERSION as V2_GRAPH_VERSION, EDGE_TYPES as V2_EDGE_TYPES, ORDERING_TYPES as V2_ORDERING_TYPES,
  CONTEXT_FIELDS, digest, normalizeEdge, edgeKey, parseDecisionComments, decisionEdge, resolveDecisions,
  auditGraph, migrateGraphV1,
} from './issue-graph-v2.mjs';

export const GRAPH_VERSION = V2_GRAPH_VERSION;
export const GRAPH_FILE = GRAPH_FILE_NAME;

/** V2의 관계는 다섯 가지이며 순서 제약은 depends-on뿐이다. */
export const EDGE_TYPES = V2_EDGE_TYPES;
export const ORDERING_TYPES = V2_ORDERING_TYPES;

/** 진행 상태를 세 부류로. done 만 "끝난 것"으로 본다. */
const DONE = 'close';
const IN_PROGRESS = new Set(['plan', 'in-process', 'review']);

function unknownField(reason, source) {
  return { value: 'unknown', reason, source };
}

/* --------------------------------------------------------------- graph I/O */

export function graphPath(root) {
  return path.join(root, WORKSPACE_DIR, GRAPH_FILE);
}

export function emptyGraph(provider = 'github') {
  return { version: GRAPH_VERSION, provider, repository: null, updatedAt: null, snapshot: { status: 'missing' }, nodes: {}, edges: [] };
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
  const edges = [...graph.edges].map(normalizeEdge).sort((a, b) =>
    a.from - b.from || a.to - b.to || String(a.type).localeCompare(String(b.type)));
  const out = { ...graph, version: GRAPH_VERSION, updatedAt: now ?? graph.updatedAt, nodes, edges };
  const file = graphPath(root);
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  renameSync(temporary, file);
  return file;
}

/* --------------------------------------------------------------- 상태 파생 */

/** 라벨과 트래커 state 로 노드 상태를 정한다. status:* 라벨 우선, 없으면 state 로 폴백. */
export function deriveStatus(labels = [], state) {
  const status = labels.map((l) => (typeof l === 'string' ? l : l.name)).find(isStatusLabel);
  if (status) return status.slice('status:'.length);
  return ['CLOSED', 'MERGED'].includes(String(state ?? '').toUpperCase()) ? 'close' : 'open';
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
  // "A blocks B" 는 V2에서 B --depends-on--> A로 정규화한다.
  let m;
  const blocks = /\bblocks\s+#(\d{1,6})/gi;
  while ((m = blocks.exec(text)) !== null) refs.push({ type: 'depends-on', from: Number(m[1]), reverse: true });
  return refs;
}

/* ------------------------------------------------------------------- 명령 */

function cmdSync(root, tracker, opts) {
  const state = opts.state ?? 'all';
  const limit = Number(opts.limit ?? 200);
  const list = tracker.issueList({
    state,
    limit,
    fields: 'number,title,labels,url,state,body,comments,updatedAt',
  });
  if (list === null) {
    console.log('SYNCED=0');
    console.log('SYNC_FAILED=1');
    return;
  }
  const graph = loadGraph(root, tracker.provider);
  graph.version = GRAPH_VERSION;
  graph.provider = tracker.provider;
  graph.repository = opts.repo ?? graph.repository ?? null;
  graph.nodes = {};

  const now = opts.now ?? new Date().toISOString();
  // 노드 갱신 (제목·상태·라벨·url 은 트래커가 정본).
  for (const it of list) {
    const labels = (it.labels ?? []).map((l) => l.name);
    const source = { url: it.url, revision: it.updatedAt ?? 'unknown', observedAt: now };
    graph.nodes[String(it.number)] = {
      id: `github:${graph.repository ?? 'unknown'}#${it.number}`,
      number: it.number,
      title: it.title,
      status: deriveStatus(it.labels ?? [], it.state),
      labels: typeLabels(labels),
      url: it.url,
      context: Object.fromEntries(CONTEXT_FIELDS.map((field) => [field, unknownField(`GitHub 본문에 구조화된 ${field} 필드가 없음`, source)])),
      provenance: source,
    };
  }

  // V2 캐시는 GitHub에서 다시 만들 수 있는 auto/decision 엣지만 보관한다.
  const auto = [];
  const decisions = [];
  const seen = new Set();
  for (const it of list) {
    for (const ref of parseDependencies(it.body ?? '')) {
      const from = ref.reverse ? ref.from : it.number;
      const to = ref.reverse ? it.number : ref.to;
      if (to === from) continue;
      const key = `${from}|${to}|${ref.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      auto.push({ from, to, type: ref.type, rationale: '본문 참조에서 자동 감지', createdBy: 'sync', createdAt: now, provenance: { url: it.url, digest: digest(it.body ?? '') } });
    }
    decisions.push(...parseDecisionComments(it.comments ?? []));
  }
  // issue list는 pull request를 제외한다. 본문이 #번호로 참조한 GitHub PR/issue는 개별 조회해
  // close 상태와 provenance를 보존한다. 조회 실패한 끝점은 complete snapshot으로 승격하지 않는다.
  const referenced = [...new Set(auto.flatMap((edge) => [edge.from, edge.to]))]
    .filter((number) => !graph.nodes[String(number)]);
  const unresolved = [];
  for (const number of referenced) {
    const item = tracker.issueView(number);
    if (!item) { unresolved.push(number); continue; }
    const labels = (item.labels ?? []).map((label) => label.name);
    const source = { url: item.url, revision: item.updatedAt ?? 'unknown', observedAt: now, kind: 'referenced' };
    graph.nodes[String(number)] = {
      id: `github:${graph.repository ?? 'unknown'}#${number}`,
      number,
      title: item.title,
      status: deriveStatus(item.labels ?? [], item.state),
      labels: typeLabels(labels),
      url: item.url,
      context: Object.fromEntries(CONTEXT_FIELDS.map((field) => [field, unknownField(`참조된 GitHub 항목의 구조화된 ${field} 필드가 없음`, source)])),
      provenance: source,
    };
  }
  const approved = resolveDecisions(decisions).map(decisionEdge).filter(Boolean).filter((edge) => {
    const key = edgeKey(edge); if (seen.has(key)) return false; seen.add(key); return true;
  });
  graph.edges = [...auto, ...approved];
  const complete = state === 'all' && list.length < limit && unresolved.length === 0;
  graph.snapshot = {
    status: complete ? 'complete' : 'partial',
    fetchedAt: now,
    digest: digest(list.map((it) => ({ number: it.number, updatedAt: it.updatedAt ?? null, body: it.body ?? '', comments: it.comments ?? [] }))),
    reason: complete ? null : unresolved.length
      ? `참조 GitHub 항목을 조회할 수 없음: ${unresolved.map((number) => `#${number}`).join(', ')}`
      : 'state filter 또는 limit로 전체 GitHub 이슈 목록을 증명할 수 없음',
  };

  const file = saveGraph(root, graph, { now });
  const cycle = findCycle(graph);

  console.log(`✓ sync 완료 — 노드 ${Object.keys(graph.nodes).length}개, 엣지 ${graph.edges.length}개 (자동 ${auto.length}, 승인 ${approved.length})`);
  console.log(`  저장: ${path.relative(root, file)}`);
  if (cycle) console.log(`  ! 경고: 순환 의존 감지 ${cycle.join(' → ')} (validate 로 확인)`);
  console.log('');
  console.log(`SYNCED=${Object.keys(graph.nodes).length}`);
  console.log(`EDGES=${graph.edges.length}`);
  console.log(`AUTO_EDGES=${auto.length}`);
  console.log(`DECISION_EDGES=${approved.length}`);
  console.log(`RESOLVED_REFERENCES=${referenced.length - unresolved.length}`);
  console.log(`UNRESOLVED_REFERENCES=${unresolved.join(' ')}`);
  console.log(`SNAPSHOT_STATUS=${graph.snapshot.status}`);
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

  console.error('✗ V2는 로컬 link를 저장하지 않는다. 대상 GitHub 이슈에 구조화된 승인 코멘트를 남긴 뒤 sync 하라.');
  console.error(`  type=${type} from=${from} to=${to} rationale=${opts.why ?? ''}`);
  console.error('LINKED=0');
  process.exit(2);
}

function cmdUnlink(root, tracker, from, to, opts) {
  if (from == null || to == null) { console.error('✗ from 과 to 이슈 번호가 필요하다.'); process.exit(1); }
  console.error('✗ V2는 로컬 unlink를 저장하지 않는다. GitHub의 승인 결정 코멘트를 정정·철회한 뒤 sync 하라.');
  console.error(`UNLINKED=0 from=${from} to=${to} type=${opts.type ?? 'all'}`);
  process.exit(2);
}

function label(graph, num) {
  const n = graph.nodes[String(num)];
  return n ? `#${num} ${n.title}` : `#${num} (그래프에 없음)`;
}

function cmdPlan(root, tracker, opts) {
  const graph = loadGraph(root, tracker.provider);
  const problems = auditGraph(graph);
  const cycle = findCycle(graph);
  if (cycle) problems.push(`순환 의존: ${cycle.join(' → ')}`);
  if (problems.length) {
    console.error(`✗ 안전하지 않은 그래프라 plan을 만들지 않는다: ${problems.join(' / ')}`);
    console.log('READY_NUMBERS=');
    process.exit(2);
  }
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
  const problems = auditGraph(graph);
  const cycle = findCycle(graph);
  if (cycle) problems.push(`순환 의존: ${cycle.join(' → ')}`);
  if (problems.length) {
    console.error(`✗ 안전하지 않은 그래프라 next를 추천하지 않는다: ${problems.join(' / ')}`);
    console.log('NEXT_ISSUE=');
    process.exit(2);
  }
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
  const problems = auditGraph(graph);

  const cycle = findCycle(graph);
  if (cycle) problems.push(`순환 의존: ${cycle.join(' → ')}`);

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
    console.log('✓ 문제 없음 — V2 snapshot·관계·DAG 정상');
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

function cmdMigrate(root, tracker, opts) {
  const graph = loadGraph(root, tracker.provider);
  if (graph.version === GRAPH_VERSION) {
    console.log('MIGRATED=0');
    console.log('MIGRATION_STATUS=already-v2');
    return;
  }
  if (graph.version !== 1) {
    console.error(`✗ 지원하지 않는 마이그레이션 원본: V${graph.version}`);
    console.log('MIGRATED=0');
    process.exit(2);
  }
  const migrated = migrateGraphV1(graph, { now: opts.now });
  const file = saveGraph(root, migrated, { now: migrated.updatedAt });
  console.log(`✓ V1 → V2 마이그레이션 완료: ${path.relative(root, file)}`);
  console.log('  이 캐시는 migrating 상태다. GitHub sync 전에는 plan/next를 실행하지 않는다.');
  console.log('MIGRATED=1');
  console.log('MIGRATION_STATUS=migrating');
}

function cmdAudit(root, tracker) {
  const graph = loadGraph(root, tracker.provider);
  const problems = auditGraph(graph);
  if (problems.length) {
    console.log('AUDIT=0');
    console.log(`PROBLEMS=${problems.length}`);
    for (const problem of problems) console.log(`  - ${problem}`);
    process.exit(2);
  }
  console.log('AUDIT=1');
  console.log('PROBLEMS=0');
}

/* ------------------------------------------------------------------- usage */

function usage(exitCode = 1) {
  console.error(`Usage:
  node issue-todo.mjs sync [--state open|closed|all] [--limit <n>]  (plan/next에는 전체·완전 snapshot 필요)
  node issue-todo.mjs link <from> <to> [--type ${EDGE_TYPES.join('|')}] [--why "<근거>"]
  node issue-todo.mjs unlink <from> <to> [--type <type>]
  node issue-todo.mjs plan [--json]        (별칭: todo)
  node issue-todo.mjs next
  node issue-todo.mjs validate
  node issue-todo.mjs audit
  node issue-todo.mjs migrate

엣지 방향: from --depends-on--> to = "from 은 to 가 close 전엔 착수 불가".
그래프: ${WORKSPACE_DIR}/${GRAPH_FILE} (GitHub 정본에서 재생성하는 로컬 캐시).
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
  const MODES = ['sync', 'link', 'unlink', 'plan', 'next', 'validate', 'audit', 'migrate'];
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
  else if (mode === 'audit') cmdAudit(root, tracker);
  else if (mode === 'migrate') cmdMigrate(root, tracker, opts);
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
