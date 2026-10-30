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
const { PublicKey } = require('@solana/web3.js');
const BN = require('bn.js');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-swap-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

const zero = PublicKey.default;
const key = (byte) => new PublicKey(Buffer.alloc(32, byte));
const globalConfigFor = (protocolFeeRecipients, reservedFeeRecipient, reservedFeeRecipients) => ({
  admin: zero, lpFeeBasisPoints: new BN(25), protocolFeeBasisPoints: new BN(50),
  disableFlags: 0, protocolFeeRecipients, coinCreatorFeeBasisPoints: new BN(25),
  adminSetCoinCreatorAuthority: zero, whitelistPda: zero, reservedFeeRecipient,
  mayhemModeEnabled: false, reservedFeeRecipients, isCashbackEnabled: false,
  buybackFeeRecipients: [], buybackBasisPoints: new BN(100), boostAuthority: zero,
  boostEnabled: false, creatorFeeConfigurable: true, maxConfigurableCreatorFeeBps: new BN(500),
});

test('rebuilt swap getFeeRecipient matches published', () => {
  // The selection is random, so both builds run under a stubbed Math.random:
  // identical draws must pick identical recipients.
  const realRandom = Math.random;
  try {
    const cases = [
      ['single protocol recipient', globalConfigFor([key(1)], zero, []), false],
      ['multiple protocol recipients', globalConfigFor([key(1), key(2), key(3)], zero, []), false],
      // Unlike the root getFeeRecipient (#1909), the swap version does NOT
      // filter zero keys: a draw landing on the zero slot returns it.
      ['zero protocol slot is selectable', globalConfigFor([zero, key(2)], zero, []), false],
      ['mayhem reserved recipients', globalConfigFor([key(9)], key(4), [key(5), key(6)]), true],
      ['mayhem single reserved recipient', globalConfigFor([key(9)], key(4), []), true],
    ];
    for (const [name, globalConfig, isMayhemMode] of cases) {
      for (const draw of [0, 0.5, 0.999]) {
        Math.random = () => draw;
        assert.equal(
          built.getFeeRecipient(globalConfig, isMayhemMode).toBase58(),
          original.getFeeRecipient(globalConfig, isMayhemMode).toBase58(),
          `${name} draw=${draw}`,
        );
      }
    }
  } finally {
    Math.random = realRandom;
  }
});
