#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

function loadPackage(name) {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire(name);
  } catch {
    // Continue and try npx-provided package roots below.
  }

  for (const entry of (process.env.PATH || "").split(":")) {
    if (!entry.endsWith("node_modules/.bin")) continue;
    const packageRoot = join(entry.slice(0, -"node_modules/.bin".length), "node_modules", name);
    const packageJson = join(packageRoot, "package.json");
    if (!existsSync(packageJson)) continue;
    return createRequire(packageJson)(name);
  }

  throw new Error(
    `${name} package not found. Run through: npx --yes -p pixelmatch -p pngjs node .codex/skills/make-design-md/scripts/compare_design_screenshots.mjs <config.json>`,
  );
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { help: true };
  }
  const args = { config: argv[0], out: null };
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === "--out") {
      args.out = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--help" || argv[index] === "-h") {
      args.help = true;
    }
  }
  return args;
}

function usage() {
  process.stdout.write(`Compare baseline and candidate DESIGN.md reproduction screenshots.

Usage:
  npx --yes -p pixelmatch -p pngjs node compare_design_screenshots.mjs <visual-verification.config.json> [--out visual-diff-report.json]

Config comparisons accept:
  baseline: "path/to/source.png"
  candidate: "path/to/reproduction.png"
  thresholds: { "maxDiffRatio": 0.01, "maxDiffPixels": 2500 }
`);
}

function readPng(file, PNG) {
  return PNG.sync.read(readFileSync(file));
}

function patternToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "(.*)");
  return new RegExp(`^${escaped}$`);
}

function expandPattern(pattern, root) {
  if (!pattern.includes("*")) return existsSync(resolve(root, pattern)) ? [{ path: pattern, wildcard: "" }] : [];
  const slash = pattern.lastIndexOf("/");
  const dir = slash >= 0 ? pattern.slice(0, slash) : ".";
  const namePattern = slash >= 0 ? pattern.slice(slash + 1) : pattern;
  const absoluteDir = resolve(root, dir);
  if (!existsSync(absoluteDir)) return [];
  const regex = patternToRegex(namePattern);
  return readdirSync(absoluteDir)
    .map((name) => {
      const match = name.match(regex);
      return match ? { path: join(dir, name), wildcard: match[1] || "" } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function expandComparisons(entries, root) {
  const expanded = [];
  for (const entry of entries) {
    if (entry.baseline || entry.baselinePath) {
      expanded.push(entry);
      continue;
    }
    if (!entry.baselinePattern || !entry.candidatePattern) continue;
    for (const baseline of expandPattern(entry.baselinePattern, root)) {
      expanded.push({
        ...entry,
        baseline: baseline.path,
        candidate: entry.candidatePattern.replace("*", baseline.wildcard),
      });
    }
  }
  return expanded;
}

function comparePair(entry, root, PNG, pixelmatch) {
  const baseline = resolve(root, entry.baseline || entry.baselinePath || "");
  const candidate = resolve(root, entry.candidate || entry.candidatePath || "");
  const thresholds = entry.thresholds || {};
  const maxDiffRatio = Number(thresholds.maxDiffRatio ?? 0.01);
  const maxDiffPixels = Number(thresholds.maxDiffPixels ?? 2500);

  if (!existsSync(baseline) || !existsSync(candidate)) {
    return {
      ...entry,
      status: "missing",
      baseline,
      candidate,
      reason: "baseline or candidate screenshot is missing",
      repairTargets: entry.repairTargets || ["comparison fixtures", "capture settings"],
    };
  }

  const baselinePng = readPng(baseline, PNG);
  const candidatePng = readPng(candidate, PNG);
  if (baselinePng.width !== candidatePng.width || baselinePng.height !== candidatePng.height) {
    return {
      ...entry,
      status: "fail",
      baseline,
      candidate,
      reason: `dimension mismatch: ${baselinePng.width}x${baselinePng.height} vs ${candidatePng.width}x${candidatePng.height}`,
      repairTargets: entry.repairTargets || ["comparison fixtures", "capture settings", "DESIGN.md"],
    };
  }

  const diff = new PNG({ width: baselinePng.width, height: baselinePng.height });
  const diffPixels = pixelmatch(
    baselinePng.data,
    candidatePng.data,
    diff.data,
    baselinePng.width,
    baselinePng.height,
    { threshold: Number(thresholds.pixelmatchThreshold ?? 0.1) },
  );
  const totalPixels = baselinePng.width * baselinePng.height;
  const diffRatio = diffPixels / totalPixels;
  const status = diffPixels <= maxDiffPixels && diffRatio <= maxDiffRatio ? "pass" : "fail";

  const diffPath = entry.diffPath ? resolve(root, entry.diffPath) : null;
  if (diffPath) {
    mkdirSync(dirname(diffPath), { recursive: true });
    writeFileSync(diffPath, PNG.sync.write(diff));
  }

  return {
    ...entry,
    status,
    baseline,
    candidate,
    diffPath,
    metrics: {
      width: baselinePng.width,
      height: baselinePng.height,
      totalPixels,
      diffPixels,
      diffRatio,
      maxDiffPixels,
      maxDiffRatio,
    },
    repairTargets: status === "fail"
      ? entry.repairTargets || ["DESIGN.md", "analysis prompts", "export templates", "comparison fixtures"]
      : [],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.config) {
    usage();
    return args.help ? 0 : 2;
  }
  const configPath = resolve(args.config);
  const root = dirname(configPath);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const comparisons = expandComparisons(config.comparisons || [], root);
  if (!comparisons.length) {
    const output = {
      status: "fail",
      config: configPath,
      error: "No concrete comparison entries found. Add baseline and candidate paths before running the pixel gate.",
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return 2;
  }

  const { PNG } = loadPackage("pngjs");
  const pixelmatchModule = loadPackage("pixelmatch");
  const pixelmatch = pixelmatchModule.default || pixelmatchModule;
  const results = comparisons.map((entry) => comparePair(entry, root, PNG, pixelmatch));
  const failed = results.filter((result) => result.status !== "pass");
  const output = {
    status: failed.length ? "fail" : "pass",
    config: configPath,
    summary: {
      comparisons: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
    },
    results,
  };

  if (args.out) {
    const outPath = resolve(args.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return failed.length ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`${error.stack || error.message || String(error)}\n`);
    process.exitCode = 1;
  });
