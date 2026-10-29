import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));
const { PublicKey } = require('@solana/web3.js');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'index.js'));
const built = require(join(root, 'packages/sdk/dist/index.js'));

test('rebuilt zero-argument mayhem PDAs match published', () => {
  // #530 covers the keyed PDA derivations; these two take no key, so its
  // derivation loop never exercised them.
  for (const fn of ['getGlobalParamsPda', 'getSolVaultPda']) {
    assert.equal(built[fn]().toBase58(), original[fn]().toBase58(), fn);
  }
  // Sanity: the two derivations are distinct addresses, not one shared stub.
  assert.notEqual(built.getGlobalParamsPda().toBase58(), built.getSolVaultPda().toBase58());
  const key = new PublicKey(createHash('sha256').update('mayhem-pda-probe').digest());
  assert.notEqual(built.getSolVaultPda().toBase58(), built.getMayhemStatePda(key).toBase58());
});
