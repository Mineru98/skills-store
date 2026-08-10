#!/usr/bin/env node
/**
 * tmux-send.mjs — 같은 프로젝트의 tmux pane 에 메시지를 넣는다.
 *
 * 서브커맨드
 *   send --target <t> --message <m>    한 pane 에 보낸다
 *   broadcast --message <m>            스코프에 걸린 모든 pane 에 같은 메시지를 보낸다
 *
 * 대상(--target) 은 다음 중 아무거나 된다.
 *   %12                     pane id
 *   mysession:0.1           tmux 표준 target
 *   mysession               세션 이름 (그 세션의 활성 pane)
 *   sess-조각               세션 이름 부분일치 — 후보가 둘 이상이면 실패한다
 *
 * 옵션
 *   --message <text>        보낼 본문. 생략하면 --message-file 또는 stdin 에서 읽는다
 *   --message-file <path>   본문을 파일에서 읽는다
 *   --raw                   개행을 그대로 보낸다 (기본은 한 줄로 접는다)
 *   --no-enter              본문만 넣고 Enter 는 보내지 않는다
 *   --delay <ms>            본문과 Enter 사이 지연 (기본 150)
 *   --scope repo|all        대상 후보 범위 (기본 repo — 현재 저장소의 pane 만)
 *   --cwd <path>            기준 저장소 경로
 *   --allow-outside         스코프 밖 pane 에도 보내는 것을 허용
 *   --allow-self            자기 자신이 떠 있는 pane 에도 보내는 것을 허용
 *   --exclude <조각>        broadcast 에서 제외할 세션 조각 (여러 번 가능)
 *   --dry-run               실제로 보내지 않고 무엇을 어디로 보낼지만 출력
 *
 * 대화형 TUI(Claude Code, Codex CLI 등) 에 안전하도록 본문은 send-keys -l 로 리터럴 입력하고
 * Enter 는 지연 뒤 별도로 보낸다. 개행이 곧 제출인 TUI 에서 여러 줄 메시지가 중간에
 * 잘려 제출되는 사고를 막기 위해, 기본값은 개행을 공백으로 접는 것이다.
 *
 * 종료 코드
 *   0 정상 / 1 사용법·환경 오류 / 2 대상을 찾지 못함 / 3 일부 전송 실패
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { UsageError, listPanes, run } from './tmux-capture.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 개행이 제출로 먹히는 TUI 를 위해 본문을 한 줄로 접는다. */
export function foldMessage(text) {
  return text.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

export function resolveTarget(panes, target) {
  const exactId = panes.find((p) => p.paneId === target);
  if (exactId) return { pane: exactId };

  const exactTarget = panes.find((p) => p.target === target);
  if (exactTarget) return { pane: exactTarget };

  const sessionExact = panes.filter((p) => p.session === target);
  if (sessionExact.length === 1) return { pane: sessionExact[0] };
  if (sessionExact.length > 1) {
    const active = sessionExact.find((p) => p.active);
    if (active) return { pane: active };
    return { candidates: sessionExact };
  }

  const partial = panes.filter((p) => p.session.includes(target) || p.target.includes(target));
  if (partial.length === 1) return { pane: partial[0] };
  if (partial.length > 1) {
    const activeOnes = partial.filter((p) => p.active);
    if (activeOnes.length === 1) return { pane: activeOnes[0] };
    return { candidates: partial };
  }
  return { candidates: [] };
}

export async function sendToPane(pane, message, { raw = false, enter = true, delay = 150, dryRun = false } = {}) {
  const body = raw ? message : foldMessage(message);
  if (!body) throw new UsageError('보낼 본문이 비어 있다');

  if (dryRun) {
    return { target: pane.target, paneId: pane.paneId, session: pane.session, sent: false, dryRun: true, body };
  }

  const typed = await run('tmux', ['send-keys', '-t', pane.paneId, '-l', '--', body]);
  if (!typed.ok) {
    return { target: pane.target, paneId: pane.paneId, session: pane.session, sent: false, error: typed.stderr.trim() || `exit ${typed.code}` };
  }
  if (enter) {
    await sleep(delay);
    const cr = await run('tmux', ['send-keys', '-t', pane.paneId, 'Enter']);
    if (!cr.ok) {
      return { target: pane.target, paneId: pane.paneId, session: pane.session, sent: true, enter: false, error: cr.stderr.trim() || `exit ${cr.code}` };
    }
  }
  return { target: pane.target, paneId: pane.paneId, session: pane.session, sent: true, enter, body };
}

function readMessage(opts) {
  if (opts.message != null) return opts.message;
  if (opts.messageFile) return readFileSync(opts.messageFile, 'utf8');
  if (!process.stdin.isTTY) {
    try {
      return readFileSync(0, 'utf8');
    } catch {
      /* stdin 없음 */
    }
  }
  throw new UsageError('--message, --message-file, stdin 중 하나로 본문을 줘야 한다');
}

export function parseArgs(argv) {
  const opts = { excludes: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v == null) throw new UsageError(`${a} 에 값이 필요하다`);
      i += 1;
      return v;
    };
    if (a === '--target') opts.target = next();
    else if (a === '--message') opts.message = next();
    else if (a === '--message-file') opts.messageFile = next();
    else if (a === '--scope') opts.scope = next();
    else if (a === '--cwd') opts.cwd = next();
    else if (a === '--delay') opts.delay = Number(next());
    else if (a === '--exclude') opts.excludes.push(next());
    else if (a === '--raw') opts.raw = true;
    else if (a === '--no-enter') opts.enter = false;
    else if (a === '--allow-outside') opts.allowOutside = true;
    else if (a === '--allow-self') opts.allowSelf = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else throw new UsageError(`모르는 옵션: ${a}`);
  }
  if (opts.scope && !['repo', 'all'].includes(opts.scope)) {
    throw new UsageError(`--scope 는 repo 또는 all 이다: ${opts.scope}`);
  }
  if (opts.delay != null && !Number.isFinite(opts.delay)) throw new UsageError('--delay 는 숫자여야 한다');
  return opts;
}

async function candidatePanes(opts) {
  const scope = opts.allowOutside ? 'all' : (opts.scope ?? 'repo');
  return listPanes({
    scope,
    cwd: opts.cwd,
    includeSelf: opts.allowSelf === true,
    targets: [],
  });
}

async function cmdSend(opts) {
  if (!opts.target) throw new UsageError('--target 이 필요하다');
  const message = readMessage(opts);
  const { panes } = await candidatePanes(opts);
  const hit = resolveTarget(panes, opts.target);

  if (!hit.pane) {
    const lines = [`대상을 특정하지 못했다: ${opts.target}`];
    if (hit.candidates.length) {
      lines.push('후보:');
      hit.candidates.forEach((p) => lines.push(`  ${p.target}  ${p.paneId}  ${p.session}  (${p.command})`));
      lines.push('pane id(%n) 또는 session:window.pane 으로 정확히 지정하라.');
    } else {
      lines.push('스코프 안에 일치하는 pane 이 없다. --scope all 또는 --allow-outside 를 검토하라.');
    }
    process.stderr.write(`${lines.join('\n')}\n`);
    return 2;
  }

  const res = await sendToPane(hit.pane, message, {
    raw: opts.raw,
    enter: opts.enter !== false,
    delay: opts.delay ?? 150,
    dryRun: opts.dryRun,
  });
  process.stdout.write(`${JSON.stringify({ results: [res] }, null, 2)}\n`);
  return res.sent || res.dryRun ? 0 : 3;
}

async function cmdBroadcast(opts) {
  const message = readMessage(opts);
  const { panes } = await candidatePanes(opts);
  const targets = panes.filter((p) => !opts.excludes.some((x) => p.session.includes(x) || p.target.includes(x)));

  if (!targets.length) {
    process.stderr.write('스코프 안에 보낼 pane 이 없다.\n');
    return 2;
  }

  const results = [];
  for (const pane of targets) {
    // 순차 전송이다. 같은 tmux 서버에 동시 send-keys 를 밀어넣으면 입력이 섞일 수 있다.
    results.push(
      await sendToPane(pane, message, {
        raw: opts.raw,
        enter: opts.enter !== false,
        delay: opts.delay ?? 150,
        dryRun: opts.dryRun,
      }),
    );
  }
  process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
  return results.every((r) => r.sent || r.dryRun) ? 0 : 3;
}

async function main(argv) {
  const sub = argv[0];
  if (!sub || ['-h', '--help', 'help'].includes(sub)) {
    process.stdout.write(
      [
        '사용법:',
        '  node tmux-send.mjs send --target <pane|session> --message <text> [--raw] [--no-enter] [--delay ms] [--dry-run]',
        '  node tmux-send.mjs broadcast --message <text> [--exclude <조각>] [--dry-run]',
        '',
        '  공통: [--scope repo|all] [--cwd <path>] [--allow-outside] [--allow-self] [--message-file <path>]',
        '',
      ].join('\n'),
    );
    return 0;
  }
  const opts = parseArgs(argv.slice(1));
  if (sub === 'send') return cmdSend(opts);
  if (sub === 'broadcast') return cmdBroadcast(opts);
  throw new UsageError(`모르는 서브커맨드: ${sub}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`${err instanceof UsageError ? err.message : (err?.stack ?? String(err))}\n`);
      process.exit(1);
    });
}
