import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(new URL('../packages/sdk/package.json',import.meta.url));
const published=mkdtempSync(join(tmpdir(),'pump-sdk-reference-'));
mkdirSync(join(published,'swap'));
symlinkSync(join(root,'packages/sdk/node_modules'),join(published,'node_modules'),process.platform==='win32'?'junction':'dir');
for(const sub of ['index.js','swap/index.js'])writeFileSync(join(published,sub),execFileSync('tar',['-xOf',join(root,'evidence/sdk/pump-sdk-4.3.1.tgz'),`package/dist/${sub}`]));
process.on('exit',()=>rmSync(published,{recursive:true,force:true}));
const { PublicKey } = require('@solana/web3.js');
const probe = (label) => new PublicKey(createHash('sha256').update(`pump-sdk-pda-probe-${label}`).digest());
const keys = [probe('a'), probe('b'), probe('c'), PublicKey.default];

test('rebuilt remaining swap derivations match published', () => {
  const original = require(join(published, 'swap/index.js'));
  const built = require(join(root, 'packages/sdk/dist/swap/index.js'));
  const eq = (label, a, b) => assert.equal(a.toBase58(), b.toBase58(), label);
  for (const fn of ['pumpPoolAuthorityPda', 'holderRewardsPda', 'bondingCurvePda', 'userVolumeAccumulatorPda', 'feeSharingConfigPda', 'boostVaultAuthorityPda']) {
    for (const key of keys) eq(`${fn} ${key.toBase58()}`, built[fn](key), original[fn](key));
  }
  // canonicalPumpPoolPda composes poolPda with the pool-authority PDA and the
  // zero-key-to-WSOL mapping, so both quote-mint spellings must agree.
  for (const mint of keys) {
    for (const quote of [PublicKey.default, probe('quote'), probe('quote2')]) {
      eq(`canonicalPumpPoolPda ${mint.toBase58()} ${quote.toBase58()}`, built.canonicalPumpPoolPda(mint, quote), original.canonicalPumpPoolPda(mint, quote));
    }
    eq(`canonicalPumpPoolPda default quote ${mint.toBase58()}`, built.canonicalPumpPoolPda(mint), original.canonicalPumpPoolPda(mint));
  }
});
