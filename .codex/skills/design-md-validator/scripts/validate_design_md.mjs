#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SKIP_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".venv",
  "venv",
]);

function printJson(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {
    files: [],
    discover: null,
    diffBefore: null,
    strictWarnings: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--discover") {
      args.discover = argv[index + 1];
      index += 1;
    } else if (arg === "--diff-before") {
      args.diffBefore = argv[index + 1];
      index += 1;
    } else if (arg === "--strict-warnings") {
      args.strictWarnings = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      args.files.push(arg);
    }
  }

  return args;
}

function usage() {
  process.stdout.write(`Validate DESIGN.md files with npx @google/design.md.

Usage:
  validate_design_md.mjs [DESIGN.md ...]
  validate_design_md.mjs --discover .
  validate_design_md.mjs DESIGN.md --diff-before DESIGN.old.md

Options:
  --discover ROOT      Recursively find files named DESIGN.md under ROOT.
  --diff-before FILE   Compare FILE to the first target file.
  --strict-warnings    Exit nonzero when warnings are present.
  -h, --help           Show this help.
`);
}

function runDesignCli(args) {
  const completed = spawnSync("npx", ["--yes", "@google/design.md", ...args], {
    encoding: "utf8",
  });
  const stdout = (completed.stdout || "").trim();
  let data = {};

  try {
    data = stdout ? JSON.parse(stdout) : {};
  } catch {
    data = {
      parse_error: "Unable to parse @google/design.md output as JSON.",
      stdout,
    };
  }

  return {
    code: completed.status ?? 1,
    data,
    stderr: (completed.stderr || "").trim(),
    error: completed.error ? String(completed.error.message || completed.error) : "",
  };
}

function discoverDesignFiles(root) {
  const found = [];

  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;

      const path = join(dir, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        walk(path);
      } else if (stats.isFile() && entry.toLowerCase() === "design.md") {
        found.push(path);
      }
    }
  }

  walk(root);
  return found.sort();
}

function lintFile(file, strictWarnings) {
  const { code, data, stderr, error } = runDesignCli([
    "lint",
    "--format",
    "json",
    file,
  ]);
  const summary = data.summary || {};
  const errors = Number(summary.errors || 0);
  const warnings = Number(summary.warnings || 0);

  let status = "pass";
  if (errors || data.parse_error || (code !== 0 && !data.summary)) {
    status = "fail";
  } else if (strictWarnings && warnings) {
    status = "fail";
  } else if (warnings) {
    status = "warn";
  }

  return {
    file,
    status,
    cli_exit_code: code,
    summary,
    findings: data.findings || [],
    stderr,
    ...(error ? { error } : {}),
  };
}

function diffFiles(before, after) {
  const { code, data, stderr, error } = runDesignCli([
    "diff",
    "--format",
    "json",
    before,
    after,
  ]);
  return {
    ...data,
    cli_exit_code: code,
    ...(stderr ? { stderr } : {}),
    ...(error ? { error } : {}),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return 0;
  }

  let targets = [];
  if (args.discover) {
    const root = resolve(args.discover);
    if (!existsSync(root)) {
      printJson({ status: "fail", error: `Discover root does not exist: ${root}` });
      return 2;
    }
    targets = discoverDesignFiles(root);
  } else if (args.files.length) {
    targets = args.files;
  } else if (existsSync("DESIGN.md")) {
    targets = ["DESIGN.md"];
  } else {
    printJson({
      status: "fail",
      error: "No DESIGN.md target found. Pass a file path or --discover ROOT.",
    });
    return 2;
  }

  if (!targets.length) {
    printJson({ status: "fail", error: "No DESIGN.md files found." });
    return 2;
  }

  const results = targets.map((target) => lintFile(target, args.strictWarnings));
  const output = {
    status: "pass",
    checked: results.length,
    results,
  };

  if (args.diffBefore) {
    if (targets.length !== 1) {
      printJson({
        ...output,
        status: "fail",
        error: "--diff-before requires exactly one target file.",
      });
      return 2;
    }
    output.diff = diffFiles(args.diffBefore, targets[0]);
  }

  const hasFailures = results.some((result) => result.status === "fail");
  const hasRegression = Boolean(output.diff?.regression);
  if (hasFailures || hasRegression) {
    output.status = "fail";
  } else if (results.some((result) => result.status === "warn")) {
    output.status = "warn";
  }

  printJson(output);
  return output.status === "fail" ? 1 : 0;
}

process.exitCode = main();
