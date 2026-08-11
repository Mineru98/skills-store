#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildCapabilityBundle,
  CapabilityCompatibilityError,
  verifyCapabilityBundle,
} from '../tools/issue-phase-capabilities.mjs';
import { canonicalJsonBytes } from '../tools/issue-phase-contract.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

if (process.argv.includes('--check')) {
  try {
    verifyCapabilityBundle(root);
    console.log('capability bundle: 최신');
  } catch (error) {
    if (!(error instanceof CapabilityCompatibilityError)) throw error;
    console.error(`STALE  capability bundle (${error.code}): ${error.message}`);
    console.error('       재생성: sh scripts/sync-shared.sh && node scripts/build-phase-capability-bundle.mjs && sh scripts/sync-shared.sh');
    process.exit(1);
  }
} else {
  writeFileSync(
    new URL('../contracts/issue-phase-capability-bundle-v1.json', import.meta.url),
    canonicalJsonBytes(buildCapabilityBundle(root)),
  );
}
