import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-swap-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

const probe = (label) => new PublicKey(createHash('sha256').update(`swap-pda-${label}`).digest());
const eq = (label, a, b) => assert.equal(a.toBase58(), b.toBase58(), label);

test('rebuilt swap pool derivations match published', () => {
  // #530's PDA loop covers the root dist and the swap lpMintPda only; the
  // remaining swap-dist derivations — pool addresses, vault ATAs, metadata,
  // and the raw PDA primitives — are uncompared.
  for (const index of [0, 1, 255, 65535]) {
    eq(`poolPda index=${index}`, built.poolPda(index, probe('owner'), probe('base'), probe('quote')), original.poolPda(index, probe('owner'), probe('base'), probe('quote')));
  }
  for (const mint of [probe('mint-a'), probe('mint-b')]) {
    eq('poolV2Pda', built.poolV2Pda(mint), original.poolV2Pda(mint));
    eq('metadataPda', built.metadataPda(mint), original.metadataPda(mint));
    eq('lpMintAta', built.lpMintAta(mint, probe('owner')), original.lpMintAta(mint, probe('owner')));
    eq('coinCreatorVaultAuthorityPda', built.coinCreatorVaultAuthorityPda(probe('creator')), original.coinCreatorVaultAuthorityPda(probe('creator')));
    eq('coinCreatorVaultAtaPda', built.coinCreatorVaultAtaPda(probe('authority'), probe('quote'), TOKEN_2022_PROGRAM_ID), original.coinCreatorVaultAtaPda(probe('authority'), probe('quote'), TOKEN_2022_PROGRAM_ID));
    eq('boostVaultAta', built.boostVaultAta(probe('authority'), probe('quote'), TOKEN_PROGRAM_ID), original.boostVaultAta(probe('authority'), probe('quote'), TOKEN_PROGRAM_ID));
  }
  // canonicalPoolQuoteMint maps the bonding curve's zero key to WSOL and
  // leaves every other quote mint unchanged.
  eq('canonicalPoolQuoteMint zero', built.canonicalPoolQuoteMint(PublicKey.default), original.canonicalPoolQuoteMint(PublicKey.default));
  eq('canonicalPoolQuoteMint other', built.canonicalPoolQuoteMint(probe('usdc')), original.canonicalPoolQuoteMint(probe('usdc')));
  // The raw primitives behind the named derivations, over custom seed sets.
  for (const seeds of [[Buffer.from('global_config')], [Buffer.from('pool'), Buffer.from([0, 0])]]) {
    eq('pumpAmmPda', built.pumpAmmPda(seeds), original.pumpAmmPda(seeds));
    eq('pumpPda', built.pumpPda(seeds), original.pumpPda(seeds));
    eq('pumpFeePda', built.pumpFeePda(seeds), original.pumpFeePda(seeds));
  }
});
