import { createHash } from 'node:crypto';

export const GRAPH_VERSION = 2;
export const EDGE_TYPES = ['depends-on', 'parent-of', 'duplicate-of', 'relates-to', 'supersedes'];
export const ORDERING_TYPES = new Set(['depends-on']);
export const DECISION_MARKER = 'issue-graph-v2-decision';

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function digest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

export function unknown(reason, source = null) {
  return { value: 'unknown', reason, source };
}

export function normalizeEdge(edge) {
  const next = { ...edge };
  if (next.type === 'relates-to' && Number(next.from) > Number(next.to)) {
    [next.from, next.to] = [next.to, next.from];
  }
  return next;
}

export function edgeKey(edge) {
  const normalized = normalizeEdge(edge);
  return `${normalized.from}|${normalized.to}|${normalized.type}`;
}

export function parseDecisionComments(comments = []) {
  const decisions = [];
  const pattern = new RegExp(`<!--\\s*${DECISION_MARKER}\\s*\\n([\\s\\S]*?)\\n?-->`, 'g');
  for (const comment of comments) {
    const body = String(comment.body ?? '');
    for (const match of body.matchAll(pattern)) {
      try {
        const payload = JSON.parse(match[1]);
        if (payload.version !== 1 || !payload.id || !payload.action) continue;
        decisions.push({
          ...payload,
          source: {
            commentId: comment.id ?? null,
            url: comment.url ?? null,
            author: comment.author?.login ?? comment.author ?? null,
            createdAt: comment.createdAt ?? null,
            updatedAt: comment.updatedAt ?? null,
            digest: digest(match[1]),
          },
        });
      } catch { /* malformed comments are reported by validate */ }
    }
  }
  return decisions;
}

export function decisionEdge(decision) {
  if (decision.action !== 'relation' || decision.decision !== 'approved') return null;
  if (!EDGE_TYPES.includes(decision.type) || !Number.isInteger(decision.from) || !Number.isInteger(decision.to)) return null;
  if (!decision.graphRevision || !Array.isArray(decision.evidence) || !decision.evidence.length) return null;
  return normalizeEdge({
    from: decision.from,
    to: decision.to,
    type: decision.type,
    rationale: decision.rationale ?? '',
    createdBy: 'decision',
    decisionId: decision.id,
    provenance: decision.source,
  });
}

/** 동일 id의 수정·폐기는 최신 GitHub 코멘트 관찰값 하나로 결정한다. */
export function resolveDecisions(decisions = []) {
  const latest = new Map();
  for (const decision of decisions) {
    const previous = latest.get(decision.id);
    const stamp = decision.source?.updatedAt ?? decision.source?.createdAt ?? '';
    const previousStamp = previous?.source?.updatedAt ?? previous?.source?.createdAt ?? '';
    if (!previous || stamp >= previousStamp) latest.set(decision.id, decision);
  }
  return [...latest.values()].filter((decision) => decision.decision === 'approved');
}

export function validateGraphV2(graph) {
  const problems = [];
  if (graph.version !== GRAPH_VERSION) problems.push(`지원하지 않는 그래프 버전: ${graph.version}`);
  if (graph.snapshot?.status !== 'complete') problems.push('불완전하거나 실패한 source snapshot');
  const keys = new Set();
  const parentOf = new Map();
  for (const edge of graph.edges ?? []) {
    const normalized = normalizeEdge(edge);
    const key = edgeKey(edge);
    if (!EDGE_TYPES.includes(edge.type)) problems.push(`알 수 없는 엣지 타입: ${edge.type} (${edge.from}→${edge.to})`);
    if (edge.from === edge.to) problems.push(`자기 자신 엣지: ${edge.from} (${edge.type})`);
    if (keys.has(key)) problems.push(`중복 엣지: ${key}`);
    keys.add(key);
    if (edgeKey(edge) !== `${edge.from}|${edge.to}|${edge.type}`) problems.push(`비정규 엣지: ${edge.from}|${edge.to}|${edge.type}`);
    if (!graph.nodes?.[String(edge.from)] || !graph.nodes?.[String(edge.to)]) problems.push(`dangling 엣지: ${edge.from}→${edge.to}`);
    if (!edge.provenance && edge.createdBy !== 'sync') problems.push(`근거 없는 수동 엣지: ${key}`);
    if (edge.type === 'parent-of') {
      const parents = parentOf.get(edge.to) ?? [];
      parents.push(edge.from);
      parentOf.set(edge.to, parents);
    }
    if (edge.type === 'duplicate-of' && (!edge.decisionId || edge.createdBy !== 'decision')) problems.push(`승인 없는 duplicate-of: ${key}`);
  }
  for (const [child, parents] of parentOf) if (parents.length > 1) problems.push(`#${child}의 parent-of가 여러 개`);
  const visiting = new Set();
  const visited = new Set();
  const visitParent = (node) => {
    if (visiting.has(node)) { problems.push(`parent-of 순환: #${node}`); return; }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const parent of parentOf.get(node) ?? []) visitParent(parent);
    visiting.delete(node);
    visited.add(node);
  };
  for (const child of parentOf.keys()) visitParent(child);
  return problems;
}

export function duplicateScore(candidate, target) {
  const normalize = (text) => new Set(String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((word) => word.length > 1));
  const overlap = (left, right) => {
    const a = normalize(left); const b = normalize(right);
    if (!a.size || !b.size) return 0;
    let shared = 0; for (const token of a) if (b.has(token)) shared += 1;
    return shared / Math.max(a.size, b.size);
  };
  const outcome = overlap(candidate.outcome ?? candidate.title, target.outcome ?? target.title);
  const surface = overlap(candidate.scope ?? candidate.body, target.scope ?? target.body);
  const mechanism = overlap(candidate.mechanism ?? candidate.body, target.mechanism ?? target.body);
  const acceptance = overlap(candidate.acceptance ?? '', target.acceptance ?? '');
  return Number((0.35 * outcome + 0.30 * surface + 0.25 * mechanism + 0.10 * acceptance).toFixed(3));
}

export function duplicateVerdict(score) {
  if (score >= 0.88) return 'review-required';
  if (score >= 0.72) return 'candidate';
  return 'distinct';
}

/** 중복 확정은 유사도와 분리한다. 네 조건이 모두 명시적으로 일치해야 한다. */
export function evaluateDuplicate(candidate, target) {
  const fields = [
    ['subject', 'subject'],
    ['outcome', 'outcome'],
    ['scope', 'scope'],
    ['acceptance', 'acceptance'],
  ];
  const conditions = Object.fromEntries(fields.map(([name, key]) => {
    const left = candidate[key];
    const right = target[key];
    const known = left != null && left !== 'unknown' && right != null && right !== 'unknown';
    return [name, { candidate: left ?? 'unknown', target: right ?? 'unknown', result: !known ? 'unknown' : left === right ? 'match' : 'mismatch' }];
  }));
  const results = Object.values(conditions).map((condition) => condition.result);
  const targetOpen = target.status === 'open';
  const allMatch = targetOpen && results.every((result) => result === 'match');
  return {
    candidate: target.number ?? null,
    targetOpen,
    conditions,
    verdict: allMatch ? 'duplicate-review-required' : results.includes('unknown') ? 'review-or-create' : 'distinct',
    reason: allMatch ? '네 중복 조건이 모두 일치하지만 사람의 구조화 승인 전에는 관계를 만들지 않음'
      : !targetOpen ? '닫힌 이슈는 자동 중복 차단 대상이 아님'
        : results.includes('unknown') ? '필수 조건 중 판단 불가 항목이 있음' : '필수 조건 중 하나 이상이 다름',
  };
}

export function measureFieldQuality(records, fields) {
  const total = records.length || 1;
  return Object.fromEntries(fields.map((field) => {
    const values = records.map((record) => record[field]);
    const unknownCount = values.filter((value) => value?.value === 'unknown' || value === 'unknown' || value == null).length;
    const correct = values.filter((value) => value?.correct === true).length;
    const expected = values.filter((value) => value?.expected === true).length;
    return [field, { accuracy: correct / total, recall: expected / total, unknownRate: unknownCount / total, samples: records.length }];
  }));
}
