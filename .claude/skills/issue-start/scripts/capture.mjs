#!/usr/bin/env node
/**
 * capture.mjs — Playwright 로 화면을 찍어 webp 로 저장한다.
 *
 * 사용:
 *   node capture.mjs --url http://localhost:3000/foo --out .issue/59/evidence/before/list.webp
 *   node capture.mjs --url ... --out ... --width 1440 --height 900 --full --wait "text=주문 목록"
 *   node capture.mjs --url ... --out ... --box ".order-list .status" --box-label "상태 배지"
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
 * 바운딩 박스 (변경 구간 표시):
 *   --box <selector>       박스를 그릴 요소. 여러 번 지정 가능
 *   --box-label <text>     바로 앞 --box 의 라벨
 *   --box-rect x,y,w,h     셀렉터가 없을 때 문서 좌표(px)로 직접 지정
 *   --box-color <css>      기본 #ff2d55
 *   --box-pad <px>         기본 4
 *
 * 박스는 sharp 합성이 아니라 Playwright 의 DOM 오버레이로 그린다.
 * sharp 는 선택 의존성이라 없을 수 있지만 playwright 는 필수라서,
 * 오버레이로 그려야 webp 변환 폴백 경로에서도 박스가 남는다.
 * 덤으로 DPR 2 배율과 fullPage 좌표가 자동으로 맞는다.
 *
 * webp 변환은 sharp → cwebp → ffmpeg 순으로 사용 가능한 것을 쓴다.
 * 셋 다 없으면 png 로 저장하고 그 사실을 출력한다.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * --box 는 여러 번 올 수 있고 --box-label 은 바로 앞 --box 에 붙는다.
 * 그래서 일반 옵션과 달리 순서를 지켜 배열로 모은다.
 */
function parseArgs(argv) {
  const out = { boxes: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--full') out.full = true;
    else if (a === '--box') out.boxes.push({ selector: argv[++i] });
    else if (a === '--box-rect') {
      const [x, y, w, h] = String(argv[++i]).split(',').map(Number);
      out.boxes.push({ rect: { x, y, width: w, height: h } });
    } else if (a === '--box-label') {
      if (!out.boxes.length) {
        console.error('ERROR: --box-label 은 --box 또는 --box-rect 뒤에 와야 합니다.');
        process.exit(1);
      }
      out.boxes[out.boxes.length - 1].label = argv[++i];
    } else if (a.startsWith('--')) {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.url || !args.out) {
  console.error('Usage: node capture.mjs --url <url> --out <file.webp> [--width 1440] [--height 900] [--full] [--wait <selector>] [--delay 300] [--quality 82] [--storage <state.json>] [--box <selector> [--box-label <text>]]... [--box-rect x,y,w,h] [--box-color <css>] [--box-pad <px>]');
  process.exit(1);
}

const outPath = path.resolve(args.out);
mkdirSync(path.dirname(outPath), { recursive: true });
const pngPath = outPath.replace(/\.webp$/i, '') + '.tmp.png';

/**
 * ESM 의 import() 는 이 스크립트 위치를 기준으로 해석한다.
 * 스킬이 ~/.claude/skills 에 설치돼 있으면 프로젝트의 playwright 를 영영 못 찾으므로,
 * 실패하면 현재 작업 디렉터리 기준으로 한 번 더 찾는다.
 */
async function loadPlaywright() {
  // CJS 를 파일 URL 로 import 하면 네임드 export 가 default 아래로 들어간다.
  const normalize = (mod) => (mod?.chromium ? mod : mod?.default?.chromium ? mod.default : null);

  for (const name of ['playwright', '@playwright/test']) {
    try {
      const mod = normalize(await import(name));
      if (mod) return mod;
    } catch {
      /* 다음 후보 */
    }
  }
  const { createRequire } = await import('node:module');
  const { pathToFileURL } = await import('node:url');
  const requireFromCwd = createRequire(path.join(process.cwd(), 'package.json'));
  for (const name of ['playwright', '@playwright/test']) {
    try {
      const mod = normalize(await import(pathToFileURL(requireFromCwd.resolve(name)).href));
      if (mod) return mod;
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

const playwright = await loadPlaywright();
if (!playwright) {
  console.error('ERROR: playwright 를 찾지 못했습니다. 프로젝트 루트에서 `npm i -D playwright && npx playwright install chromium` 후 다시 실행하세요.');
  process.exit(1);
}
const { chromium } = playwright;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(args.width || 1440), height: Number(args.height || 900) },
  deviceScaleFactor: 2,
  ...(args.storage && existsSync(args.storage) ? { storageState: args.storage } : {}),
});
const page = await context.newPage();
let boxResult = { requested: args.boxes.length, drawn: 0, missed: [] };
try {
  await page.goto(args.url, { waitUntil: 'networkidle', timeout: 60_000 });
  if (args.wait) await page.waitForSelector(args.wait, { timeout: 30_000 });
  await page.waitForTimeout(Number(args.delay || 300));

  if (args.boxes.length) {
    boxResult = await page.evaluate(
      ({ boxes, color, pad }) => {
        const CONTAINER_ID = '__issue-capture-boxes__';
        document.getElementById(CONTAINER_ID)?.remove();
        const layer = document.createElement('div');
        layer.id = CONTAINER_ID;
        layer.style.cssText =
          'position:absolute;top:0;left:0;width:0;height:0;margin:0;padding:0;border:0;'
          + 'pointer-events:none;z-index:2147483647;';
        document.body.appendChild(layer);

        const result = { requested: boxes.length, drawn: 0, missed: [] };
        for (const box of boxes) {
          let rect = box.rect;
          if (!rect) {
            const el = document.querySelector(box.selector);
            if (!el) {
              // 셀렉터가 안 맞아도 캡처 자체는 성공시킨다. 호출부가 missed 를 보고 판단한다.
              result.missed.push(box.selector);
              continue;
            }
            const r = el.getBoundingClientRect();
            // 뷰포트 좌표 → 문서 좌표. fullPage 캡처에서도 위치가 맞아야 한다.
            rect = {
              x: r.left + window.scrollX,
              y: r.top + window.scrollY,
              width: r.width,
              height: r.height,
            };
          }
          const frame = document.createElement('div');
          frame.style.cssText = [
            'position:absolute',
            `left:${rect.x - pad}px`,
            `top:${rect.y - pad}px`,
            `width:${rect.width + pad * 2}px`,
            `height:${rect.height + pad * 2}px`,
            `border:3px solid ${color}`,
            'border-radius:3px',
            `box-shadow:0 0 0 1px rgba(255,255,255,.9), 0 0 12px ${color}66`,
            'box-sizing:border-box',
          ].join(';');
          layer.appendChild(frame);

          if (box.label) {
            const chip = document.createElement('div');
            chip.textContent = box.label;
            // 요소가 화면 최상단이면 라벨을 박스 안쪽으로 넣어 잘리지 않게 한다.
            const above = rect.y - pad >= 24;
            chip.style.cssText = [
              'position:absolute',
              `left:${rect.x - pad}px`,
              `top:${above ? rect.y - pad - 22 : rect.y + pad + 2}px`,
              `background:${color}`,
              'color:#fff',
              'font:600 12px/20px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
              'padding:0 8px',
              'border-radius:3px',
              'white-space:nowrap',
            ].join(';');
            layer.appendChild(chip);
          }
          result.drawn += 1;
        }
        return result;
      },
      {
        boxes: args.boxes,
        color: args['box-color'] || '#ff2d55',
        pad: Number(args['box-pad'] ?? 4),
      },
    );
    for (const sel of boxResult.missed) {
      console.error(`! 셀렉터를 찾지 못해 박스를 건너뜁니다: ${sel}`);
    }
  }

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
  console.log(JSON.stringify({
    ok: true, format: 'webp', file: path.relative(process.cwd(), outPath), boxes: boxResult,
  }, null, 2));
} else {
  const fallback = outPath.replace(/\.webp$/i, '.png');
  rmSync(fallback, { force: true });
  spawnSync('mv', [pngPath, fallback]);
  console.log(JSON.stringify({
    ok: true,
    format: 'png',
    file: path.relative(process.cwd(), fallback),
    boxes: boxResult,
    note: 'sharp/cwebp/ffmpeg 가 없어 webp 변환을 건너뛰었습니다. 증거 이미지는 webp 여야 하므로 변환 도구를 설치하세요.',
  }, null, 2));
}
