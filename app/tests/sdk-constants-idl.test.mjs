import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'index.js'));
const built = require(join(root, 'packages/sdk/dist/index.js'));

test('rebuilt SDK numeric constants and IDL match published', () => {
  // #530's constant loop compares every PublicKey-valued export; the
  // numeric constants escape it (they have no toBase58), and the IDL is
  // never compared at all. Account-size constants gate decoders: a drift
  // here would accept or reject live account layouts.
  for (const name of [
    'ADMIN_CTO_COMPUTE_UNIT_LIMIT',
    'BONDING_CURVE_NEW_SIZE',
    'BONDING_CURVE_SIZE',
    'CANONICAL_POOL_INDEX',
    'FEE_CONFIG_CURRENT_SIZE',
    'FEE_CONFIG_INITIALIZE_SIZE',
    'FEE_CONFIG_POST_STABLE_SIZE',
    'GLOBAL_SIZE',
    'MAX_CURVE_DEPTH',
  ]) {
    assert.equal(built[name], original[name], name);
    assert.equal(typeof built[name], 'number', `${name} is numeric`);
  }
  // The bundled IDL must be byte-identical in content: instruction and
  // account layouts the SDK encodes against.
  assert.deepEqual(built.pumpIdl, original.pumpIdl, 'pumpIdl');
});
