// LLM 엣지 맥락 보강 (#94) — 결정론 패스 위에 요약·분류만 얹고, 실패하면 조용히 결정론으로 폴백한다.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { EDGE_KINDS, edgeKey } from './issue-graph-v2.mjs';

export const LLM_PROMPT_VERSION = 1;
export const DEFAULT_LLM_MODEL = 'haiku';
export const LLM_VERDICTS = ['entailed', 'neutral', 'contradicted'];

/** 증분 재생성 키. 본문·코멘트·프롬프트 버전·모델이 하나라도 바뀌면 무효화된다. */
export function buildCacheKey({ fromBody = '', toBody = '', comments = '', promptVersion = LLM_PROMPT_VERSION, modelId = DEFAULT_LLM_MODEL } = {}) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify([String(fromBody).normalize('NFC'), String(toBody).normalize('NFC'), String(comments).normalize('NFC'), promptVersion, modelId]));
  return `sha256:${hash.digest('hex')}`;
}

/** ISSUE_LLM_CMD 재정의 → claude CLI 탐지 순. 없으면 null (호출부는 결정론 폴백). */
export function detectLlmCommand(env = process.env) {
  if (env.ISSUE_LLM_CMD) return env.ISSUE_LLM_CMD;
  const probe = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 10000 });
  return probe.error || probe.status !== 0 ? null : 'claude';
}

/** headless 1회 호출. 어떤 실패든 null — 예외를 밖으로 던지지 않는다. */
export function runLlm(command, prompt, { timeoutMs = 180000, model = DEFAULT_LLM_MODEL } = {}) {
  try {
    const isClaude = /(^|\/)claude$/.test(command);
    const args = isClaude ? ['-p', '--model', model, prompt] : [prompt];
    const r = spawnSync(command, args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
    if (r.error || r.status !== 0 || !r.stdout) return null;
    return r.stdout;
  } catch {
    return null;
  }
}

/** 응답에서 첫 JSON 값만 추출한다. 실패 시 null. */
export function parseLlmJson(text) {
  if (!text) return null;
  const start = text.search(/[[{]/);
  if (start < 0) return null;
  for (let end = text.length; end > start; end -= 1) {
    const ch = text[end - 1];
    if (ch !== ']' && ch !== '}') continue;
    try { return JSON.parse(text.slice(start, end)); } catch { /* 더 짧은 구간 재시도 */ }
  }
  return null;
}

/** 생성 항목 검증 게이트. 위반 항목은 통째로 폐기한다 (부분 수용 없음). */
export function validateEnrichment(item) {
  if (!item || typeof item !== 'object') return null;
  const summary = typeof item.summary === 'string' ? item.summary.trim() : '';
  const label = typeof item.label === 'string' ? item.label.trim() : '';
  if (!summary || summary.length > 200) return null;
  if (!label || label.length > 20) return null;
  if (!EDGE_KINDS.includes(item.kind)) return null;
  const keywords = Array.isArray(item.keywords)
    ? item.keywords.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim().slice(0, 40)).slice(0, 6)
    : [];
  return { edge: String(item.edge ?? ''), summary, label, kind: item.kind, keywords };
}

export function buildEnrichPrompt(pending) {
  const lines = pending.map((p) => `- edge ${p.id} / #${p.edge.from} "${p.fromTitle}" 이(가) #${p.edge.to} "${p.toTitle}" 을(를) ${p.edge.type} 로 참조 / 인용문: "${p.quote || '(없음)'}" / 공유 개념: ${p.shared.join(', ') || '(없음)'}`);
  return [
    '너는 이슈 그래프 엣지의 연결 근거를 요약한다. 아래 각 엣지에 대해 JSON 배열 **만** 출력하라. 설명·마크다운·코드펜스 금지.',
    '각 항목 형식: {"edge":"<id>","summary":"<한국어 1문장, 두 이슈가 왜 연결됐는지, 120자 이내>","kind":"blocked-by|composition|duplicate|temporal|relates","label":"<한국어 20자 이내 칩 라벨>","keywords":["핵심어(최대 4개)"]}',
    '규칙: 인용문을 다시 쓰거나 새 사실을 창작하지 마라. summary 는 제공된 인용문·제목 범위 안에서만 작성한다. 근거가 불충분한 엣지는 배열에서 생략하라. 출력 언어는 한국어다.',
    '',
    '[엣지 목록]',
    ...lines,
  ].join('\n');
}

export function buildEntailmentPrompt(items) {
  const lines = items.map((p) => `- edge ${p.id} / summary: "${p.summary}" / quote: "${p.quote}"`);
  return [
    '각 항목의 summary 가 quote 원문으로부터 따라 나오는지 판정하라. JSON 배열 **만** 출력하라.',
    '각 항목 형식: {"edge":"<id>","verdict":"entailed|neutral|contradicted"}',
    'entailed: 요약이 인용문으로 뒷받침됨 / neutral: 인용문만으로 판단 불가 / contradicted: 인용문과 어긋남. 확률값·설명 금지.',
    '',
    ...lines,
  ].join('\n');
}

/** 검증 통과 항목을 엣지에 적용한다. contradicted 는 폐기하고 결정론 산출물을 유지한다. */
export function applyEnrichment(edge, item, verdict, { model = DEFAULT_LLM_MODEL, cacheKey = null } = {}) {
  if (!item || verdict === 'contradicted') {
    const context = { ...edge.context, confidence: verdict === 'contradicted' ? 'low' : edge.context?.confidence };
    return { ...edge, context, cacheKey };
  }
  const confidence = verdict === 'entailed' ? 'high' : 'medium';
  const context = {
    ...edge.context,
    summary: item.summary,
    label: item.label,
    keywords: item.keywords.length ? item.keywords : edge.context?.keywords ?? [],
    generatedBy: 'llm',
    model,
    promptVersion: LLM_PROMPT_VERSION,
    confidence,
  };
  return { ...edge, kind: item.kind, rationale: item.summary, context, cacheKey };
}

/**
 * sync 훅. 결정론 엣지(createdBy:'sync')만 대상 — all-pairs 호출 없음.
 * 캐시 히트는 이전 그래프의 llm 결과를 재사용하고, 미캐시만 배치 2회(생성+entailment) 호출한다.
 * 어떤 실패든 해당 엣지는 결정론 산출물을 유지하고 sync 는 정상 진행된다.
 */
export function enrichEdges(edges, { itemByNumber, previousEdges = [], command, model = DEFAULT_LLM_MODEL, runner = runLlm } = {}) {
  const stats = { enriched: 0, cached: 0, discarded: 0, skipped: null };
  const syncEdges = edges.filter((e) => e.createdBy === 'sync');
  if (!syncEdges.length) return { edges, stats };
  if (!command) { stats.skipped = 'llm-command-not-found'; return { edges, stats }; }

  const prevByKey = new Map(previousEdges.map((e) => [edgeKey(e), e]));
  const replaced = new Map();
  const pending = [];
  for (const edge of syncEdges) {
    const fromItem = itemByNumber.get(edge.from);
    const toItem = itemByNumber.get(edge.to);
    const cacheKey = buildCacheKey({ fromBody: fromItem?.body ?? '', toBody: toItem?.body ?? '', comments: JSON.stringify(fromItem?.comments ?? []), modelId: model });
    const prev = prevByKey.get(edgeKey(edge));
    if (prev && prev.cacheKey === cacheKey && prev.context) {
      replaced.set(edgeKey(edge), { ...edge, kind: prev.kind ?? edge.kind, rationale: prev.rationale ?? edge.rationale, context: prev.context, cacheKey });
      stats.cached += 1;
      continue;
    }
    pending.push({ id: `${edge.from}>${edge.to}`, edge, cacheKey, quote: edge.evidence?.[0]?.quote ?? '', fromTitle: fromItem?.title ?? '', toTitle: toItem?.title ?? '', shared: edge.context?.sharedConcepts ?? [] });
  }

  if (pending.length) {
    const generated = parseLlmJson(runner(command, buildEnrichPrompt(pending), { model }));
    // 호출·파싱 실패는 일시 장애다 — cacheKey 를 남기지 않아 다음 sync 가 재시도한다.
    // (모델이 응답했지만 항목을 생략·위반한 경우만 아래에서 부정 캐시된다.)
    if (!Array.isArray(generated)) {
      stats.skipped = 'llm-call-failed';
      return { edges: edges.map((e) => replaced.get(edgeKey(e)) ?? e), stats };
    }
    const items = new Map();
    for (const raw of Array.isArray(generated) ? generated : []) {
      const valid = validateEnrichment(raw);
      if (valid) items.set(valid.edge, valid);
    }
    const toJudge = pending.filter((p) => items.has(p.id) && p.quote).map((p) => ({ id: p.id, summary: items.get(p.id).summary, quote: p.quote }));
    const verdicts = new Map();
    if (toJudge.length) {
      const judged = parseLlmJson(runner(command, buildEntailmentPrompt(toJudge), { model }));
      for (const j of Array.isArray(judged) ? judged : []) {
        if (j && LLM_VERDICTS.includes(j.verdict)) verdicts.set(String(j.edge), j.verdict);
      }
    }
    for (const p of pending) {
      const item = items.get(p.id) ?? null;
      const verdict = item ? verdicts.get(p.id) ?? 'neutral' : null;
      replaced.set(edgeKey(p.edge), applyEnrichment(p.edge, item, verdict, { model, cacheKey: p.cacheKey }));
      if (item && verdict !== 'contradicted') stats.enriched += 1;
      else if (item) stats.discarded += 1;
    }
  }

  return { edges: edges.map((e) => replaced.get(edgeKey(e)) ?? e), stats };
}
