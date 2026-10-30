import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-swap-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

test('rebuilt swap constants and AMM IDL match published', () => {
  // The swap-dist mirror of #101: its numeric constants gate AMM account
  // decoders, its PDA constants name the AMM's global accounts, and its
  // bundled IDL is what the AMM SDK encodes against. None is compared by
  // any earlier differential test (the root-dist loops cover the root dist).
  for (const name of [
    'FEE_CONFIG_SIZE_POST_EXOTIC',
    'FEE_CONFIG_SIZE_POST_STABLE',
    'FEE_CONFIG_SIZE_PRE_STABLE',
    'GLOBAL_CONFIG_SIZE',
    'POOL_SIZE',
    'POOL_ACCOUNT_NEW_SIZE',
    'MULTI_HOP_MAX_HOPS',
    'CANONICAL_POOL_INDEX',
  ]) {
    assert.equal(built[name], original[name], name);
    assert.equal(typeof built[name], 'number', `${name} is numeric`);
  }
  for (const name of [
    'GLOBAL_CONFIG_PDA',
    'GLOBAL_VOLUME_ACCUMULATOR_PDA',
    'PUMP_AMM_EVENT_AUTHORITY_PDA',
    'PUMP_AMM_FEE_CONFIG_PDA',
    'PUMP_EVENT_AUTHORITY_PDA',
    'PUMP_FEE_CONFIG_PDA',
    'PUMP_GLOBAL_PDA',
  ]) {
    assert.equal(built[name].toBase58(), original[name].toBase58(), name);
  }
  assert.deepEqual(built.pumpAmmJson, original.pumpAmmJson, 'pumpAmmJson');
});
