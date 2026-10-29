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

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'index.js'));
const built = require(join(root, 'packages/sdk/dist/index.js'));

// Quote mints whose classification decides which fee schedule a curve pays.
// The Token-2022 native mint is the discriminating case: SOL-like for fees
// but not a legacy mint, so normalizeQuoteMint must leave it unchanged,
// while the zero key and WSOL normalize to WSOL.
const cases = {
  'zero key (legacy SOL)': PublicKey.default,
  'WSOL': new PublicKey('So11111111111111111111111111111111111111112'),
  'Token-2022 native mint': new PublicKey('9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP'),
  'mainnet USDC (stable)': new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  'devnet USDC (not listed on-chain, exotic)': new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  'unlisted mint (exotic)': new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
};

test('rebuilt quote-mint classification matches published', () => {
  for (const [name, mint] of Object.entries(cases)) {
    for (const fn of ['isSolLikeQuoteMint', 'isStableQuoteMint', 'isExoticQuoteMint', 'isLegacyQuoteMint']) {
      assert.equal(built[fn](mint), original[fn](mint), `${name} ${fn}`);
    }
    assert.equal(built.normalizeQuoteMint(mint).toBase58(), original.normalizeQuoteMint(mint).toBase58(), `${name} normalizeQuoteMint`);
  }
  // Exactly one class per mint: the four predicates must partition the set.
  for (const [name, mint] of Object.entries(cases)) {
    const classes = ['isSolLikeQuoteMint', 'isStableQuoteMint', 'isExoticQuoteMint'].filter((fn) => built[fn](mint));
    assert.equal(classes.length, 1, `${name} classified as ${classes.join(',')}`);
  }
  // normalizeQuoteMint maps absent inputs to WSOL on both sides.
  for (const absent of [null, undefined]) {
    assert.equal(built.normalizeQuoteMint(absent).toBase58(), original.normalizeQuoteMint(absent).toBase58(), `absent normalizeQuoteMint`);
  }
  // The hardcoded mint lists themselves agree, not just their lookups.
  for (const list of ['SOL_LIKE_QUOTE_MINTS', 'STABLE_QUOTE_MINTS']) {
    assert.deepEqual(
      built[list].map((mint) => mint.toBase58()),
      original[list].map((mint) => mint.toBase58()),
      list,
    );
  }
});
