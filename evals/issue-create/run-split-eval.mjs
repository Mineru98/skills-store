#!/usr/bin/env node

import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateScores, parseModelJson, scoreCase } from './split-eval-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const FILES = { tuning: 'split-eval.json', holdout: 'split-holdout.json' };
const DEFAULT_RUBRIC = join(REPO, '.claude', 'skills', 'issue-create', 'references', 'split-requests.md');
const TIMEOUT_MS = 180_000;

function die(message) { console.error(`✗ ${message}`); process.exit(2); }
function parseArgs(argv) {
  const out = { set: 'tuning', sample: null, repeat: 1, model: 'sonnet', concurrency: 3, seed: '33', rubric: DEFAULT_RUBRIC, out: null, responses: null, cache: null, baseline: null, tag: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]; const next = () => argv[++i];
    if (arg === '--set') out.set = next();
    else if (arg === '--sample') out.sample = Number(next());
    else if (arg === '--repeat') out.repeat = Number(next());
    else if (arg === '--model') out.model = next();
    else if (arg === '--concurrency') out.concurrency = Number(next());
    else if (arg === '--seed') out.seed = next();
    else if (arg === '--rubric') out.rubric = next().replace(/^@/, '');
    else if (arg === '--out') out.out = next();
    else if (arg === '--responses') out.responses = next();
    else if (arg === '--cache') out.cache = next();
    else if (arg === '--baseline') out.baseline = next();
    else if (arg === '--tag') out.tag = next();
    else if (arg === '-h' || arg === '--help') out.help = true;
    else die(`알 수 없는 인자: ${arg}`);
  }
  return out;
}

function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const candidates = [join(process.env.HOME ?? '', '.local/bin/claude'), '/usr/local/bin/claude', '/opt/homebrew/bin/claude', join(process.env.HOME ?? '', '.claude/local/claude')];
  for (const path of candidates) if (existsSync(path)) return path;
  try { return execFileSync('sh', ['-c', 'command -v claude'], { encoding: 'utf8' }).trim() || die('claude 실행 파일을 찾지 못했다.'); }
  catch { return die('claude 실행 파일을 찾지 못했다. CLAUDE_BIN으로 경로를 넘겨라.'); }
}

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function selectCases(cases, sample, seed) {
  const ordered = [...cases].sort((a, b) => hash(`${seed}:${a.id}`).localeCompare(hash(`${seed}:${b.id}`)));
  if (sample === null || sample >= cases.length) return ordered;
  const buckets = new Map();
  for (const item of ordered) {
    const bucket = buckets.get(item.decision) ?? [];
    bucket.push(item);
    buckets.set(item.decision, bucket);
  }
  const selected = [];
  const names = [...buckets.keys()].sort();
  while (selected.length < sample) {
    let added = false;
    for (const name of names) {
      const item = buckets.get(name).shift();
      if (item) { selected.push(item); added = true; }
      if (selected.length === sample) break;
    }
    if (!added) break;
  }
  return selected;
}

function buildPrompt(rubric, testCase) {
  return `당신은 GitHub 이슈 분해 판정기다. 아래 루브릭만 근거로 요청을 원자 요구사항과 이슈 그룹으로 나눠라.\n\n<rubric>\n${rubric}\n</rubric>\n\n<request>\n${testCase.query}\n</request>\n\n규칙:\n- 요구사항은 요청에 나타난 순서대로 r1, r2, ... ID를 붙인다.\n- quote는 요청에 실제로 들어 있는 요구사항 문구를 글자 그대로 복사한다. 요약하거나 바꾸지 않는다.\n- groups는 모든 requirement ID를 정확히 한 번 포함한다.\n- label은 bug, enhancement, documentation, chore 중 하나다.\n- decision은 그룹 1개면 single, 모든 그룹이 원자 하나씩이면 split, 결합 그룹과 별도 그룹이 섞이면 partial이다.\n- 독립 그룹이 5개를 초과하면 decision은 over_limit이고, 그래도 발견한 전체 그룹은 모두 출력한다.\n- 설명이나 Markdown 없이 JSON 객체 하나만 출력한다.\n\n출력 스키마:\n{"decision":"single|split|partial|over_limit","requirements":[{"id":"r1","quote":"요청의 정확한 문구"}],"groups":[{"requirement_ids":["r1"],"label":"enhancement","title":"짧은 제목"}],"rationale":["판정 근거"]}`;
}

function runClaude(bin, model, prompt) {
  return new Promise((resolveRun) => {
    const child = spawn(bin, ['-p', prompt, '--model', model, '--strict-mcp-config', '--no-session-persistence', '--tools', '', '--output-format', 'json'], {
      cwd: REPO,
      env: { ...process.env, DISABLE_OMC: '1', OMC_SKIP_HOOKS: 'all' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return resolveRun({ error: 'timeout' });
      if (code !== 0) return resolveRun({ error: stderr.trim() || `claude exit ${code}` });
      try {
        const envelope = JSON.parse(stdout);
        const text = typeof envelope.result === 'string' ? envelope.result : stdout;
        const response = parseModelJson(text);
        return resolveRun({ text, response });
      } catch (error) {
        return resolveRun({ text: stdout, error: `parse: ${error.message}` });
      }
    });
  });
}

async function pool(items, concurrency, worker) {
  const results = new Array(items.length); let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await worker(items[index], index); }
  });
  await Promise.all(workers); return results;
}

function printMetrics(metrics) {
  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  console.log(`파싱 성공       ${metrics.parsed}/${metrics.cases} (${pct(metrics.parse_rate)})`);
  console.log(`원자 요구 F1    ${pct(metrics.atom_f1)} (P ${pct(metrics.atom_precision)} / R ${pct(metrics.atom_recall)})`);
  console.log(`이슈 수 정확도  ${pct(metrics.issue_count_accuracy)}`);
  console.log(`그룹 완전일치   ${pct(metrics.grouping_exact_accuracy)}`);
  console.log(`쌍별 그룹 F1    ${pct(metrics.pairwise_f1)}`);
  console.log(`라벨 정확도     ${pct(metrics.label_accuracy)}`);
  console.log(`결정 정확도     ${pct(metrics.decision_accuracy)}`);
  console.log(`과소/과대 분할  ${pct(metrics.under_split_rate)} / ${pct(metrics.over_split_rate)}`);
  console.log(`상한 처리       ${pct(metrics.over_limit_accuracy)}`);
}

function compareBaseline(metrics, file) {
  const baseline = JSON.parse(readFileSync(resolve(file), 'utf8')).metrics;
  if (!baseline) die('--baseline 파일에 metrics가 없다.');
  const keys = ['atom_f1', 'issue_count_accuracy', 'grouping_exact_accuracy', 'pairwise_f1', 'decision_accuracy', 'over_limit_accuracy'];
  const deltas = Object.fromEntries(keys.map((key) => [key, metrics[key] - baseline[key]]));
  console.log('\n기준 대비 변화');
  for (const [key, value] of Object.entries(deltas)) console.log(`${key.padEnd(25)} ${(value >= 0 ? '+' : '')}${(value * 100).toFixed(1)}%p`);
  return deltas;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('node evals/issue-create/run-split-eval.mjs [--set tuning|holdout] [--tag TAG] [--sample N] [--repeat N] [--model sonnet] [--concurrency 3] [--seed 33] [--rubric @file] [--cache file.json] [--responses result.json] [--baseline result.json] [--out result.json]');
    return;
  }
  const dataFile = FILES[opts.set];
  if (!dataFile) die('--set은 tuning 또는 holdout이어야 한다.');
  const rawCases = JSON.parse(readFileSync(join(HERE, dataFile), 'utf8'));
  const cases = opts.tag === null ? rawCases : rawCases.filter((testCase) => testCase.tags?.includes(opts.tag));
  if (!cases.length) die(`--tag ${opts.tag}에 맞는 사례가 없다.`);
  const byId = new Map(cases.map((c) => [c.id, c]));
  let runs;

  if (opts.responses) {
    const saved = JSON.parse(readFileSync(resolve(opts.responses), 'utf8'));
    runs = (saved.runs ?? []).map((run) => {
      const testCase = byId.get(run.case_id);
      if (!testCase) return { ...run, error: '현재 데이터셋에 case_id가 없다.' };
      try { return { ...run, score: scoreCase(testCase, run.response ?? parseModelJson(run.text)) }; }
      catch (error) { return { ...run, score: null, error: error.message }; }
    });
  } else {
    if (!Number.isInteger(opts.repeat) || opts.repeat < 1 || !Number.isInteger(opts.concurrency) || opts.concurrency < 1) die('--repeat와 --concurrency는 양의 정수여야 한다.');
    if (opts.sample !== null && (!Number.isInteger(opts.sample) || opts.sample < 1)) die('--sample은 양의 정수여야 한다.');
    const rubricPath = resolve(opts.rubric);
    if (!existsSync(rubricPath)) die(`루브릭 파일이 없다: ${rubricPath}`);
    const rubric = readFileSync(rubricPath, 'utf8');
    const selected = selectCases(cases, opts.sample, opts.seed);
    const trials = selected.flatMap((testCase) => Array.from({ length: opts.repeat }, (_, repeat) => ({ testCase, repeat })));
    const cachePath = opts.cache ? resolve(opts.cache) : null;
    const cache = cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
    const bin = findClaude(); let completed = 0;
    console.log(`셋 ${opts.set} ${selected.length}건 × ${opts.repeat}회 / ${opts.model} / 동시 ${opts.concurrency}`);
    console.log(`루브릭 ${rubricPath}`);
    runs = await pool(trials, opts.concurrency, async ({ testCase, repeat }) => {
      const prompt = buildPrompt(rubric, testCase);
      const cacheKey = hash(`${opts.model}\n${prompt}\nrepeat:${repeat}`);
      let result = cache[cacheKey];
      if (!result) {
        result = await runClaude(bin, opts.model, prompt);
        if (cachePath && !result.error) { cache[cacheKey] = result; writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`); }
      }
      completed += 1; process.stderr.write(`\r${completed}/${trials.length}`);
      if (result.error) return { case_id: testCase.id, repeat, text: result.text ?? '', response: result.response ?? null, score: null, error: result.error };
      try { return { case_id: testCase.id, repeat, text: result.text, response: result.response, score: scoreCase(testCase, result.response), error: null }; }
      catch (error) { return { case_id: testCase.id, repeat, text: result.text, response: result.response, score: null, error: error.message }; }
    });
    process.stderr.write('\n');
  }

  const metrics = aggregateScores(runs);
  printMetrics(metrics);
  const result = { version: 1, set: opts.set, tag: opts.tag, model: opts.model, generated_at: new Date().toISOString(), metrics, runs };
  if (opts.baseline) result.deltas = compareBaseline(metrics, opts.baseline);
  if (opts.out) { writeFileSync(resolve(opts.out), `${JSON.stringify(result, null, 2)}\n`); console.log(`\n결과 저장: ${resolve(opts.out)}`); }
  if (metrics.parse_rate < 1) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack ?? error.message); process.exit(1); });
