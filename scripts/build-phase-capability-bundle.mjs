#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCapabilityBundle } from '../tools/issue-phase-capabilities.mjs';
import { canonicalJsonBytes } from '../tools/issue-phase-contract.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
writeFileSync(
  new URL('../contracts/issue-phase-capability-bundle-v1.json', import.meta.url),
  canonicalJsonBytes(buildCapabilityBundle(root)),
);
