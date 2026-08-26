import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let Ajv2020 = null;
let ajvImportError = null;
try {
  ({ default: Ajv2020 } = await import('ajv/dist/2020.js'));
} catch (error) {
  ajvImportError = error;
}

export const ontologyAvailable = Boolean(Ajv2020);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ACTIONS = ['create', 'start', 'end', 'merge'];
const cache = new Map();

function unavailable(message) {
  const error = new Error(message + '. tools/issue-ontology에서 npm install을 실행하세요.');
  error.code = 'ONTOLOGY_UNAVAILABLE';
  if (ajvImportError) error.cause = ajvImportError;
  return error;
}

function ontologyRoot(root) {
  const candidate = path.resolve(root ?? process.env.ISSUE_ONTOLOGY_ROOT ?? HERE);
  if (existsSync(path.join(candidate, 'schemas'))) return candidate;
  return path.join(candidate, 'tools', 'issue-ontology');
}

function readSchema(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    const wrapped = new Error('온톨로지 스키마를 읽을 수 없습니다: ' + file + ': ' + error.message);
    wrapped.code = 'ONTOLOGY_SCHEMA_INVALID';
    throw wrapped;
  }
}

function validationError(label, errors = []) {
  const details = errors
    .map((error) => (error.instancePath || '/') + ' ' + error.message)
    .join('; ');
  const failure = new Error(
    label + ' schema validation failed' + (details ? ': ' + details : ''),
  );
  failure.code = 'ONTOLOGY_VALIDATION';
  failure.errors = errors;
  return failure;
}

export function loadOntology({ root } = {}) {
  if (!Ajv2020) throw unavailable('Ajv를 불러오지 못했습니다');
  const base = ontologyRoot(root);
  if (!existsSync(base)) throw unavailable('온톨로지 island가 없습니다: ' + base);
  if (cache.has(base)) return cache.get(base);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const graph = ajv.compile(readSchema(path.join(base, 'schemas', 'graph-v2.schema.json')));
  const actions = Object.fromEntries(ACTIONS.map((action) => [
    action,
    ajv.compile(readSchema(path.join(base, 'schemas', 'actions', action + '.schema.json'))),
  ]));
  const loaded = { root: base, ajv, graph, actions };
  cache.set(base, loaded);
  return loaded;
}

export function validateGraphDocument(document, { root } = {}) {
  const validator = loadOntology({ root }).graph;
  const valid = validator(document);
  return { valid, errors: valid ? [] : (validator.errors ?? []) };
}

export function validateActionDocument(document, { root } = {}) {
  const action = document?.action;
  const validator = loadOntology({ root }).actions[action];
  if (!validator) throw new Error('지원하지 않는 action: ' + action);
  const valid = validator(document);
  return { valid, errors: valid ? [] : (validator.errors ?? []) };
}

export function assertAction(name, observedOrDocument, options = {}) {
  let action = name;
  let document = observedOrDocument;
  if (typeof name === 'object' && name !== null) {
    document = name;
    action = name.action;
    options = observedOrDocument ?? {};
  } else if (!document || document.action !== action) {
    document = { action, observed: observedOrDocument };
  }

  const validator = loadOntology({ root: options.root }).actions[action];
  if (!validator) throw new Error('지원하지 않는 action: ' + action);
  if (!validator(document)) throw validationError(action, validator.errors ?? []);
  return document;
}
