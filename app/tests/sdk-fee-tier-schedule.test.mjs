import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));
const BN = require('bn.js');
const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
for (const sub of ['index.js', 'swap/index.js']) writeFileSync(join(published, sub), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), `package/dist/${sub}`]));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

test('rebuilt fee-tier and fee-schedule selection match published across boundaries', () => {
  const { PublicKey } = require('@solana/web3.js');
  const original = require(join(published, 'index.js'));
  const built = require(join(root, 'packages/sdk/dist/index.js'));
  const fees = (lp, protocol, creator) => ({ lpFeeBps: new BN(lp), protocolFeeBps: new BN(protocol), creatorFeeBps: new BN(creator) });
  const tier = (threshold, f) => ({ marketCapLamportsThreshold: new BN(threshold), fees: f });
  const tiers = [tier(0, fees(10, 20, 30)), tier(1000, fees(11, 21, 31)), tier(5000, fees(12, 22, 32))];
  const stableTiers = [tier(0, fees(40, 50, 60)), tier(2000, fees(41, 51, 61))];
  const show = (v) => `${v.lpFeeBps}/${v.protocolFeeBps}/${v.creatorFeeBps}`;
  const eq = (label, runOriginal, runBuilt) => {
    const attempt = (run) => { try { return { value: show(run()) }; } catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; } };
    assert.deepEqual(attempt(runBuilt), attempt(runOriginal), label);
  };

  // Tier boundaries: below first, at each threshold, between tiers, above last.
  for (const cap of ['0', '999', '1000', '4999', '5000', '999999']) {
    eq(`calculateFeeTier ${cap}`,
      () => original.calculateFeeTier({ feeTiers: tiers, marketCap: new BN(cap) }),
      () => built.calculateFeeTier({ feeTiers: tiers, marketCap: new BN(cap) }));
  }
  // A single tier serves every market cap; an empty list errors on both sides.
  eq('calculateFeeTier single tier',
    () => original.calculateFeeTier({ feeTiers: [tier(100, fees(1, 2, 3))], marketCap: new BN(0) }),
    () => built.calculateFeeTier({ feeTiers: [tier(100, fees(1, 2, 3))], marketCap: new BN(0) }));
  eq('calculateFeeTier empty tiers',
    () => original.calculateFeeTier({ feeTiers: [], marketCap: new BN(0) }),
    () => built.calculateFeeTier({ feeTiers: [], marketCap: new BN(0) }));

  const base = {
    admin: PublicKey.default, flatFees: fees(1, 2, 3),
    feeTiers: tiers, stableFeeTiers: stableTiers, exoticFlatFees: fees(0, 0, 0),
  };
  const usdc = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  const exotic = new PublicKey(createHash('sha256').update('exotic-quote-probe').digest());
  const cases = [
    ['SOL-like zero key, mid tier', PublicKey.default, base, '1500'],
    ['SOL-like zero key, top tier', PublicKey.default, base, '5000'],
    ['listed stable, low tier', usdc, base, '1500'],
    ['listed stable, high tier', usdc, base, '5000'],
    // Predate-stable accounts carry an empty stable list and fall back to SOL tiers.
    ['listed stable, empty stable tiers', usdc, { ...base, stableFeeTiers: [] }, '1500'],
    // Unset exotic schedule (all zero) falls back to flat fees.
    ['exotic, unset schedule', exotic, base, '1500'],
    ['exotic, set schedule', exotic, { ...base, exoticFlatFees: fees(7, 8, 9) }, '1500'],
  ];
  for (const [label, quoteMint, feeConfig, cap] of cases) {
    eq(`selectCurveFeeSchedule ${label}`,
      () => original.selectCurveFeeSchedule({ feeConfig, quoteMint, marketCap: new BN(cap) }),
      () => built.selectCurveFeeSchedule({ feeConfig, quoteMint, marketCap: new BN(cap) }));
  }
});
