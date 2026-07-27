export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[`*_~]/g, '')
    .replace(/[\s.。!?！？]+/g, ' ')
    .trim()
    .replace(/^(또한|그리고|또|겸사겸사)\s+/, '')
    .toLowerCase();
}

export function parseModelJson(text) {
  const raw = String(text ?? '').trim();
  const candidates = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1));
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch { /* try next */ }
  }
  throw new Error('JSON 객체를 찾지 못했다.');
}

function canonicalGroups(groups) {
  return groups.map((g) => [...g].sort()).sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

function sameGroups(a, b) {
  return JSON.stringify(canonicalGroups(a)) === JSON.stringify(canonicalGroups(b));
}

function safeDivide(a, b, empty = 0) { return b ? a / b : empty; }

export function scoreCase(expected, response) {
  if (!response || typeof response !== 'object') throw new Error('응답은 객체여야 한다.');
  if (!Array.isArray(response.requirements) || !Array.isArray(response.groups)) throw new Error('requirements와 groups 배열이 필요하다.');

  const expectedByText = new Map(expected.requirements.map((r) => [normalizeText(r.text), r]));
  const predictedById = new Map();
  const matchedExpected = new Set();
  let atomTp = 0;
  for (const r of response.requirements) {
    if (!r || typeof r.id !== 'string' || typeof r.quote !== 'string' || predictedById.has(r.id)) continue;
    const match = expectedByText.get(normalizeText(r.quote));
    predictedById.set(r.id, match?.id ?? null);
    if (match && !matchedExpected.has(match.id)) { matchedExpected.add(match.id); atomTp += 1; }
  }
  const atomFp = Math.max(0, response.requirements.length - atomTp);
  const atomFn = expected.requirements.length - atomTp;

  const predictedGroups = [];
  const predictedLabels = [];
  for (const group of response.groups) {
    const ids = Array.isArray(group?.requirement_ids) ? group.requirement_ids : [];
    const mapped = [...new Set(ids.map((id) => predictedById.get(id)).filter(Boolean))];
    predictedGroups.push(mapped);
    predictedLabels.push(typeof group?.label === 'string' ? group.label : '');
  }

  const expectedPairs = [];
  const ids = expected.requirements.map((r) => r.id);
  const expectedGroupOf = new Map();
  expected.expected_groups.forEach((g, gi) => g.forEach((id) => expectedGroupOf.set(id, gi)));
  const predictedGroupOf = new Map();
  predictedGroups.forEach((g, gi) => g.forEach((id) => { if (!predictedGroupOf.has(id)) predictedGroupOf.set(id, gi); }));
  let pairTp = 0; let pairFp = 0; let pairFn = 0;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const expectedSame = expectedGroupOf.get(ids[i]) === expectedGroupOf.get(ids[j]);
      const predictedSame = predictedGroupOf.has(ids[i]) && predictedGroupOf.has(ids[j]) && predictedGroupOf.get(ids[i]) === predictedGroupOf.get(ids[j]);
      expectedPairs.push([expectedSame, predictedSame]);
      if (expectedSame && predictedSame) pairTp += 1;
      else if (!expectedSame && predictedSame) pairFp += 1;
      else if (expectedSame && !predictedSame) pairFn += 1;
    }
  }

  let labelCorrect = 0; let labelTotal = 0;
  const expectedCanonical = canonicalGroups(expected.expected_groups);
  for (let gi = 0; gi < predictedGroups.length; gi += 1) {
    const group = [...predictedGroups[gi]].sort();
    const expectedIndex = expected.expected_groups.findIndex((g) => JSON.stringify([...g].sort()) === JSON.stringify(group));
    if (expectedIndex >= 0) {
      labelTotal += 1;
      if (predictedLabels[gi] === expected.expected_group_labels[expectedIndex]) labelCorrect += 1;
    }
  }

  const completeAtoms = atomTp === expected.requirements.length && atomFp === 0;
  const groupingExact = completeAtoms && sameGroups(predictedGroups, expectedCanonical);
  const predictedCount = response.groups.length;
  const hasCombinedGroup = response.groups.some((group) => Array.isArray(group?.requirement_ids) && group.requirement_ids.length > 1);
  const predictedDecision = response.decision === 'over_limit' || predictedCount > 5
    ? 'over_limit'
    : predictedCount === 1
      ? 'single'
      : hasCombinedGroup
        ? 'partial'
        : 'split';
  return {
    atom_tp: atomTp, atom_fp: atomFp, atom_fn: atomFn,
    issue_count_correct: predictedCount === expected.expected_issue_count ? 1 : 0,
    grouping_exact: groupingExact ? 1 : 0,
    pair_tp: pairTp, pair_fp: pairFp, pair_fn: pairFn,
    label_correct: labelCorrect, label_total: labelTotal,
    decision_correct: predictedDecision === expected.decision ? 1 : 0,
    under_split: predictedCount < expected.expected_issue_count ? 1 : 0,
    over_split: predictedCount > expected.expected_issue_count ? 1 : 0,
    over_limit_correct: expected.decision === 'over_limit' ? (predictedDecision === 'over_limit' ? 1 : 0) : null,
    predicted_issue_count: predictedCount,
  };
}

export function aggregateScores(results) {
  const scored = results.filter((r) => r.score);
  const sum = (key) => scored.reduce((acc, r) => acc + (r.score[key] ?? 0), 0);
  const atomTp = sum('atom_tp'); const atomFp = sum('atom_fp'); const atomFn = sum('atom_fn');
  const pairTp = sum('pair_tp'); const pairFp = sum('pair_fp'); const pairFn = sum('pair_fn');
  const atomPrecision = safeDivide(atomTp, atomTp + atomFp);
  const atomRecall = safeDivide(atomTp, atomTp + atomFn);
  const pairPrecision = safeDivide(pairTp, pairTp + pairFp, 1);
  const pairRecall = safeDivide(pairTp, pairTp + pairFn, 1);
  const overLimit = scored.filter((r) => r.score.over_limit_correct !== null);
  return {
    cases: results.length,
    parsed: scored.length,
    parse_rate: safeDivide(scored.length, results.length),
    atom_precision: atomPrecision,
    atom_recall: atomRecall,
    atom_f1: safeDivide(2 * atomPrecision * atomRecall, atomPrecision + atomRecall),
    issue_count_accuracy: safeDivide(sum('issue_count_correct'), scored.length),
    grouping_exact_accuracy: safeDivide(sum('grouping_exact'), scored.length),
    pairwise_precision: pairPrecision,
    pairwise_recall: pairRecall,
    pairwise_f1: safeDivide(2 * pairPrecision * pairRecall, pairPrecision + pairRecall),
    label_accuracy: safeDivide(sum('label_correct'), sum('label_total')),
    decision_accuracy: safeDivide(sum('decision_correct'), scored.length),
    under_split_rate: safeDivide(sum('under_split'), scored.length),
    over_split_rate: safeDivide(sum('over_split'), scored.length),
    over_limit_accuracy: safeDivide(overLimit.reduce((n, r) => n + r.score.over_limit_correct, 0), overLimit.length),
  };
}
