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
const BN=require('bn.js');
const published=mkdtempSync(join(tmpdir(),'pump-sdk-reference-'));
mkdirSync(join(published,'swap'));
symlinkSync(join(root,'packages/sdk/node_modules'),join(published,'node_modules'),process.platform==='win32'?'junction':'dir');
for(const sub of ['index.js','swap/index.js'])writeFileSync(join(published,sub),execFileSync('tar',['-xOf',join(root,'evidence/sdk/pump-sdk-4.3.1.tgz'),`package/dist/${sub}`]));
process.on('exit',()=>rmSync(published,{recursive:true,force:true}));
const fees = (lp, protocol, creator) => ({ lpFeeBps: new BN(lp), protocolFeeBps: new BN(protocol), creatorFeeBps: new BN(creator) });

test('rebuilt swap isZeroFees matches published across zero and nonzero fields', () => {
  const original = require(join(published, 'swap/index.js'));
  const built = require(join(root, 'packages/sdk/dist/swap/index.js'));
  const eq = (label, value) => assert.equal(built.isZeroFees(value), original.isZeroFees(value), label);
  // All-zero is the only true case: it is how pump-fees marks exoticFlatFees unset,
  // so feesForQuoteMint falls back to flatFees on exactly this input.
  eq('all zero', fees(0, 0, 0));
  // Each single nonzero field defeats the unset mark, even at 1 bps.
  eq('lp only', fees(1, 0, 0));
  eq('protocol only', fees(0, 1, 0));
  eq('creator only', fees(0, 0, 1));
  // All nonzero, and large values, stay false.
  eq('all nonzero', fees(100, 200, 300));
  eq('large values', fees('100000000000000000000', '9999', '500'));
  // A negative field is nonzero, not unset.
  eq('negative lp', fees(-1, 0, 0));
  eq('negative creator', fees(0, 0, -5));
});
