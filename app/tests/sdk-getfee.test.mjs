import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));
const BN = require('bn.js');
const { PublicKey } = require('@solana/web3.js');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'index.js'));
const built = require(join(root, 'packages/sdk/dist/index.js'));

const bn = (value) => new BN(value.toString());
const zero = PublicKey.default;
const key = (label) => new PublicKey(createHash('sha256').update(label).digest());
const supply = bn('1000000000000000');

const globalFor = () => ({
  initialized: true, authority: zero, feeRecipient: zero,
  initialVirtualTokenReserves: bn('1073000000000000'), initialVirtualSolReserves: bn('30000000000'),
  initialRealTokenReserves: bn('793100000000000'), tokenTotalSupply: supply,
  feeBasisPoints: bn(95), withdrawAuthority: zero, enableMigrate: true, poolMigrationFee: bn(0),
  creatorFeeBasisPoints: bn(30), feeRecipients: [zero], setCreatorAuthority: zero,
  adminSetCreatorAuthority: zero, createV2Enabled: true, whitelistPda: zero,
  reservedFeeRecipient: zero, mayhemModeEnabled: false, reservedFeeRecipients: [],
  isCashbackEnabled: false, buybackFeeRecipients: [], buybackBasisPoints: bn(0),
  initialVirtualQuoteReserves: bn('30000000000'), whitelistedQuoteMints: [],
  creatorFeeConfigurable: true, maxConfigurableCreatorFeeBps: bn(500),
  holderRewardClaimAuthority: zero, isHolderRewardEnabled: false, maxCurveDepth: 2,
});
const feeConfig = {
  admin: zero,
  flatFees: { lpFeeBps: bn(10), protocolFeeBps: bn(10), creatorFeeBps: bn(10) },
  feeTiers: [{ marketCapLamportsThreshold: bn(0), fees: { lpFeeBps: bn(20), protocolFeeBps: bn(30), creatorFeeBps: bn(40) } }],
  stableFeeTiers: [],
  exoticFlatFees: { lpFeeBps: bn(0), protocolFeeBps: bn(0), creatorFeeBps: bn(0) },
};
const freshCurve = () => original.newBondingCurve(globalFor());

const attempt = (run, args) => {
  try { return run(args).toString(); }
  catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; }
};
const eq = (label, args) => assert.deepEqual(
  attempt((a) => built.getFee(a), args),
  attempt((a) => original.getFee(a), args),
  label,
);

test('rebuilt getFee matches published across amounts, schedules, and curve states', () => {
  for (const amount of ['0', '1', '99', '100', '10000', '1000000000', '1000000000000000']) {
    for (const isNewBondingCurve of [true, false]) {
      eq(`fresh schedule amt=${amount} new=${isNewBondingCurve}`, { global: globalFor(), feeConfig, mintSupply: supply, bondingCurve: freshCurve(), amount: bn(amount), isNewBondingCurve });
      eq(`fresh global-fallback amt=${amount} new=${isNewBondingCurve}`, { global: globalFor(), feeConfig: null, mintSupply: supply, bondingCurve: freshCurve(), amount: bn(amount), isNewBondingCurve });
    }
  }
  const withCreator = freshCurve(); withCreator.creator = key('getfee-creator');
  for (const amount of ['100', '1000000000']) {
    for (const isNewBondingCurve of [true, false]) {
      eq(`creator-set amt=${amount} new=${isNewBondingCurve}`, { global: globalFor(), feeConfig, mintSupply: supply, bondingCurve: withCreator, amount: bn(amount), isNewBondingCurve });
    }
  }
  const withRate = freshCurve(); withRate.creator = key('getfee-creator'); withRate.creatorFeeBps = bn(200);
  for (const amount of ['100', '1000000000']) {
    eq(`creator-rate-200 amt=${amount}`, { global: globalFor(), feeConfig, mintSupply: supply, bondingCurve: withRate, amount: bn(amount), isNewBondingCurve: false });
  }
  const mayhem = freshCurve(); mayhem.isMayhemMode = true;
  for (const amount of ['100', '1000000000']) {
    eq(`mayhem amt=${amount}`, { global: globalFor(), feeConfig, mintSupply: supply, bondingCurve: mayhem, amount: bn(amount), isNewBondingCurve: false });
  }
  const gateOff = globalFor(); gateOff.creatorFeeConfigurable = false;
  eq('gate-off creator-rate-200', { global: gateOff, feeConfig, mintSupply: supply, bondingCurve: withRate, amount: bn('1000000000'), isNewBondingCurve: false });
});
