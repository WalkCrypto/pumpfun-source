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
const balance = bn('1000000000000000');

const attempt = (run, args) => {
  try { return run(args).toString(); }
  catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; }
};
const eqQuote = (label, curve, amount, quoteTransferFee = null) => assert.deepEqual(
  attempt((a) => built.getBuyV3QuoteAmountFromTokenAmount(a), { global: globalFor(), feeConfig, mintSupply: supply, bondingCurve: curve, amount: bn(amount), curveBaseTokenBalance: balance, quoteTransferFee }),
  attempt((a) => original.getBuyV3QuoteAmountFromTokenAmount(a), { global: globalFor(), feeConfig, mintSupply: supply, bondingCurve: curve, amount: bn(amount), curveBaseTokenBalance: balance, quoteTransferFee }),
  label,
);
const eqTokens = (label, curve, amount, quoteTransferFee = null) => assert.deepEqual(
  attempt((a) => built.getBuyV3TokenAmountFromQuoteAmount(a), { global: globalFor(), feeConfig, mintSupply: supply, bondingCurve: curve, amount: bn(amount), curveBaseTokenBalance: balance, quoteTransferFee }),
  attempt((a) => original.getBuyV3TokenAmountFromQuoteAmount(a), { global: globalFor(), feeConfig, mintSupply: supply, bondingCurve: curve, amount: bn(amount), curveBaseTokenBalance: balance, quoteTransferFee }),
  label,
);

test('rebuilt v3 buy quotes match published across amounts and the completion boundary', () => {
  for (const amount of ['0', '1', '1000000', '1000000000', '1000000000000', '793100000000000', '793100000000001', '1000000000000000', '2000000000000000']) {
    eqQuote(`v3 quote-from-tokens ${amount}`, freshCurve(), amount);
  }
  for (const amount of ['0', '1', '1000000', '1000000000', '30000000000', '100000000000', '1000000000000000']) {
    eqTokens(`v3 tokens-from-quote ${amount}`, freshCurve(), amount);
  }
});

test('rebuilt v3 buy quotes match published on curve variants and transfer fees', () => {
  const complete = freshCurve(); complete.complete = true;
  eqQuote('v3 complete quote-from-tokens', complete, '1000000');
  eqTokens('v3 complete tokens-from-quote', complete, '1000000');
  const mayhem = freshCurve(); mayhem.isMayhemMode = true;
  eqQuote('v3 mayhem quote-from-tokens above remaining', mayhem, '1000000000000000');
  const empty = freshCurve(); empty.virtualTokenReserves = bn(0);
  eqQuote('v3 zero virtual tokens', empty, '1000000');
  const mid = freshCurve();
  mid.virtualTokenReserves = bn('536500000000000');
  mid.realTokenReserves = bn('396550000000000');
  mid.realQuoteReserves = bn('15000000000');
  eqQuote('v3 mid-curve quote-from-tokens', mid, '1000000000');
  eqTokens('v3 mid-curve tokens-from-quote', mid, '1000000000');
  const transferFee = { basisPoints: 250, maximumFee: bn('1000000') };
  eqQuote('v3 transfer-fee quote-from-tokens', freshCurve(), '1000000000', transferFee);
  eqTokens('v3 transfer-fee tokens-from-quote', freshCurve(), '1000000000', transferFee);
});
