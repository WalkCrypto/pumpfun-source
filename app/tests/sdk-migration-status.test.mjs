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
const { PublicKey } = require('@solana/web3.js');
const BN = require('bn.js');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'index.js'));
const built = require(join(root, 'packages/sdk/dist/index.js'));

test('rebuilt migration-status predicates match published', () => {
  // isBondingCurveMigrated is a four-way conjunction: only the all-zero
  // combination migrates, so every 3-of-4-zero curve must read false.
  const curve = (realQuote, virtualQuote, realToken, virtualToken) => ({
    realQuoteReserves: new BN(realQuote),
    virtualQuoteReserves: new BN(virtualQuote),
    realTokenReserves: new BN(realToken),
    virtualTokenReserves: new BN(virtualToken),
  });
  for (let mask = 0; mask < 16; mask++) {
    const candidate = curve(mask & 1 ? 0 : 5, mask & 2 ? 0 : 5, mask & 4 ? 0 : 5, mask & 8 ? 0 : 5);
    assert.equal(built.isBondingCurveMigrated(candidate), original.isBondingCurveMigrated(candidate), `migrated mask=${mask}`);
  }
  assert.equal(built.isBondingCurveMigrated(curve(0, 0, 0, 0)), true, 'all-zero curve migrates');

  // hasCoinCreatorMigratedToSharingConfig is PDA equality: the creator
  // counts as migrated exactly when it equals the fee-sharing-config PDA.
  const mint = new PublicKey(Buffer.alloc(32, 7));
  const migratedCreator = built.feeSharingConfigPda(mint);
  assert.equal(migratedCreator.toBase58(), original.feeSharingConfigPda(mint).toBase58(), 'fee-sharing PDA agrees');
  for (const creator of [migratedCreator, PublicKey.default, new PublicKey(Buffer.alloc(32, 9))]) {
    assert.equal(
      built.hasCoinCreatorMigratedToSharingConfig({ mint, creator }),
      original.hasCoinCreatorMigratedToSharingConfig({ mint, creator }),
      `creator=${creator.toBase58()}`,
    );
  }

  // isSharingConfigEditable: version 1 is never editable, version 2 is
  // editable only while the admin is not revoked, other versions are editable.
  const sharingConfig = (version, adminRevoked) => ({
    version, mint, admin: PublicKey.default, adminRevoked, shareholders: [],
  });
  for (const [version, adminRevoked] of [[0, false], [1, false], [1, true], [2, false], [2, true], [3, false], [3, true]]) {
    assert.equal(
      built.isSharingConfigEditable({ sharingConfig: sharingConfig(version, adminRevoked) }),
      original.isSharingConfigEditable({ sharingConfig: sharingConfig(version, adminRevoked) }),
      `version=${version} revoked=${adminRevoked}`,
    );
  }
});
