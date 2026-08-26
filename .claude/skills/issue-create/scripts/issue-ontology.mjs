import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function findIsland(start = process.cwd()) {
  if (process.env.ISSUE_ONTOLOGY_ROOT) return path.resolve(process.env.ISSUE_ONTOLOGY_ROOT);
  let current = path.resolve(start);
  while (true) {
    const direct = path.join(current, 'tools', 'issue-ontology');
    if (existsSync(path.join(direct, 'validate.mjs'))) return direct;
    if (path.basename(current) === 'issue-ontology' && existsSync(path.join(current, 'validate.mjs'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(path.resolve(start), 'tools', 'issue-ontology');
}
const islandRoot = findIsland();
const entry = path.join(islandRoot, 'validate.mjs');
let ontology = null;
let loadError = null;
if (existsSync(entry)) {
  try {
    ontology = await import(pathToFileURL(entry).href);
  } catch (error) {
    loadError = error;
  }
}

export function ontologyStatus() {
  if (!ontology) return { state: 'missing', available: false, reason: loadError?.message ?? 'island missing' };
  if (!ontology.ontologyAvailable) {
    return { state: 'unavailable', available: false, reason: 'Ajv missing' };
  }
  return { state: 'available', available: true, reason: null };
}

export function gateAction(actionOrDocument, observed, options = {}) {
  const document = typeof actionOrDocument === 'string'
    ? { action: actionOrDocument, observed }
    : actionOrDocument;
  const status = ontologyStatus();
  if (!status.available) {
    return { ok: true, skipped: true, document, reason: status.reason };
  }
  try {
    ontology.assertAction(document.action, document, { ...options, root: islandRoot });
    return { ok: true, skipped: false, document };
  } catch (error) {
    if (error?.code === 'ONTOLOGY_UNAVAILABLE') {
      return { ok: true, skipped: true, document, reason: error.message };
    }
    return {
      ok: false,
      skipped: false,
      document,
      error: error instanceof Error ? error.message : String(error),
      errors: error?.errors ?? [],
    };
  }
}
