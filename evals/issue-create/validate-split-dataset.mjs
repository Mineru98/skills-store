#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = [
  ['tuning', 'split-eval.json', 400],
  ['holdout', 'split-holdout.json', 100],
];
const LABELS = new Set(['bug', 'enhancement', 'documentation', 'chore']);
const DECISIONS = new Set(['single', 'split', 'partial', 'over_limit']);
const errors = [];
const all = [];

function fail(scope, message) { errors.push(`${scope}: ${message}`); }
function histogram(items, field) {
  const out = {};
  for (const item of items) {
    const key = typeof field === 'function' ? field(item) : item[field];
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

for (const [set, file, expectedSize] of FILES) {
  let cases;
  try { cases = JSON.parse(readFileSync(join(HERE, file), 'utf8')); }
  catch (error) { fail(file, `JSON 파싱 실패: ${error.message}`); continue; }
  if (!Array.isArray(cases)) { fail(file, '최상위 값은 배열이어야 한다.'); continue; }
  if (cases.length !== expectedSize) fail(file, `${expectedSize}건이어야 하나 ${cases.length}건이다.`);
  for (const [index, c] of cases.entries()) {
    const scope = `${file}[${index}]`;
    if (!c || typeof c !== 'object') { fail(scope, '객체가 아니다.'); continue; }
    for (const key of ['id', 'query', 'industry', 'style', 'ambiguity', 'rationale']) {
      if (typeof c[key] !== 'string' || !c[key].trim()) fail(scope, `${key}가 비었다.`);
    }
    if (!DECISIONS.has(c.decision)) fail(scope, `알 수 없는 decision: ${c.decision}`);
    if (!Array.isArray(c.requirements) || c.requirements.length < 1) fail(scope, 'requirements가 비었다.');
    if (!Array.isArray(c.expected_groups) || c.expected_groups.length < 1) fail(scope, 'expected_groups가 비었다.');
    if (!Array.isArray(c.expected_group_labels) || c.expected_group_labels.length !== c.expected_groups?.length) fail(scope, 'expected_group_labels 수가 그룹 수와 다르다.');
    if (!Array.isArray(c.dependencies) || !Array.isArray(c.exceptions) || !Array.isArray(c.tags)) fail(scope, 'dependencies/exceptions/tags는 배열이어야 한다.');

    const ids = new Set();
    for (const [ri, r] of (c.requirements ?? []).entries()) {
      if (!r || typeof r !== 'object') { fail(scope, `requirements[${ri}]가 객체가 아니다.`); continue; }
      if (typeof r.id !== 'string' || !/^r\d+$/.test(r.id)) fail(scope, `잘못된 requirement id: ${r.id}`);
      if (ids.has(r.id)) fail(scope, `requirement id 중복: ${r.id}`);
      ids.add(r.id);
      if (typeof r.text !== 'string' || !r.text.trim()) fail(scope, `${r.id} text가 비었다.`);
      if (!c.query?.includes(r.text)) fail(scope, `${r.id} text가 query의 정확한 부분 문자열이 아니다.`);
      if (!LABELS.has(r.label)) fail(scope, `${r.id} label이 잘못됐다: ${r.label}`);
    }

    const grouped = [];
    for (const [gi, group] of (c.expected_groups ?? []).entries()) {
      if (!Array.isArray(group) || group.length < 1) { fail(scope, `group ${gi + 1}가 비었다.`); continue; }
      for (const id of group) {
        if (!ids.has(id)) fail(scope, `group ${gi + 1}의 알 수 없는 id: ${id}`);
        grouped.push(id);
      }
      if (!LABELS.has(c.expected_group_labels?.[gi])) fail(scope, `group ${gi + 1} label이 잘못됐다.`);
    }
    if (grouped.length !== ids.size || new Set(grouped).size !== ids.size) fail(scope, '모든 requirement가 정확히 한 그룹에 속해야 한다.');
    if (c.expected_issue_count !== c.expected_groups?.length) fail(scope, 'expected_issue_count가 그룹 수와 다르다.');
    if (c.decision === 'single' && c.expected_issue_count !== 1) fail(scope, 'single은 그룹이 하나여야 한다.');
    if (c.decision === 'split' && c.expected_issue_count < 2) fail(scope, 'split은 그룹이 둘 이상이어야 한다.');
    if (c.decision === 'partial' && !(c.expected_groups?.some((g) => g.length > 1) && c.expected_groups?.some((g) => g.length === 1))) fail(scope, 'partial은 결합 그룹과 독립 그룹이 모두 필요하다.');
    if (c.decision === 'over_limit' && c.expected_issue_count <= 5) fail(scope, 'over_limit은 독립 그룹이 5개를 초과해야 한다.');
    all.push({ ...c, _set: set });
  }
}

const seenIds = new Map();
const seenQueries = new Map();
for (const c of all) {
  const normalized = c.query.replace(/\s+/g, ' ').trim().toLowerCase();
  if (seenIds.has(c.id)) fail(c.id, `ID 중복 (${seenIds.get(c.id)}와 ${c._set})`);
  if (seenQueries.has(normalized)) fail(c.id, `query 중복 (${seenQueries.get(normalized)})`);
  seenIds.set(c.id, c._set);
  seenQueries.set(normalized, c.id);
}
const implicitCompositeCases = all.filter((c) => c.tags.includes('implicit-composite'));
if (implicitCompositeCases.length !== 100) fail('암묵 복합 표본', `100건이어야 하나 ${implicitCompositeCases.length}건이다.`);
for (const c of implicitCompositeCases) {
  if (c.requirements.length < 2) fail(c.id, '암묵 복합 표본에는 원자 요구사항이 둘 이상 필요하다.');
}
if (all.length !== 500) fail('전체', `500건이어야 하나 ${all.length}건이다.`);

const industry = histogram(all, 'industry');
const style = histogram(all, 'style');
const decision = histogram(all, 'decision');
const requirementCount = histogram(all, (c) => c.requirements.length > 5 ? '6+' : String(c.requirements.length));
if (Object.keys(industry).length < 20) fail('분포', `산업이 20종 미만이다: ${Object.keys(industry).length}`);
for (const [key, count] of Object.entries(industry)) if (count < 10) fail('분포', `${key} 산업 사례가 10건 미만이다: ${count}`);
for (const [key, count] of Object.entries(style)) if (count < 100) fail('분포', `${key} 문체가 100건 미만이다: ${count}`);
for (const key of DECISIONS) if (!decision[key] || decision[key] < 50) fail('분포', `${key} 결정이 50건 미만이다: ${decision[key] ?? 0}`);
for (const key of ['1', '2', '3', '4', '5', '6+']) if (!requirementCount[key]) fail('분포', `요구사항 ${key}개 사례가 없다.`);

const summary = { total: all.length, sets: Object.fromEntries(FILES.map(([set]) => [set, all.filter((c) => c._set === set).length])), industries: Object.keys(industry).length, styles: style, decisions: decision, requirement_counts: requirementCount };
if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`);
  console.error(`\n${errors.length}개 오류`);
  process.exit(1);
}
console.log('✓ 분해 데이터셋 검증 통과');
console.log(JSON.stringify(summary, null, 2));
