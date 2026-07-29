#!/usr/bin/env node
/**
 * verify.js — PNG validation for generated images
 * Checks: corruption, zero-size, wrong format, dimensions.
 *
 * Usage:
 *   node verify.js --input image.png [--verbose]
 */
import { readFile, stat } from "fs/promises";
import { realpathSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MIN_PNG_SIZE = 100;

/* ── PNG Parser ── */
async function parsePNG(filePath) {
  const buffer = await readFile(filePath);
  const result = {
    size: buffer.length,
    signatureValid: false,
    ihdrPresent: false,
    dimensions: null,
    chunks: [],
  };

  if (buffer.length < 8) return result;
  result.signatureValid = buffer.slice(0, 8).equals(PNG_SIGNATURE);
  if (!result.signatureValid) return result;

  let offset = 8;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString("ascii");
    result.chunks.push({ type, length, offset });

    if (type === "IHDR") {
      result.ihdrPresent = true;
      if (offset + 16 <= buffer.length) {
        result.dimensions = {
          width: buffer.readUInt32BE(offset + 8),
          height: buffer.readUInt32BE(offset + 12),
        };
      }
    }
    if (type === "IEND") break;
    offset += 12 + length;
  }

  return result;
}

/* ── Validation ── */
export async function validateImage(filePath) {
  const checks = {
    exists: false,
    nonZero: false,
    reasonableSize: false,
    pngSignature: false,
    ihdrPresent: false,
  };

  let pngInfo = null;
  let error = null;

  try {
    const s = await stat(filePath);
    checks.exists = true;
    checks.nonZero = s.size > 0;
    checks.reasonableSize = s.size >= MIN_PNG_SIZE;

    if (checks.reasonableSize) {
      pngInfo = await parsePNG(filePath);
      checks.pngSignature = pngInfo.signatureValid;
      checks.ihdrPresent = pngInfo.ihdrPresent;
    }
  } catch (e) {
    error = e.message;
  }

  const allPassed = Object.values(checks).every(Boolean);

  return {
    file: filePath,
    valid: allPassed,
    checks,
    png: pngInfo,
    error,
  };
}

/* ── CLI ── */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { input: "", verbose: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") parsed.input = args[i + 1] || "";
    else if (args[i] === "--verbose") parsed.verbose = true;
  }
  if (!parsed.input) {
    console.error("Usage: node verify.js --input <image-path> [--verbose]");
    process.exit(1);
  }
  return parsed;
}

async function main() {
  const args = parseArgs();
  console.log(`[verify] Checking: ${args.input}`);
  const result = await validateImage(args.input);

  if (args.verbose) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const status = result.valid ? "✅ VALID" : "❌ INVALID";
    console.log(`[verify] ${status}: ${args.input}`);
    if (!result.valid) {
      for (const [check, passed] of Object.entries(result.checks)) {
        if (!passed) console.log(`       - failed: ${check}`);
      }
    }
    if (result.png?.dimensions) {
      console.log(`       dimensions: ${result.png.dimensions.width}x${result.png.dimensions.height}`);
    }
  }

  process.exit(result.valid ? 0 : 1);
}

/**
 * 이 파일이 직접 실행된 진입점인지 판별한다.
 *
 * 경로 문자열끼리 비교한다. `file://` 를 손으로 이어붙이면 공백·특수문자가 든 경로에서
 * 퍼센트 인코딩이 빠져 어긋나므로 fileURLToPath 를 쓴다.
 *
 * 심볼릭 링크로 설치된 스킬에서는 두 값의 기준이 다르다. Node ESM 로더는 모듈 URL 을
 * realpath 로 정규화하는 반면 `process.argv[1]` 은 링크 경로 그대로다. 그래서 **양쪽 모두**
 * realpath 로 풀어 비교한다. 한쪽만 풀면 `--preserve-symlinks-main` 으로 실행할 때
 * 반대 방향으로 다시 어긋난다.
 */
function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const here = fileURLToPath(metaUrl);
  const resolved = resolve(entry);
  if (here === resolved) return true;   // 일반 실행 — 파일시스템 접근 없이 끝난다
  try {
    return realpathSync(here) === realpathSync(resolved);
  } catch {
    // 같은 경로였다면 위에서 이미 true 다. 여기서 실패했다면 진입점이 아니다.
    return false;
  }
}

const isMain = isMainModule(import.meta.url);
if (isMain) {
  main().catch(e => { console.error("[verify] Error:", e.message); process.exit(1); });
}
