#!/usr/bin/env node
/**
 * capture.mjs — Playwright 로 화면을 찍어 webp 로 저장한다.
 *
 * 사용:
 *   node capture.mjs --url http://localhost:3000/foo --out .issue-evidence/59/before/list.webp
 *   node capture.mjs --url ... --out ... --width 1440 --height 900 --full --wait "text=주문 목록"
 *
 * 옵션:
 *   --url <url>       필수. 캡처 대상 URL
 *   --out <file>      필수. .webp 경로 (부모 디렉터리는 자동 생성)
 *   --width/--height  뷰포트 (기본 1440x900)
 *   --full            전체 페이지 캡처
 *   --wait <sel>      해당 셀렉터가 보일 때까지 대기
 *   --delay <ms>      추가 대기 (기본 300)
 *   --quality <n>     webp 품질 (기본 82)
 *   --storage <file>  Playwright storageState JSON (로그인 상태 재사용)
 *
 * webp 변환은 sharp → cwebp → ffmpeg 순으로 사용 가능한 것을 쓴다.
 * 셋 다 없으면 png 로 저장하고 그 사실을 출력한다.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--full') out.full = true;
    else if (a.startsWith('--')) {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.url || !args.out) {
  console.error('Usage: node capture.mjs --url <url> --out <file.webp> [--width 1440] [--height 900] [--full] [--wait <selector>] [--delay 300] [--quality 82] [--storage <state.json>]');
  process.exit(1);
}

const outPath = path.resolve(args.out);
mkdirSync(path.dirname(outPath), { recursive: true });
const pngPath = outPath.replace(/\.webp$/i, '') + '.tmp.png';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    console.error('ERROR: playwright 를 찾지 못했습니다. `npm i -D playwright && npx playwright install chromium` 후 다시 실행하세요.');
    process.exit(1);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(args.width || 1440), height: Number(args.height || 900) },
  deviceScaleFactor: 2,
  ...(args.storage && existsSync(args.storage) ? { storageState: args.storage } : {}),
});
const page = await context.newPage();
try {
  await page.goto(args.url, { waitUntil: 'networkidle', timeout: 60_000 });
  if (args.wait) await page.waitForSelector(args.wait, { timeout: 30_000 });
  await page.waitForTimeout(Number(args.delay || 300));
  await page.screenshot({ path: pngPath, fullPage: Boolean(args.full) });
} finally {
  await browser.close();
}

const quality = String(args.quality || 82);

function tryRun(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
  return r.status === 0;
}

let converted = false;
try {
  const sharp = (await import('sharp')).default;
  await sharp(pngPath).webp({ quality: Number(quality) }).toFile(outPath);
  converted = true;
} catch {
  if (tryRun('cwebp', ['-quiet', '-q', quality, pngPath, '-o', outPath])) converted = true;
  else if (tryRun('ffmpeg', ['-y', '-loglevel', 'error', '-i', pngPath, '-quality', quality, outPath])) converted = true;
}

if (converted) {
  rmSync(pngPath, { force: true });
  console.log(JSON.stringify({ ok: true, format: 'webp', file: path.relative(process.cwd(), outPath) }, null, 2));
} else {
  const fallback = outPath.replace(/\.webp$/i, '.png');
  rmSync(fallback, { force: true });
  spawnSync('mv', [pngPath, fallback]);
  console.log(JSON.stringify({
    ok: true,
    format: 'png',
    file: path.relative(process.cwd(), fallback),
    note: 'sharp/cwebp/ffmpeg 가 없어 webp 변환을 건너뛰었습니다.',
  }, null, 2));
}
