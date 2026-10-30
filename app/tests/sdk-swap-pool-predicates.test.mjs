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

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-swap-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

const probe = (label) => new PublicKey(createHash('sha256').update(`swap-pred-${label}`).digest());

test('rebuilt swap pool predicates and buyback recipient match published', () => {
  // isPumpPool is PDA equality: a pool counts as a pump pool exactly when
  // its creator is the pool-authority PDA of its base mint.
  for (const mint of [probe('mint-a'), probe('mint-b')]) {
    const authority = built.pumpPoolAuthorityPda(mint);
    assert.equal(authority.toBase58(), original.pumpPoolAuthorityPda(mint).toBase58(), 'pool authority agrees');
    for (const creator of [authority, probe('other'), PublicKey.default]) {
      assert.equal(built.isPumpPool(mint, creator), original.isPumpPool(mint, creator), `isPumpPool creator=${creator.toBase58()}`);
    }
  }

  // supportsTradeV2 is the negation of the cashback flag; an absent flag
  // reads as not-cashback on both sides.
  for (const isCashbackCoin of [true, false, undefined]) {
    assert.equal(
      built.supportsTradeV2({ isCashbackCoin }),
      original.supportsTradeV2({ isCashbackCoin }),
      `supportsTradeV2 cashback=${isCashbackCoin}`,
    );
  }

  // getBuybackFeeRecipient picks one buyback recipient at random; both
  // builds run under a stubbed Math.random so identical draws must agree.
  const realRandom = Math.random;
  try {
    const globalConfig = { buybackFeeRecipients: [probe('bb-1'), probe('bb-2'), probe('bb-3')] };
    for (const draw of [0, 0.5, 0.999]) {
      Math.random = () => draw;
      assert.equal(
        built.getBuybackFeeRecipient(globalConfig).toBase58(),
        original.getBuybackFeeRecipient(globalConfig).toBase58(),
        `getBuybackFeeRecipient draw=${draw}`,
      );
    }
  } finally {
    Math.random = realRandom;
  }
});
