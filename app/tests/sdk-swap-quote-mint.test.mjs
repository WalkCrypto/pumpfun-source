import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(new URL('../packages/sdk/package.json',import.meta.url));
const { PublicKey } = require('@solana/web3.js');
const published=mkdtempSync(join(tmpdir(),'pump-sdk-reference-'));
mkdirSync(join(published,'swap'));
symlinkSync(join(root,'packages/sdk/node_modules'),join(published,'node_modules'),process.platform==='win32'?'junction':'dir');
for(const sub of ['index.js','swap/index.js'])writeFileSync(join(published,sub),execFileSync('tar',['-xOf',join(root,'evidence/sdk/pump-sdk-4.3.1.tgz'),`package/dist/${sub}`]));
process.on('exit',()=>rmSync(published,{recursive:true,force:true}));

// Swap-side quote-mint classification, the sibling of the root classification
// test: it decides which fee schedule a canonical pool pays in feesForQuoteMint.
// The discriminating cases are the Token-2022 native mint (SOL-like, not stable)
// and devnet USDC (listed nowhere, so exotic — not stable).
const cases = {
  'zero key (legacy SOL)': PublicKey.default,
  'WSOL': new PublicKey('So11111111111111111111111111111111111111112'),
  'Token-2022 native mint': new PublicKey('9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP'),
  'mainnet USDC (stable)': new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  'devnet USDC (exotic, not stable)': new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  'unlisted mint (exotic)': new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
};

test('rebuilt swap quote-mint classification matches published', () => {
  const original = require(join(published, 'swap/index.js'));
  const built = require(join(root, 'packages/sdk/dist/swap/index.js'));
  for (const [name, mint] of Object.entries(cases)) {
    for (const fn of ['isSolLikeQuoteMint', 'isStableQuoteMint']) {
      assert.equal(built[fn](mint), original[fn](mint), `${name} ${fn}`);
    }
  }
  // The two predicates must not overlap: no mint is both SOL-like and stable.
  for (const [name, mint] of Object.entries(cases)) {
    assert.equal(built.isSolLikeQuoteMint(mint) && built.isStableQuoteMint(mint), false, `${name} overlap`);
  }
  // The hardcoded mint lists themselves agree, not just their lookups.
  for (const list of ['SOL_LIKE_QUOTE_MINTS', 'STABLE_QUOTE_MINTS']) {
    assert.deepEqual(
      built[list].map((mint) => mint.toBase58()),
      original[list].map((mint) => mint.toBase58()),
      list);
  }
});
