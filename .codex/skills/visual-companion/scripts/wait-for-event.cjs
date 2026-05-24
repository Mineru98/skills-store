#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  process.stderr.write(`Usage:
  node wait-for-event.cjs <state-dir> [--timeout-ms N] [--since-ms N] [--type TYPE] [--clear]

Waits for the next browser event recorded by the visual companion server and
prints the matching JSON event to stdout.
`);
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }

  const args = {
    stateDir: argv[0],
    timeoutMs: 10 * 60 * 1000,
    sinceMs: 0,
    type: null,
    clear: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--timeout-ms') {
      args.timeoutMs = Number(value);
      index += 1;
    } else if (key === '--since-ms') {
      args.sinceMs = Number(value);
      index += 1;
    } else if (key === '--type') {
      args.type = value;
      index += 1;
    } else if (key === '--clear') {
      args.clear = true;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }

  return args;
}

function readEvents(eventsFile, args) {
  if (!fs.existsSync(eventsFile)) return [];

  return fs.readFileSync(eventsFile, 'utf8')
    .split(/\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((event) => !args.type || event.type === args.type)
    .filter((event) => Number(event.timestamp || 0) >= args.sinceMs);
}

async function waitForEvent(args) {
  if (!args.stateDir || args.help) {
    usage();
    return args.help ? 0 : 2;
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1) {
    throw new Error('--timeout-ms must be a positive number');
  }
  if (!Number.isFinite(args.sinceMs) || args.sinceMs < 0) {
    throw new Error('--since-ms must be a non-negative number');
  }

  const stateDir = path.resolve(args.stateDir);
  const eventsFile = path.join(stateDir, 'events');
  if (!fs.existsSync(stateDir)) {
    throw new Error(`State directory does not exist: ${stateDir}`);
  }
  if (args.clear && fs.existsSync(eventsFile)) {
    fs.unlinkSync(eventsFile);
  }

  const existing = readEvents(eventsFile, args);
  if (existing.length > 0) {
    process.stdout.write(`${JSON.stringify(existing[existing.length - 1], null, 2)}\n`);
    return 0;
  }

  const startedAt = Date.now();
  let watcher = null;

  return await new Promise((resolve, reject) => {
    const check = () => {
      const events = readEvents(eventsFile, args);
      if (events.length > 0) {
        cleanup();
        process.stdout.write(`${JSON.stringify(events[events.length - 1], null, 2)}\n`);
        resolve(0);
        return;
      }
      if (Date.now() - startedAt > args.timeoutMs) {
        cleanup();
        reject(new Error(`Timed out waiting for browser event after ${args.timeoutMs}ms`));
      }
    };

    const cleanup = () => {
      clearInterval(interval);
      if (watcher) watcher.close();
    };

    const interval = setInterval(check, 200);
    watcher = fs.watch(stateDir, check);
    check();
  });
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
  waitForEvent(args)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  usage();
  process.exitCode = 2;
}
