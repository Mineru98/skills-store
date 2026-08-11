// !!! VENDORED FILE — DO NOT EDIT !!!
// canonical: tools/issue-phase-contract.mjs
// resync   : sh scripts/sync-shared.sh
/**
 * Versioned machine-phase envelope and RFC 8785 JSON Canonicalization Scheme boundary.
 *
 * This file is canonical. Run scripts/sync-shared.sh after changing it.
 * No runtime dependency beyond Node.js is used.
 */
// allow: SIZE_OK — the dependency-free JSON parser and its phase boundary ship as one vendored module.
import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

export const PHASE_API_VERSION = 'issue-phase/v1';
export const PHASE_CONTRACT_ID = 'issue-phase-api-v1';

export const PHASE_IDS = Object.freeze([
  'issue-start.intake', 'issue-start.fetch', 'issue-start.classify', 'issue-start.plan',
  'issue-start.worktree', 'issue-start.before', 'issue-start.implement', 'issue-start.commit',
  'issue-start.after', 'issue-start.publish-evidence', 'issue-start.comment',
  'issue-start.sync-base', 'issue-start.handback',
  'issue-end.context', 'issue-end.approval-evidence', 'issue-end.before-recapture',
  'issue-end.after-recapture', 'issue-end.report', 'issue-end.publish-evidence',
  'issue-end.sync-base', 'issue-end.comment', 'issue-end.review-approval', 'issue-end.pr',
  'issue-end.handback',
  'issue-merge.base-tree', 'issue-merge.inventory', 'issue-merge.map',
  'issue-merge.candidate', 'issue-merge.preflight-plan', 'issue-merge.resolve-review',
  'issue-merge.merge-verify', 'issue-merge.close-cleanup', 'issue-merge.handback',
]);

export const LEGAL_EXIT_CODES = Object.freeze({
  completed: 0,
  internalError: 1,
  invalidRequest: 2,
  held: 3,
});

export const EFFECT_CLASSIFICATIONS = Object.freeze([
  'local-idempotent',
  'approval-required',
  'uncertain-non-idempotent',
]);

export const HANDBACK_RULES = Object.freeze({
  complete: Object.freeze({ resume: 'next', retry: 'never' }),
  held: Object.freeze({ resume: 'same', retry: 'reconcile' }),
  failed: Object.freeze({ resume: 'none', retry: 'never' }),
});

export class PhaseContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PhaseContractError';
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new PhaseContractError(code, message);
};

const hasLoneSurrogate = (value) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
};

const decodeInput = (input) => {
  if (typeof input === 'string') return input;
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input);
    } catch {
      fail('INVALID_UTF8', 'JSON input is not valid UTF-8');
    }
  }
  fail('INVALID_INPUT', 'JSON input must be a string or UTF-8 byte sequence');
};

class CanonicalJsonParser {
  constructor(text) {
    this.text = text;
    this.offset = 0;
  }

  parse() {
    if (this.text.charCodeAt(0) === 0xfeff) fail('JSON_BOM', 'JSON input must not contain a BOM');
    const value = this.value();
    if (this.offset !== this.text.length) fail('JSON_SYNTAX', `Unexpected token at byte ${this.offset}`);
    return value;
  }

  value() {
    const token = this.text[this.offset];
    if (token === '"') return this.string();
    if (token === '{') return this.object();
    if (token === '[') return this.array();
    if (token === 't') return this.literal('true', true);
    if (token === 'f') return this.literal('false', false);
    if (token === 'n') return this.literal('null', null);
    return this.number();
  }

  literal(source, value) {
    if (!this.text.startsWith(source, this.offset)) fail('JSON_SYNTAX', `Invalid literal at byte ${this.offset}`);
    this.offset += source.length;
    return value;
  }

  string() {
    const start = this.offset;
    this.offset += 1;
    while (this.offset < this.text.length) {
      const code = this.text.charCodeAt(this.offset);
      if (code === 0x22) {
        this.offset += 1;
        let value;
        try {
          value = JSON.parse(this.text.slice(start, this.offset));
        } catch {
          fail('JSON_STRING', `Invalid string at byte ${start}`);
        }
        if (hasLoneSurrogate(value)) fail('INVALID_UNICODE', `Lone surrogate at byte ${start}`);
        return value;
      }
      if (code < 0x20) fail('JSON_STRING', `Unescaped control character at byte ${this.offset}`);
      if (code === 0x5c) {
        this.offset += 1;
        const escaped = this.text[this.offset];
        if (escaped === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(this.text.slice(this.offset + 1, this.offset + 5))) {
            fail('JSON_STRING', `Invalid Unicode escape at byte ${this.offset}`);
          }
          this.offset += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(escaped ?? '')) fail('JSON_STRING', `Invalid escape at byte ${this.offset}`);
      }
      this.offset += 1;
    }
    fail('JSON_STRING', `Unterminated string at byte ${start}`);
  }

  number() {
    const rest = this.text.slice(this.offset);
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest);
    if (!match) fail('JSON_SYNTAX', `Invalid value at byte ${this.offset}`);
    const source = match[0];
    const value = Number(source);
    if (!Number.isFinite(value) || JSON.stringify(value) !== source) {
      fail('NON_CANONICAL_NUMBER', `Number is not in canonical IEEE 754 form at byte ${this.offset}`);
    }
    this.offset += source.length;
    return value;
  }

  array() {
    this.offset += 1;
    const values = [];
    if (this.text[this.offset] === ']') {
      this.offset += 1;
      return values;
    }
    while (true) {
      values.push(this.value());
      const token = this.text[this.offset];
      this.offset += 1;
      if (token === ']') return values;
      if (token !== ',') fail('JSON_SYNTAX', `Expected comma at byte ${this.offset - 1}`);
    }
  }

  object() {
    this.offset += 1;
    const entries = [];
    const names = new Set();
    if (this.text[this.offset] === '}') {
      this.offset += 1;
      return {};
    }
    while (true) {
      if (this.text[this.offset] !== '"') fail('JSON_SYNTAX', `Expected property name at byte ${this.offset}`);
      const name = this.string();
      if (names.has(name)) fail('DUPLICATE_PROPERTY', `Duplicate property ${JSON.stringify(name)}`);
      names.add(name);
      if (this.text[this.offset] !== ':') fail('JSON_SYNTAX', `Expected colon at byte ${this.offset}`);
      this.offset += 1;
      entries.push([name, this.value()]);
      const token = this.text[this.offset];
      this.offset += 1;
      if (token === '}') return Object.fromEntries(entries);
      if (token !== ',') fail('JSON_SYNTAX', `Expected comma at byte ${this.offset - 1}`);
    }
  }
}

const serialize = (value, ancestors) => {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) fail('INVALID_UNICODE', 'String contains a lone surrogate');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_NUMBER', 'Number must be finite');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') fail('UNSUPPORTED_VALUE', `Unsupported JSON value type: ${typeof value}`);
  if (ancestors.has(value)) fail('CYCLIC_VALUE', 'JSON value must not contain cycles');
  ancestors.add(value);
  let output;
  if (Array.isArray(value)) {
    let dense = Object.keys(value).length === value.length;
    for (let index = 0; dense && index < value.length; index += 1) {
      dense = Object.hasOwn(value, index);
    }
    if (!dense) {
      fail('UNSUPPORTED_VALUE', 'Arrays must be dense and contain no named properties');
    }
    output = `[${value.map((entry) => serialize(entry, ancestors)).join(',')}]`;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail('UNSUPPORTED_VALUE', 'Only plain JSON objects can be canonicalized');
    }
    const names = Object.keys(value).sort();
    output = `{${names.map((name) => {
      if (hasLoneSurrogate(name)) fail('INVALID_UNICODE', 'Property name contains a lone surrogate');
      return `${JSON.stringify(name)}:${serialize(value[name], ancestors)}`;
    }).join(',')}}`;
  }
  ancestors.delete(value);
  return output;
};

export function canonicalJsonBytes(value) {
  return Buffer.from(serialize(value, new Set()), 'utf8');
}

export function canonicalJsonSha256(value) {
  return createHash('sha256').update(canonicalJsonBytes(value)).digest('hex');
}

export function phaseApprovalId({
  checkpoint,
  effect,
  immutableState,
  namespace,
}) {
  if (typeof namespace !== 'string' || namespace.length === 0) {
    fail('INVALID_APPROVAL', 'Approval namespace must be a non-empty string');
  }
  return `${namespace}:${effect.type}:${canonicalJsonSha256({
    checkpoint,
    effect,
    immutableState,
    namespace,
  })}`;
}

export function parseCanonicalJson(input) {
  const text = decodeInput(input);
  const value = new CanonicalJsonParser(text).parse();
  if (!canonicalJsonBytes(value).equals(Buffer.from(text, 'utf8'))) {
    fail('NON_CANONICAL_JSON', 'JSON input is not the RFC 8785 canonical byte sequence');
  }
  return value;
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const exactKeys = (value, expected, label) => {
  if (!isRecord(value)) fail('INVALID_ENVELOPE', `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((name, index) => name !== wanted[index])) {
    fail('UNKNOWN_PROPERTY', `${label} must contain exactly: ${wanted.join(', ')}`);
  }
};

const nonEmptyString = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_ENVELOPE', `${label} must be a non-empty string`);
};

export function validatePhaseEnvelope(envelope) {
  exactKeys(envelope, [
    'apiVersion', 'contractId', 'phaseId', 'checkpoint', 'ok', 'data', 'observedFacts',
    'proposedEffect', 'handback', 'error',
  ], 'envelope');
  if (envelope.apiVersion !== PHASE_API_VERSION) fail('API_VERSION', 'Unsupported apiVersion');
  if (envelope.contractId !== PHASE_CONTRACT_ID) fail('CONTRACT_ID', 'Unsupported contractId');
  if (!PHASE_IDS.includes(envelope.phaseId)) fail('PHASE_ID', 'Unknown phaseId');
  if (typeof envelope.ok !== 'boolean') fail('INVALID_ENVELOPE', 'ok must be boolean');
  if (!isRecord(envelope.data)) fail('INVALID_ENVELOPE', 'data must be an object');
  canonicalJsonBytes(envelope.data);

  exactKeys(envelope.checkpoint, ['id', 'owner', 'attempt'], 'checkpoint');
  nonEmptyString(envelope.checkpoint.id, 'checkpoint.id');
  const owner = envelope.phaseId.split('.')[0];
  if (envelope.checkpoint.owner !== owner) fail('CHECKPOINT_OWNER', `checkpoint.owner must be ${owner}`);
  if (!Number.isSafeInteger(envelope.checkpoint.attempt) || envelope.checkpoint.attempt < 1) {
    fail('INVALID_ENVELOPE', 'checkpoint.attempt must be a positive safe integer');
  }

  if (!Array.isArray(envelope.observedFacts)) fail('INVALID_ENVELOPE', 'observedFacts must be an array');
  for (const fact of envelope.observedFacts) {
    exactKeys(fact, ['kind', 'value'], 'observedFact');
    nonEmptyString(fact.kind, 'observedFact.kind');
    canonicalJsonBytes(fact.value);
  }

  if (envelope.proposedEffect !== null) {
    exactKeys(envelope.proposedEffect, ['approvalId', 'classification', 'request', 'type'], 'proposedEffect');
    if (!EFFECT_CLASSIFICATIONS.includes(envelope.proposedEffect.classification)) {
      fail('EFFECT_CLASSIFICATION', 'Unknown effect classification');
    }
    nonEmptyString(envelope.proposedEffect.type, 'proposedEffect.type');
    if (envelope.proposedEffect.approvalId !== null) {
      nonEmptyString(envelope.proposedEffect.approvalId, 'proposedEffect.approvalId');
    }
    if (envelope.proposedEffect.classification === 'approval-required'
      && envelope.proposedEffect.approvalId === null) {
      fail('EFFECT_APPROVAL', 'approval-required effects need approvalId');
    }
    if (!isRecord(envelope.proposedEffect.request)) fail('INVALID_ENVELOPE', 'proposedEffect.request must be an object');
    canonicalJsonBytes(envelope.proposedEffect.request);
    if (envelope.handback?.disposition !== 'held') {
      fail('EFFECT_HANDBACK', 'Proposed effects require a held handback');
    }
  }

  exactKeys(envelope.handback, ['disposition', 'resume', 'retry'], 'handback');
  const rule = HANDBACK_RULES[envelope.handback.disposition];
  if (rule === undefined
    || envelope.handback.resume !== rule.resume
    || envelope.handback.retry !== rule.retry) {
    fail('HANDBACK_RULE', 'Illegal disposition/resume/retry combination');
  }

  if (envelope.ok) {
    if (envelope.error !== null || envelope.handback.disposition === 'failed') {
      fail('RESULT_INVARIANT', 'Successful envelopes cannot contain errors or failed handback');
    }
  } else {
    if (envelope.proposedEffect !== null) fail('ZERO_EFFECT_FAILURE', 'Failed envelopes cannot propose effects');
    if (envelope.handback.disposition !== 'failed') fail('RESULT_INVARIANT', 'Failed envelopes need failed handback');
    exactKeys(envelope.error, ['code', 'message', 'retryable'], 'error');
    nonEmptyString(envelope.error.code, 'error.code');
    nonEmptyString(envelope.error.message, 'error.message');
    if (typeof envelope.error.retryable !== 'boolean') fail('INVALID_ENVELOPE', 'error.retryable must be boolean');
  }
  return envelope;
}

export function parsePhaseEnvelope(input) {
  return validatePhaseEnvelope(parseCanonicalJson(input));
}
