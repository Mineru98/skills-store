#!/usr/bin/env node
/**
 * verify.js — PNG validation for generated images
 * Checks: corruption, zero-size, wrong format, dimensions.
 *
 * Usage:
 *   node verify.js --input image.png [--verbose]
 */
import { readFile, stat } from "fs/promises";
import { dirname, join } from "path";
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

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch(e => { console.error("[verify] Error:", e.message); process.exit(1); });
}
