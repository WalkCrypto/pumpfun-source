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

const zero = PublicKey.default;
const key = (byte) => new PublicKey(Buffer.alloc(32, byte));
const globalFor = (feeRecipient, feeRecipients, reservedFeeRecipient, reservedFeeRecipients) => ({
  initialized: true, authority: zero, feeRecipient,
  initialVirtualTokenReserves: new BN(1), initialVirtualSolReserves: new BN(1),
  initialRealTokenReserves: new BN(1), tokenTotalSupply: new BN(1),
  feeBasisPoints: new BN(95), withdrawAuthority: zero, enableMigrate: true,
  poolMigrationFee: new BN(0), creatorFeeBasisPoints: new BN(30),
  feeRecipients, setCreatorAuthority: zero, adminSetCreatorAuthority: zero,
  createV2Enabled: true, whitelistPda: zero, reservedFeeRecipient,
  reservedFeeRecipients, isCashbackEnabled: false, buybackFeeRecipients: [],
  buybackBasisPoints: new BN(0), initialVirtualQuoteReserves: new BN(1),
  whitelistedQuoteMints: [], creatorFeeConfigurable: true,
  maxConfigurableCreatorFeeBps: new BN(500), holderRewardClaimAuthority: zero,
  isHolderRewardEnabled: false, maxCurveDepth: 2,
});

test('rebuilt getFeeRecipient matches published', () => {
  // The selection is random, so both builds run under a stubbed Math.random:
  // identical draws must pick identical recipients.
  const realRandom = Math.random;
  try {
    const cases = [
      ['single recipient', globalFor(key(1), [], zero, []), false],
      ['multiple recipients', globalFor(key(1), [key(2), key(3)], zero, []), false],
      ['zero keys filtered', globalFor(zero, [key(2), zero, key(3)], zero, []), false],
      ['all zero falls back to the zero primary', globalFor(zero, [zero], zero, []), false],
      ['mayhem single reserved recipient', globalFor(key(1), [key(9)], key(4), []), true],
      ['mayhem recipients with zeros filtered', globalFor(key(1), [], zero, [key(5), zero, key(6)]), true],
      ['mayhem all zero falls back to the zero primary', globalFor(key(1), [], zero, [zero]), true],
    ];
    for (const [name, global, mayhemMode] of cases) {
      for (const draw of [0, 0.5, 0.999]) {
        Math.random = () => draw;
        assert.equal(
          built.getFeeRecipient(global, mayhemMode).toBase58(),
          original.getFeeRecipient(global, mayhemMode).toBase58(),
          `${name} draw=${draw}`,
        );
      }
    }
  } finally {
    Math.random = realRandom;
  }
});
