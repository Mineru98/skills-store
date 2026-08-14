#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { tmpdir } from 'node:os';
import {
  EDGE_TYPES, digest, normalizeEdge, parseDecisionComments, decisionEdge,
  CONTEXT_FIELDS, auditGraph, migrateGraphV1, validateGraphV2, duplicateScore, duplicateVerdict, evaluateDuplicate, measureFieldQuality, resolveDecisions,
  EDGE_KINDS, EDGE_CONTEXT_VERSION, kindOfType, extractQuote, sharedConcepts, carryStaleEdges, edgeKey,
} from '../.codex/skills/issue-onboard/scripts/issue-graph-v2.mjs';
import { deriveStatus, classify, parseDependencies } from '../.codex/skills/issue-onboard/scripts/issue-onboard.mjs';
import { LLM_PROMPT_VERSION, buildCacheKey, parseLlmJson, validateEnrichment, applyEnrichment, enrichEdges } from '../.codex/skills/issue-onboard/scripts/issue-llm.mjs';

assert.deepEqual(EDGE_TYPES, ['depends-on', 'parent-of', 'duplicate-of', 'relates-to', 'supersedes']);

// --- #93 엣지 맥락 스키마 v3: 결정론 근거 추출과 수명주기 ---
assert.equal(EDGE_CONTEXT_VERSION, 1);
assert.deepEqual(EDGE_KINDS, ['blocked-by', 'composition', 'duplicate', 'temporal', 'relates']);
assert.equal(kindOfType('depends-on'), 'blocked-by');
assert.equal(kindOfType('parent-of'), 'composition');
assert.equal(kindOfType('supersedes'), 'temporal');

const koreanBody = '결정론 패스가 저장한 인용문 위에 요약을 보강한다.\n\ndepends on #93\n\nLLM 실패 시에도 그래프는 결정론 근거를 유지해야 한다.';
const [koreanRef] = parseDependencies(koreanBody);
assert.equal(koreanRef.to, 93);
assert.equal(koreanRef.matched, 'depends on #93');
const extracted = extractQuote(koreanBody, koreanRef.index, koreanRef.matched.length);
assert.ok(extracted.quote.includes('depends on #93'), '발췌에 매치 원문 포함');
assert.equal(koreanBody.normalize('NFC').indexOf(extracted.quote), extracted.start, 'NFC indexOf 재검증');
assert.equal(extracted.end - extracted.start, extracted.quote.length);
// NFD(자모 분리) 입력도 NFC 기준 offset 으로 정규화된다
const nfdBody = '그래프 갱신.\ndepends on #7 뒤에 정리한다.'.normalize('NFD');
const [nfdRef] = parseDependencies(nfdBody);
const nfdExtracted = extractQuote(nfdBody, nfdRef.index, nfdRef.matched.length);
assert.equal(nfdBody.normalize('NFC').indexOf(nfdExtracted.quote), nfdExtracted.start);
// 범위 밖 index 는 null
assert.equal(extractQuote('short', 99, 3), null);
// 결정론: 같은 입력 2회 → 같은 출력
assert.deepEqual(extractQuote(koreanBody, koreanRef.index, koreanRef.matched.length), extracted);

const conceptsA = { title: '엣지 스키마', body: '`issue-graph-v2.mjs` 와 scripts/issue-onboard.mjs 를 고친다', labels: ['enhancement'] };
const conceptsB = { title: '뷰 개선', body: '`issue-graph-v2.mjs` 렌더와 scripts/issue-onboard.mjs 참고', labels: ['enhancement', 'bug'] };
const shared = sharedConcepts(conceptsA, conceptsB);
assert.ok(shared.includes('enhancement'));
assert.ok(shared.includes('issue-graph-v2.mjs'));
assert.ok(shared.includes('scripts/issue-onboard.mjs'));
assert.deepEqual(sharedConcepts(conceptsA, {}), []);

const oldSyncEdge = { from: 61, to: 60, type: 'depends-on', createdBy: 'sync', rationale: 'r' };
const oldDecisionEdge = { from: 9, to: 4, type: 'duplicate-of', createdBy: 'decision' };
const carried = carryStaleEdges([oldSyncEdge, oldDecisionEdge], new Set(), '2026-08-14T00:00:00Z');
assert.equal(carried.length, 1, '결정 엣지는 stale 로 이관하지 않음');
assert.equal(carried[0].status, 'stale');
assert.equal(carried[0].staleAt, '2026-08-14T00:00:00Z');
assert.equal(carryStaleEdges([{ ...oldSyncEdge, status: 'stale', staleAt: '2026-08-01T00:00:00Z' }], new Set(), '2026-08-14T00:00:00Z')[0].staleAt, '2026-08-01T00:00:00Z', '기존 staleAt 보존');
assert.deepEqual(carryStaleEdges([oldSyncEdge], new Set([edgeKey(oldSyncEdge)]), 'now'), [], '재감지된 엣지는 부활');

// --- #94 LLM 엣지 맥락 보강 ---
const keyBase = buildCacheKey({ fromBody: 'a', toBody: 'b', comments: '[]' });
assert.equal(keyBase, buildCacheKey({ fromBody: 'a', toBody: 'b', comments: '[]' }), 'cacheKey 결정론');
assert.notEqual(keyBase, buildCacheKey({ fromBody: 'a', toBody: 'b', comments: '[]', promptVersion: LLM_PROMPT_VERSION + 1 }), 'promptVersion 범프 시 무효화');
assert.notEqual(keyBase, buildCacheKey({ fromBody: 'a2', toBody: 'b', comments: '[]' }), '본문 변경 시 무효화');
assert.deepEqual(parseLlmJson('앞말 [{"edge":"1>2","verdict":"entailed"}] 뒷말'), [{ edge: '1>2', verdict: 'entailed' }]);
assert.equal(parseLlmJson('JSON 없음'), null);
assert.equal(validateEnrichment({ edge: '1>2', summary: 's', kind: 'unknown-kind', label: 'l' }), null, '허용 밖 kind 폐기');
assert.equal(validateEnrichment({ edge: '1>2', summary: 's', kind: 'blocked-by', label: '스무글자제한을확실히넘기는아주아주긴라벨문자열' }), null, '20자 초과 label 폐기');
const validItem = validateEnrichment({ edge: '1>2', summary: '#1 이 #2 의 스키마를 전제한다', kind: 'blocked-by', label: '스키마 선행', keywords: ['스키마', ''] });
assert.deepEqual(validItem.keywords, ['스키마']);
const detEdge = { from: 1, to: 2, type: 'depends-on', kind: 'blocked-by', rationale: '결정론 요약', createdBy: 'sync', context: { summary: '결정론 요약', generatedBy: 'deterministic', confidence: 'high', keywords: [] }, evidence: [{ quote: 'depends on #2' }] };
const enriched = applyEnrichment(detEdge, validItem, 'entailed', { cacheKey: keyBase });
assert.equal(enriched.context.generatedBy, 'llm');
assert.equal(enriched.context.confidence, 'high');
assert.equal(enriched.rationale, validItem.summary, 'rationale 하위 호환 갱신');
assert.equal(applyEnrichment(detEdge, validItem, 'neutral', {}).context.confidence, 'medium');
const rejected = applyEnrichment(detEdge, validItem, 'contradicted', { cacheKey: keyBase });
assert.equal(rejected.context.generatedBy, 'deterministic', 'contradicted 는 결정론 유지');
assert.equal(rejected.context.confidence, 'low');
assert.equal(rejected.cacheKey, keyBase, '부정 결과도 캐시');
// enrichEdges: mock runner 로 파이프라인 검증 (실 LLM 호출 없음)
const mockItems = new Map([['1>2', { edge: '1>2', summary: '#1 은 #2 완료가 선행이다', kind: 'blocked-by', label: '선행 의존', keywords: ['선행'] }]]);
const mockRunner = (_cmd, prompt) => prompt.includes('verdict')
  ? JSON.stringify([{ edge: '1>2', verdict: 'entailed' }])
  : JSON.stringify([...mockItems.values()]);
const itemByNumber = new Map([[1, { number: 1, title: 'one', body: 'depends on #2', comments: [] }], [2, { number: 2, title: 'two', body: 'b', comments: [] }]]);
const run1 = enrichEdges([detEdge], { itemByNumber, previousEdges: [], command: 'mock', runner: mockRunner });
assert.equal(run1.stats.enriched, 1);
assert.equal(run1.edges[0].context.generatedBy, 'llm');
const run2 = enrichEdges([detEdge], { itemByNumber, previousEdges: run1.edges, command: 'mock', runner: () => { throw new Error('캐시 히트면 호출되지 않아야 한다'); } });
assert.equal(run2.stats.cached, 1, '동일 입력 재실행은 캐시 히트');
assert.equal(run2.edges[0].context.generatedBy, 'llm');
const runNoCmd = enrichEdges([detEdge], { itemByNumber, previousEdges: [], command: null });
assert.equal(runNoCmd.stats.skipped, 'llm-command-not-found');
assert.equal(runNoCmd.edges[0].context.generatedBy, 'deterministic', 'LLM 부재 시 결정론 폴백');
const runFailed = enrichEdges([detEdge], { itemByNumber, previousEdges: [], command: 'mock', runner: () => 'JSON 아님 — 호출 실패 시뮬레이션' });
assert.equal(runFailed.stats.skipped, 'llm-call-failed');
assert.equal(runFailed.edges[0].cacheKey, undefined, '일시 실패는 캐시하지 않는다 (다음 sync 재시도)');
assert.equal(runFailed.edges[0].context.generatedBy, 'deterministic');
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
  nodes: Object.fromEntries([4, 9].map((number) => [String(number), {
    number, title: `issue ${number}`, status: 'open', labels: [], url: `https://example.test/issues/${number}`,
    context: Object.fromEntries(CONTEXT_FIELDS.map((field) => [field, { value: 'unknown', reason: 'fixture', source: 'fixture' }])),
    provenance: { url: `https://example.test/issues/${number}`, revision: 'fixture' },
  }])),
  edges: [edge],
};
assert.deepEqual(validateGraphV2(graph), []);
assert.deepEqual(auditGraph(graph), []);
assert.match(auditGraph({ ...graph, nodes: { ...graph.nodes, '4': { ...graph.nodes['4'], context: {} } } }).join('\n'), /맥락 필드 없음/);
assert.match(validateGraphV2({ ...graph, snapshot: { status: 'partial' } })[0], /snapshot/);
assert.match(validateGraphV2({ ...graph, edges: [{ ...edge, decisionId: undefined }] })[0], /duplicate-of/);
assert.match(validateGraphV2({ ...graph, edges: [{ from: 4, to: 9, type: 'parent-of', provenance: {} }, { from: 9, to: 4, type: 'parent-of', provenance: {} }] }).join('\n'), /parent-of 순환/);

const migrated = migrateGraphV1({
  version: 1, updatedAt: '2026-08-01T00:00:00Z', nodes: { '4': { number: 4, url: 'https://example.test/issues/4' }, '9': { number: 9, url: 'https://example.test/issues/9' } },
  edges: [{ from: 4, to: 9, type: 'blocks' }],
}, { now: '2026-08-12T00:00:00Z' });
assert.equal(migrated.snapshot.status, 'migrating');
assert.deepEqual(migrated.edges.map((item) => [item.from, item.to, item.type]), [[9, 4, 'depends-on']]);
assert.match(auditGraph(migrated).join('\n'), /source snapshot/);

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

const base = { number: 100, status: 'open', subject: 'graph cache', outcome: 'reject partial sync', scope: 'issue-onboard', acceptance: 'plan is blocked' };
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

const temporaryRepo = mkdtempSync(path.join(tmpdir(), 'issue-graph-v2-'));
try {
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: temporaryRepo }).status, 0);
  mkdirSync(path.join(temporaryRepo, '.issue'));
  writeFileSync(path.join(temporaryRepo, '.issue', 'graph.json'), JSON.stringify({ version: 2, snapshot: { status: 'partial' }, nodes: {}, edges: [] }));
  const blocked = spawnSync(process.execPath, [path.resolve('.codex/skills/issue-onboard/scripts/issue-onboard.mjs'), 'plan'], { cwd: temporaryRepo, encoding: 'utf8' });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /안전하지 않은 그래프/);
} finally {
  rmSync(temporaryRepo, { recursive: true, force: true });
}

console.log('test-issue-graph-v2: 통과');
