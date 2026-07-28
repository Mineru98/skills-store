#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalJsonBytes, canonicalJsonSha256 } from '../tools/issue-phase-contract.mjs';
import {
  buildCapabilityBundle,
  CapabilityCompatibilityError,
  probeCapabilityBundle,
  verifyCapabilityBundle,
} from '../tools/issue-phase-capabilities.mjs';

const BUNDLE_PATH = 'contracts/issue-phase-capability-bundle-v1.json';

const fixture = () => {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'issue-phase-compatibility-'));
  const root = path.join(parent, 'repository');
  cpSync(process.cwd(), root, {
    recursive: true,
    filter: (source) => !['.git', '.issue'].includes(path.basename(source)),
  });
  return { parent, root };
};

const readBundle = (root) => JSON.parse(readFileSync(path.join(root, BUNDLE_PATH), 'utf8'));
const writeBundle = (root, bundle) => {
  const bytes = canonicalJsonBytes(bundle);
  writeFileSync(path.join(root, BUNDLE_PATH), bytes);
  for (const mirror of ['.claude', '.codex']) {
    for (const skill of ['issue-start', 'issue-end', 'issue-merge']) {
      writeFileSync(path.join(root, mirror, 'skills', skill, BUNDLE_PATH), bytes);
    }
  }
};
const expectCode = (code, action) => {
  assert.throws(action, (error) => {
    assert.ok(error instanceof CapabilityCompatibilityError);
    assert.equal(error.code, code);
    return true;
  });
};

test('[active-required] capability bundle accepts the exact 13/11/9 phase inventory and complete closure', () => {
  const result = verifyCapabilityBundle(process.cwd());

  assert.equal(result.eligible, true);
  assert.equal(result.phaseCount, 33);
  assert.equal(result.mirrorCount, 2);
  assert.equal(result.closureEntries > 0, true);
});

test('[active-required] capability bundle rejects missing and extra phase IDs', () => {
  for (const mutation of ['missing', 'extra']) {
    const current = fixture();
    try {
      const bundle = readBundle(current.root);
      if (mutation === 'missing') bundle.phases.pop();
      else bundle.phases.push({ ...bundle.phases[0], phaseId: 'issue-start.extra' });
      writeBundle(current.root, bundle);

      expectCode('PHASE_SET_MISMATCH', () => verifyCapabilityBundle(current.root));
    } finally {
      rmSync(current.parent, { recursive: true, force: true });
    }
  }
});

test('[active-required] capability bundle rejects a duplicate valid phase', () => {
  const current = fixture();
  try {
    const bundle = structuredClone(buildCapabilityBundle(current.root));
    bundle.phases.push(structuredClone(bundle.phases[0]));
    const { capabilitySetSha256: _oldDigest, ...preimage } = bundle;
    bundle.capabilitySetSha256 = canonicalJsonSha256(preimage);
    writeBundle(current.root, bundle);

    expectCode('PHASE_SET_MISMATCH', () => verifyCapabilityBundle(current.root));
  } finally {
    rmSync(current.parent, { recursive: true, force: true });
  }
});

test('[active-required] capability bundle rejects coherent self-digested normative effect drift', () => {
  const current = fixture();
  try {
    const bundle = structuredClone(buildCapabilityBundle(current.root));
    const phase = bundle.phases.find((item) => item.phaseId === 'issue-start.publish-evidence');
    phase.effects = [{ approvalClass: 'local-idempotent', type: 'undocumented-write' }];
    phase.approvalClasses = ['local-idempotent'];
    const { capabilitySetSha256: _oldDigest, ...preimage } = bundle;
    bundle.capabilitySetSha256 = canonicalJsonSha256(preimage);
    writeBundle(current.root, bundle);

    expectCode('NORMATIVE_PHASE_MISMATCH', () => verifyCapabilityBundle(current.root));
  } finally {
    rmSync(current.parent, { recursive: true, force: true });
  }
});

test('[active-required] capability bundle rejects schema, mirror, and raw-byte closure drift', () => {
  const mutations = [
    {
      code: 'CLOSURE_HASH_MISMATCH',
      paths: [
        'schemas/issue-phase/phase-envelope-v1.schema.json',
        ...['.claude', '.codex'].flatMap((mirror) => (
          ['issue-start', 'issue-end', 'issue-merge'].map(
            (skill) => `${mirror}/skills/${skill}/schemas/issue-phase/phase-envelope-v1.schema.json`,
          )
        )),
      ],
    },
    {
      code: 'MIRROR_DRIFT',
      paths: ['.codex/skills/issue-start/contracts/issue-start-phase-api-v1.json'],
    },
    {
      code: 'CLOSURE_HASH_MISMATCH',
      paths: ['tools/issue-phase-contract.mjs'],
    },
  ];

  for (const { code, paths } of mutations) {
    const current = fixture();
    try {
      for (const relativePath of paths) {
        const target = path.join(current.root, relativePath);
        writeFileSync(target, Buffer.concat([readFileSync(target), Buffer.from('\n')]));
      }

      expectCode(code, () => verifyCapabilityBundle(current.root));
    } finally {
      rmSync(current.parent, { recursive: true, force: true });
    }
  }
});

test('[active-required] capability bundle rejects outside-root and symlink closure paths', () => {
  const outside = fixture();
  try {
    const bundle = readBundle(outside.root);
    bundle.closure.entries[0].path = '../outside';
    writeBundle(outside.root, bundle);
    expectCode('UNSAFE_PATH', () => verifyCapabilityBundle(outside.root));
  } finally {
    rmSync(outside.parent, { recursive: true, force: true });
  }

  const linked = fixture();
  try {
    const relativePath = readBundle(linked.root).closure.entries[0].path;
    const target = path.join(linked.root, relativePath);
    const external = path.join(linked.parent, 'external');
    writeFileSync(external, readFileSync(target));
    unlinkSync(target);
    symlinkSync(external, target);
    expectCode('SYMLINK_PATH', () => verifyCapabilityBundle(linked.root));
  } finally {
    rmSync(linked.parent, { recursive: true, force: true });
  }
});

test('[active-required] capability probe rejects undocumented effects and fake-provider failures', async () => {
  await assert.rejects(
    probeCapabilityBundle(process.cwd(), {
      invoke: async ({ phase }) => ({
        effectTypes: phase.phaseId === 'issue-start.intake' ? ['undocumented-write'] : [],
        status: 0,
      }),
    }),
    (error) => error instanceof CapabilityCompatibilityError && error.code === 'UNDOCUMENTED_EFFECT',
  );
  await assert.rejects(
    probeCapabilityBundle(process.cwd(), {
      invoke: async ({ phase }) => ({
        effectTypes: [],
        status: phase.phaseId === 'issue-end.context' ? 1 : 0,
      }),
    }),
    (error) => error instanceof CapabilityCompatibilityError && error.code === 'PROVIDER_FAILURE',
  );
});

test('[active-required] capability probe invokes every phase through both installed mirrors', async () => {
  const seen = [];
  const result = await probeCapabilityBundle(process.cwd(), {
    invoke: async ({ mirror, phase }) => {
      seen.push(`${mirror.id}:${phase.phaseId}`);
      return { effectTypes: phase.effects.map((effect) => effect.type), status: 0 };
    },
  });

  assert.equal(result.eligible, true);
  assert.equal(seen.length, 66);
  assert.equal(new Set(seen).size, 66);
});

test('[active-required] installed phase contracts complete through both mirrors with fake providers', async () => {
  const result = await probeCapabilityBundle(process.cwd());

  assert.equal(result.eligible, true);
  assert.equal(result.probedInvocations, 66);
});
