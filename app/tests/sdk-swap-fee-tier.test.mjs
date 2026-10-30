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
const tier = (threshold, lp, protocol, creator) => ({ marketCapLamportsThreshold: new BN(threshold), fees: fees(lp, protocol, creator) });
const tiers = [tier(0, 1, 2, 3), tier(1000, 10, 20, 30), tier(5000, 100, 200, 300)];

test('rebuilt swap calculateFeeTier matches published across tier boundaries', () => {
  const original = require(join(published, 'swap/index.js'));
  const built = require(join(root, 'packages/sdk/dist/swap/index.js'));
  const eq = (label, runOriginal, runBuilt) => {
    const attempt = (run) => { try { const v = run(); return { lp: v.lpFeeBps.toString(), protocol: v.protocolFeeBps.toString(), creator: v.creatorFeeBps.toString() }; } catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; } };
    assert.deepEqual(attempt(runBuilt), attempt(runOriginal), label);
  };
  for (const cap of [0, 1, 999, 1000, 1001, 4999, 5000, 5001, 1000000]) {
    eq(`cap ${cap}`,
      () => original.calculateFeeTier({ feeTiers: tiers, marketCap: new BN(cap) }),
      () => built.calculateFeeTier({ feeTiers: tiers, marketCap: new BN(cap) }));
  }
  eq('single tier',
    () => original.calculateFeeTier({ feeTiers: [tier(100, 1, 2, 3)], marketCap: new BN(0) }),
    () => built.calculateFeeTier({ feeTiers: [tier(100, 1, 2, 3)], marketCap: new BN(0) }));
  eq('empty tiers',
    () => original.calculateFeeTier({ feeTiers: [], marketCap: new BN(0) }),
    () => built.calculateFeeTier({ feeTiers: [], marketCap: new BN(0) }));
  // Unsorted tiers: selection scans from the top, so order still resolves by threshold.
  const shuffled = [tier(5000, 100, 200, 300), tier(0, 1, 2, 3), tier(1000, 10, 20, 30)];
  for (const cap of [0, 1000, 5000]) {
    eq(`shuffled cap ${cap}`,
      () => original.calculateFeeTier({ feeTiers: shuffled, marketCap: new BN(cap) }),
      () => built.calculateFeeTier({ feeTiers: shuffled, marketCap: new BN(cap) }));
  }
});
