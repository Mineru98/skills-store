#!/usr/bin/env node
/**
 * tmux-capture.mjs — 같은 프로젝트에서 돌고 있는 tmux pane 들의 내용을 한 번에 걷어온다.
 *
 * 서브커맨드
 *   list                   스코프에 걸린 pane 목록만 (내용 없이) JSON 으로
 *   capture                pane 목록 + 각 pane 의 최근 출력 tail 을 JSON 으로
 *
 * 공통 옵션
 *   --scope repo|all       repo(기본): 현재 저장소와 같은 git common-dir 를 쓰는 pane 만.
 *                          워크트리는 경로가 달라도 같은 프로젝트로 묶인다.
 *   --cwd <path>           기준 저장소 경로 (기본: process.cwd())
 *   --target <조각>        세션 이름 부분일치 필터. 여러 번 줄 수 있다
 *   --include-self         자기 자신이 떠 있는 pane 도 포함 (기본은 제외)
 *   --lines <n>            capture 할 마지막 줄 수 (기본 120)
 *   --text                 JSON 대신 사람이 읽는 텍스트로 출력
 *
 * 이 스크립트는 판단하지 않는다. 사실 수집만 한다.
 * 각 세션이 무슨 상태인지, 무엇을 전파해야 하는지는 SKILL.md 의 흐름이 정한다.
 *
 * 종료 코드
 *   0 정상 / 1 사용법·환경 오류 / 2 스코프에 걸린 pane 이 없음
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const PANE_FIELDS = [
  'session_name',
  'window_index',
  'pane_index',
  'pane_id',
  'pane_current_path',
  'pane_current_command',
  'pane_title',
  'window_name',
  'pane_active',
  'session_attached',
];

export function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        code: err?.code ?? 0,
        stdout: (stdout ?? '').toString(),
        stderr: (stderr ?? '').toString(),
      });
    });
  });
}

export async function requireTmux() {
  const probe = await run('tmux', ['-V']);
  if (!probe.ok) {
    throw new UsageError('tmux 를 실행할 수 없다. tmux 가 설치되어 있고 PATH 에 있는지 확인하라.');
  }
  return probe.stdout.trim();
}

export class UsageError extends Error {}

/** pane 의 cwd 로 git common-dir 를 구한다. 같은 저장소의 워크트리는 같은 값을 돌려준다. */
const repoKeyCache = new Map();
async function repoKeyOf(cwd) {
  if (!cwd) return null;
  if (repoKeyCache.has(cwd)) return repoKeyCache.get(cwd);
  const p = (async () => {
    const r = await run('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir']);
    if (!r.ok) return null;
    const dir = r.stdout.trim();
    return dir ? path.resolve(dir) : null;
  })();
  repoKeyCache.set(cwd, p);
  return p;
}

const branchCache = new Map();
async function branchOf(cwd) {
  if (!cwd) return null;
  if (branchCache.has(cwd)) return branchCache.get(cwd);
  const p = (async () => {
    const r = await run('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD']);
    return r.ok ? r.stdout.trim() || null : null;
  })();
  branchCache.set(cwd, p);
  return p;
}

const dirtyCache = new Map();
async function dirtyCountOf(cwd) {
  if (!cwd) return null;
  if (dirtyCache.has(cwd)) return dirtyCache.get(cwd);
  const p = (async () => {
    const r = await run('git', ['-C', cwd, 'status', '--porcelain']);
    if (!r.ok) return null;
    return r.stdout.split('\n').filter((l) => l.trim()).length;
  })();
  dirtyCache.set(cwd, p);
  return p;
}

/** 스코프에 걸린 pane 목록. 내용은 담지 않는다. */
export async function listPanes(opts = {}) {
  const scope = opts.scope ?? 'repo';
  const base = path.resolve(opts.cwd ?? process.cwd());
  const targets = opts.targets ?? [];
  const includeSelf = opts.includeSelf ?? false;
  const selfPane = process.env.TMUX_PANE ?? null;

  await requireTmux();

  const fmt = PANE_FIELDS.map((f) => `#{${f}}`).join('\t');
  const listed = await run('tmux', ['list-panes', '-a', '-F', fmt]);
  if (!listed.ok) {
    // 서버가 안 떠 있으면 tmux 가 실패한다. pane 0 개와 같은 상황으로 다룬다.
    return { repoKey: await repoKeyOf(base), repoRoot: base, selfPane, panes: [] };
  }

  const rows = listed.stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter(Boolean)
    .map((line) => {
      const cols = line.split('\t');
      const rec = {};
      PANE_FIELDS.forEach((f, i) => {
        rec[f] = cols[i] ?? '';
      });
      return rec;
    });

  const baseRepoKey = await repoKeyOf(base);

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const cwd = r.pane_current_path || null;
      const [repoKey, branch, dirty] = await Promise.all([
        scope === 'repo' ? repoKeyOf(cwd) : repoKeyOf(cwd),
        branchOf(cwd),
        dirtyCountOf(cwd),
      ]);
      return {
        session: r.session_name,
        window: Number(r.window_index),
        pane: Number(r.pane_index),
        paneId: r.pane_id,
        target: `${r.session_name}:${r.window_index}.${r.pane_index}`,
        cwd,
        command: r.pane_current_command,
        title: r.pane_title,
        windowName: r.window_name,
        active: r.pane_active === '1',
        attached: r.session_attached !== '0',
        repoKey,
        branch,
        dirtyFiles: dirty,
        isSelf: selfPane != null && r.pane_id === selfPane,
      };
    }),
  );

  let panes = enriched;
  if (scope === 'repo') {
    if (!baseRepoKey) {
      throw new UsageError(`git 저장소가 아니다: ${base} (--scope all 로 전체 pane 을 볼 수 있다)`);
    }
    panes = panes.filter((p) => p.repoKey === baseRepoKey);
  }
  if (targets.length) {
    panes = panes.filter((p) => targets.some((t) => p.session.includes(t) || p.target.includes(t) || p.paneId === t));
  }
  if (!includeSelf) {
    panes = panes.filter((p) => !p.isSelf);
  }

  panes.sort((a, b) => a.session.localeCompare(b.session) || a.window - b.window || a.pane - b.pane);
  return { repoKey: baseRepoKey, repoRoot: base, selfPane, panes };
}

/** pane 들의 최근 출력을 병렬로 걷어온다. */
export async function capturePanes(opts = {}) {
  const lines = Number(opts.lines ?? 120);
  const listing = await listPanes(opts);
  const captured = await Promise.all(
    listing.panes.map(async (p) => {
      const r = await run('tmux', ['capture-pane', '-p', '-J', '-t', p.paneId, '-S', `-${lines}`]);
      if (!r.ok) return { ...p, tail: null, captureError: r.stderr.trim() || `exit ${r.code}` };
      // -S 는 히스토리 시작점만 옮기므로 화면 높이만큼 더 딸려온다. 마지막 lines 줄로 자른다.
      const all = r.stdout.replace(/\s+$/, '').split('\n');
      const text = all.slice(Math.max(0, all.length - lines)).join('\n');
      return { ...p, tail: text, tailLines: text ? text.split('\n').length : 0 };
    }),
  );
  return { ...listing, panes: captured, lines };
}

function renderText(result, { withTail }) {
  const out = [];
  out.push(`repo: ${result.repoRoot}`);
  out.push(`panes: ${result.panes.length}`);
  for (const p of result.panes) {
    out.push('');
    out.push(`--- ${p.target} (${p.paneId}) ---`);
    out.push(`session : ${p.session}`);
    out.push(`cwd     : ${p.cwd}`);
    out.push(`branch  : ${p.branch ?? '-'}  dirty=${p.dirtyFiles ?? '-'}`);
    out.push(`command : ${p.command}  attached=${p.attached}`);
    if (withTail) {
      out.push('tail    :');
      out.push(p.tail == null ? `  <capture 실패: ${p.captureError}>` : p.tail.split('\n').map((l) => `  ${l}`).join('\n'));
    }
  }
  return out.join('\n');
}

export function parseArgs(argv) {
  const opts = { targets: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v == null) throw new UsageError(`${a} 에 값이 필요하다`);
      i += 1;
      return v;
    };
    if (a === '--scope') opts.scope = next();
    else if (a === '--cwd') opts.cwd = next();
    else if (a === '--target') opts.targets.push(next());
    else if (a === '--lines') opts.lines = next();
    else if (a === '--include-self') opts.includeSelf = true;
    else if (a === '--text') opts.text = true;
    else if (a === '--json') opts.text = false;
    else throw new UsageError(`모르는 옵션: ${a}`);
  }
  if (opts.scope && !['repo', 'all'].includes(opts.scope)) {
    throw new UsageError(`--scope 는 repo 또는 all 이다: ${opts.scope}`);
  }
  return opts;
}

async function main(argv) {
  const sub = argv[0];
  if (!sub || ['-h', '--help', 'help'].includes(sub)) {
    process.stdout.write(
      [
        '사용법:',
        '  node tmux-capture.mjs list    [--scope repo|all] [--cwd <path>] [--target <조각>] [--include-self] [--text]',
        '  node tmux-capture.mjs capture [--lines <n>] [위와 동일한 옵션]',
        '',
      ].join('\n'),
    );
    return 0;
  }
  if (!['list', 'capture'].includes(sub)) throw new UsageError(`모르는 서브커맨드: ${sub}`);

  const opts = parseArgs(argv.slice(1));
  const result = sub === 'capture' ? await capturePanes(opts) : await listPanes(opts);
  const payload = {
    generatedAt: new Date().toISOString(),
    scope: opts.scope ?? 'repo',
    repoRoot: result.repoRoot,
    repoKey: result.repoKey,
    selfPane: result.selfPane,
    count: result.panes.length,
    ...(sub === 'capture' ? { lines: result.lines } : {}),
    panes: result.panes,
  };

  if (opts.text) process.stdout.write(`${renderText(result, { withTail: sub === 'capture' })}\n`);
  else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

  return result.panes.length ? 0 : 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`${err instanceof UsageError ? err.message : (err?.stack ?? String(err))}\n`);
      process.exit(1);
    });
}
