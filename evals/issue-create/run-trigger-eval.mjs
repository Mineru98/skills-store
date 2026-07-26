#!/usr/bin/env node
// issue-create 의 frontmatter description 이 실제로 스킬을 발동시키는지 실측한다.
//
// 커밋이 충분히 쌓인 픽스처 저장소를 만들고 issue-create / issue-start / issue-end /
// issue-merge / gh-setup 을 함께 설치해 경쟁 상태를 실제 사용 환경과 맞춘 뒤,
// 회귀 셋의 질의를 헤드리스 claude 에 던져 Skill 도구가 issue-create 를 부르는지 센다.
//
//   node evals/issue-create/run-trigger-eval.mjs --set tuning
//   node evals/issue-create/run-trigger-eval.mjs --set holdout --repeat 5
//   node evals/issue-create/run-trigger-eval.mjs --set tuning --description @/tmp/old.txt
//
// --description 을 주면 그 문구로 SKILL.md 의 description 을 갈아끼운 뒤 잰다.
// 개선 전 문구를 같은 조건에서 다시 재려고 둔 옵션이다.

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

// 경쟁 조건. issue-* 만 깔면 스킬 목록 자체가 "이 저장소는 이슈 워크플로를 쓴다" 는 힌트가 되어
// recall 이 부풀려진다. 기본값은 저장소의 스킬 전부를 깔아 무관한 스킬과도 경쟁시킨다.
const CORE_SKILLS = ['issue-create', 'issue-start', 'issue-end', 'issue-merge', 'gh-setup'];
// 실제 사용 환경과 같은 도구셋으로 잰다. Edit/Write/Bash 를 빼면 모델이 코드로 직행할 길이
// 막혀 Skill 쪽으로 쏠리고, 정작 이 이슈가 지적한 미발동 상황이 재현되지 않는다.
const DEFAULT_TOOLS = 'default';
const FIXTURE_COMMITS = 35;
const TIMEOUT_MS = 180_000;

const SETS = {
  tuning: 'trigger-eval.json',
  holdout: 'holdout-eval.json',
};

function parseArgs(argv) {
  const out = { set: 'tuning', repeat: 3, model: 'sonnet', concurrency: 3, description: null, out: null, tools: DEFAULT_TOOLS, skills: 'all' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--set') out.set = next();
    else if (a === '--repeat') out.repeat = Number(next());
    else if (a === '--model') out.model = next();
    else if (a === '--concurrency') out.concurrency = Number(next());
    else if (a === '--description') out.description = next();
    else if (a === '--out') out.out = next();
    else if (a === '--tools') out.tools = next();
    else if (a === '--skills') out.skills = next();
    else if (a === '-h' || a === '--help') out.help = true;
    else die(`알 수 없는 인자: ${a}`);
  }
  return out;
}

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(2);
}

function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const candidates = [
    join(process.env.HOME ?? '', '.local/bin/claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    join(process.env.HOME ?? '', '.claude/local/claude'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  try {
    return execFileSync('sh', ['-c', 'command -v claude'], { encoding: 'utf8' }).trim() || die('claude 실행 파일을 찾지 못했다. CLAUDE_BIN 으로 경로를 넘겨라.');
  } catch {
    return die('claude 실행 파일을 찾지 못했다. CLAUDE_BIN 으로 경로를 넘겨라.');
  }
}

function resolveSkills(mode) {
  if (mode === 'core') return CORE_SKILLS;
  const all = readdirSync(join(REPO, '.claude', 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name);
  for (const s of CORE_SKILLS) if (!all.includes(s)) die(`스킬이 없다: ${s}`);
  return all;
}

// 픽스처 저장소를 만든다. 성숙도 게이트를 통과할 만큼 커밋을 쌓고 스킬을 함께 설치한다.
function buildSandbox(descriptionOverride, skills) {
  const dir = mkdtempSync(join(tmpdir(), 'issue-create-eval-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 'eval@example.com');
  git('config', 'user.name', 'eval');
  git('config', 'commit.gpgsign', 'false');
  for (let i = 1; i <= FIXTURE_COMMITS; i += 1) {
    writeFileSync(join(dir, 'app.js'), `// revision ${i}\n`.repeat(i));
    git('add', '-A');
    git('commit', '-qm', `feat: 반복 변경 ${i}`);
  }

  for (const skill of skills) {
    const src = join(REPO, '.claude', 'skills', skill);
    if (!existsSync(src)) die(`스킬이 없다: ${src}`);
    cpSync(src, join(dir, '.claude', 'skills', skill), { recursive: true });
  }

  if (descriptionOverride) {
    const p = join(dir, '.claude', 'skills', 'issue-create', 'SKILL.md');
    const text = readFileSync(p, 'utf8');
    const replaced = text.replace(/^description: .*$/m, `description: ${descriptionOverride}`);
    if (replaced === text) die('SKILL.md 에서 description 줄을 찾지 못했다.');
    writeFileSync(p, replaced);
  }
  return dir;
}

function readDescriptionArg(value) {
  if (!value) return null;
  if (!value.startsWith('@')) return value.trim();
  const p = resolve(value.slice(1));
  if (!existsSync(p)) die(`description 파일이 없다: ${p}`);
  const raw = readFileSync(p, 'utf8');
  // SKILL.md 를 통째로 넘겨도 되게 frontmatter 에서 뽑아낸다.
  const m = raw.match(/^description: (.*)$/m);
  return (m ? m[1] : raw).trim();
}

// 한 질의를 한 번 실행하고 어떤 스킬이 호출됐는지 돌려준다.
function runOnce(bin, sandbox, model, tools, query) {
  return new Promise((done) => {
    const child = spawn(bin, [
      '-p', query,
      '--model', model,
      '--setting-sources', 'project',
      '--strict-mcp-config',
      '--no-session-persistence',
      '--tools', tools,
      '--output-format', 'stream-json',
      '--verbose',
      // 픽스처에는 원격이 없어 gh 는 어차피 실패하지만, 실제 이슈가 만들어지는 사고를 원천 차단한다.
      '--disallowedTools', 'Bash(gh *)',
    ], {
      cwd: sandbox,
      env: { ...process.env, DISABLE_OMC: '1', OMC_SKIP_HOOKS: 'all' },
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let buf = '';
    const skills = [];
    let apiError = null;
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'assistant') {
          for (const c of ev.message?.content ?? []) {
            if (c.type === 'tool_use' && c.name === 'Skill' && c.input?.skill) skills.push(c.input.skill);
          }
          if (ev.error === 'authentication_failed') apiError = 'authentication_failed';
        } else if (ev.type === 'result' && ev.is_error) {
          apiError = ev.api_error_status ?? ev.terminal_reason ?? String(ev.result ?? 'error').slice(0, 80);
        }
      }
    });

    child.on('close', () => {
      clearTimeout(timer);
      done({ skills, error: skills.length === 0 ? apiError : null });
    });
  });
}

async function pool(items, size, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

function pct(n) {
  return n === null ? '  -  ' : n.toFixed(3);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('node evals/issue-create/run-trigger-eval.mjs [--set tuning|holdout] [--repeat 3] [--model sonnet] [--concurrency 3] [--tools default] [--skills all|core] [--description @file] [--out result.json]');
    return;
  }
  const file = SETS[opts.set];
  if (!file) die(`--set 은 ${Object.keys(SETS).join(' 또는 ')} 여야 한다.`);

  const queries = JSON.parse(readFileSync(join(HERE, file), 'utf8'));
  const description = readDescriptionArg(opts.description);
  const bin = findClaude();
  const skills = resolveSkills(opts.skills);
  const sandbox = buildSandbox(description, skills);

  const shownDesc = description ?? readFileSync(join(sandbox, '.claude/skills/issue-create/SKILL.md'), 'utf8').match(/^description: (.*)$/m)[1];

  console.log(`셋       ${opts.set} (${file}) — ${queries.length}문항`);
  console.log(`모델     ${opts.model} / 질의당 ${opts.repeat}회 / 도구 ${opts.tools}`);
  console.log(`픽스처   ${sandbox} (커밋 ${FIXTURE_COMMITS}개, 스킬 ${skills.length}개: ${skills.join(' · ')})`);
  console.log(`문구     ${description ? (opts.description.startsWith('@') ? opts.description : '인라인 오버라이드') : '현재 SKILL.md'}`);
  console.log('');

  const trials = [];
  for (const [qi, q] of queries.entries()) {
    for (let r = 0; r < opts.repeat; r += 1) trials.push({ qi, q, r });
  }

  let done = 0;
  const raw = await pool(trials, opts.concurrency, async (t) => {
    // 동시 실행이 많으면 API 가 간헐적으로 거절한다. 실패는 백오프 후 다시 시도한다.
    let res = await runOnce(bin, sandbox, opts.model, opts.tools, t.q.query);
    for (let attempt = 1; res.error && attempt <= 2; attempt += 1) {
      await new Promise((r) => setTimeout(r, attempt * 5000));
      res = await runOnce(bin, sandbox, opts.model, opts.tools, t.q.query);
    }
    done += 1;
    process.stderr.write(`\r  ${done}/${trials.length} 실행`);
    return { ...t, ...res };
  });
  process.stderr.write('\n\n');

  const byQuery = queries.map((q, qi) => {
    const mine = raw.filter((r) => r.qi === qi);
    const ok = mine.filter((r) => !r.error);
    const fired = ok.filter((r) => r.skills.includes('issue-create')).length;
    const others = {};
    for (const r of ok) {
      for (const s of r.skills) {
        if (s !== 'issue-create') others[s] = (others[s] ?? 0) + 1;
      }
    }
    return {
      query: q.query,
      should_trigger: q.should_trigger,
      trials: ok.length,
      errors: mine.length - ok.length,
      triggered: fired,
      rate: ok.length ? fired / ok.length : null,
      other_skills: others,
    };
  });

  const pos = byQuery.filter((q) => q.should_trigger);
  const neg = byQuery.filter((q) => !q.should_trigger);
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

  const posTrials = sum(pos, (q) => q.trials);
  const negTrials = sum(neg, (q) => q.trials);
  const recall = posTrials ? sum(pos, (q) => q.triggered) / posTrials : null;
  const specificity = negTrials ? 1 - sum(neg, (q) => q.triggered) / negTrials : null;
  const accuracy = (posTrials + negTrials)
    ? (sum(pos, (q) => q.triggered) + sum(neg, (q) => q.trials - q.triggered)) / (posTrials + negTrials)
    : null;

  const errorCount = sum(byQuery, (q) => q.errors);

  console.log('                  recall   specificity   accuracy');
  console.log(`${opts.set.padEnd(16)}  ${pct(recall)}      ${pct(specificity)}        ${pct(accuracy)}`);
  console.log('');
  console.log(`시행     발동해야 함 ${posTrials}회 / 아니어야 함 ${negTrials}회${errorCount ? ` (실행 실패 ${errorCount}회 제외)` : ''}`);

  if (errorCount) {
    const reasons = {};
    for (const r of raw) if (r.error) reasons[r.error] = (reasons[r.error] ?? 0) + 1;
    console.log('\n실행 실패 사유');
    for (const [reason, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}회  ${reason}`);
    }
  }

  const missed = pos.filter((q) => q.rate !== null && q.rate < 1);
  const wrong = neg.filter((q) => q.triggered > 0);
  if (missed.length) {
    console.log('\n놓친 질의 (발동해야 하는데 못 함)');
    for (const q of missed) console.log(`  ${q.triggered}/${q.trials}  ${q.query.slice(0, 70)}…`);
  }
  if (wrong.length) {
    console.log('\n오발동 질의 (발동하면 안 되는데 함)');
    for (const q of wrong) console.log(`  ${q.triggered}/${q.trials}  ${q.query.slice(0, 70)}…`);
  }

  const report = {
    set: opts.set,
    source: file,
    model: opts.model,
    tools: opts.tools,
    repeat: opts.repeat,
    fixture_commits: FIXTURE_COMMITS,
    competing_skills: skills,
    description: shownDesc,
    metrics: { recall, specificity, accuracy },
    trials: { positive: posTrials, negative: negTrials, errors: errorCount },
    queries: byQuery,
  };

  if (opts.out) {
    writeFileSync(resolve(opts.out), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\n결과     ${opts.out}`);
  }

  rmSync(sandbox, { recursive: true, force: true });
}

main().catch((err) => die(err.stack ?? String(err)));
