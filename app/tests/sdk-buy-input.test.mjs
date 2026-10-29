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
const published = mkdtempSync(join(tmpdir(), 'pump-sdk-buy-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const { PublicKey } = require('@solana/web3.js');
const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));
const zero = PublicKey.default;
const other = new PublicKey(new Uint8Array(32).fill(7));
const globalConfig = (over = {}) => ({
  admin: zero, lpFeeBasisPoints: new BN(25), protocolFeeBasisPoints: new BN(50),
  disableFlags: 0, protocolFeeRecipients: [zero], coinCreatorFeeBasisPoints: new BN(10),
  adminSetCoinCreatorAuthority: zero, whitelistPda: zero, reservedFeeRecipient: zero,
  mayhemModeEnabled: false, reservedFeeRecipients: [], isCashbackEnabled: false,
  buybackFeeRecipients: [], buybackBasisPoints: new BN(0), boostAuthority: zero,
  boostEnabled: false, creatorFeeConfigurable: false, maxConfigurableCreatorFeeBps: new BN(0),
  ...over,
});
const baseArgs = (over = {}) => ({
  slippage: 1, baseReserve: new BN('1000000000000'), quoteReserve: new BN('30000000000'),
  globalConfig: globalConfig(), baseMintAccount: { supply: new BN('1000000000000000') },
  baseMint: other, coinCreator: zero, creator: other, feeConfig: null, ...over,
});
const stringify = (value) => {
  if (value && typeof value === 'object' && typeof value.toString === 'function' && value.constructor && value.constructor.name === 'BN') return value.toString();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stringify(v)]));
  return value;
};
const attempt = (run) => { try { return { value: stringify(run()) }; } catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; } };
const eq = (label, fn, args) => assert.deepEqual(attempt(() => built[fn](args)), attempt(() => original[fn](args)), label);

test('rebuilt buy base-input math matches published across amounts, slippage, and debit variants', () => {
  const transferFees = [null, { basisPoints: 100, maximumFee: new BN(1000000) }, { basisPoints: 500, maximumFee: new BN(10) }];
  for (const base of ['1', '1000000', '1000000000', '100000000000']) {
    for (const slippage of [0, 1, 5]) {
      for (const quoteTransferFee of transferFees) {
        eq(`buyBaseInput base=${base} slippage=${slippage} fee=${quoteTransferFee ? quoteTransferFee.basisPoints : 'none'}`, 'buyBaseInput', baseArgs({ base: new BN(base), slippage, quoteTransferFee }));
      }
    }
  }
  eq('buyBaseInput virtual reserves', 'buyBaseInput', baseArgs({ base: new BN('1000000000'), virtualQuoteReserves: new BN('1000000000') }));
  eq('buyBaseInput non-default coin creator pays creator fee', 'buyBaseInput', baseArgs({ base: new BN('1000000000'), coinCreator: other }));
  eq('buyBaseInput v2 debit with taxed quote', 'buyBaseInput', baseArgs({ base: new BN('1000000000'), tradeV2: true, quoteTransferFee: { basisPoints: 100, maximumFee: new BN(1000000) } }));
  eq('buyBaseInput v2 debit with buyback slice', 'buyBaseInput', baseArgs({ base: new BN('1000000000'), tradeV2: true, globalConfig: globalConfig({ buybackBasisPoints: new BN(1000) }), quoteTransferFee: { basisPoints: 100, maximumFee: new BN(1000000) } }));
  eq('buyBaseInput v2 mayhem debit skips buyback slice', 'buyBaseInput', baseArgs({ base: new BN('1000000000'), tradeV2: true, isMayhemMode: true, globalConfig: globalConfig({ buybackBasisPoints: new BN(1000) }), quoteTransferFee: { basisPoints: 100, maximumFee: new BN(1000000) } }));
  eq('buyBaseInput zero base reserve errors', 'buyBaseInput', baseArgs({ base: new BN('1000000'), baseReserve: new BN(0) }));
  eq('buyBaseInput zero quote reserve errors', 'buyBaseInput', baseArgs({ base: new BN('1000000'), quoteReserve: new BN(0) }));
  eq('buyBaseInput base above reserve errors', 'buyBaseInput', baseArgs({ base: new BN('1000000000001') }));
  eq('buyBaseInput base equal to reserve errors', 'buyBaseInput', baseArgs({ base: new BN('1000000000000') }));
});

test('rebuilt buy quote-input math matches published across amounts, slippage, and debit variants', () => {
  const transferFees = [null, { basisPoints: 100, maximumFee: new BN(1000000) }, { basisPoints: 500, maximumFee: new BN(10) }];
  for (const quote of ['1000000', '100000000', '1000000000']) {
    for (const slippage of [0, 1, 5]) {
      for (const quoteTransferFee of transferFees) {
        eq(`buyQuoteInput quote=${quote} slippage=${slippage} fee=${quoteTransferFee ? quoteTransferFee.basisPoints : 'none'}`, 'buyQuoteInput', baseArgs({ quote: new BN(quote), slippage, quoteTransferFee }));
      }
    }
  }
  eq('buyQuoteInput virtual reserves', 'buyQuoteInput', baseArgs({ quote: new BN('100000000'), virtualQuoteReserves: new BN('1000000000') }));
  eq('buyQuoteInput non-default coin creator pays creator fee', 'buyQuoteInput', baseArgs({ quote: new BN('100000000'), coinCreator: other }));
  eq('buyQuoteInput v2 debit with taxed quote', 'buyQuoteInput', baseArgs({ quote: new BN('100000000'), tradeV2: true, quoteTransferFee: { basisPoints: 100, maximumFee: new BN(1000000) } }));
  eq('buyQuoteInput v2 debit with buyback slice', 'buyQuoteInput', baseArgs({ quote: new BN('100000000'), tradeV2: true, globalConfig: globalConfig({ buybackBasisPoints: new BN(1000) }), quoteTransferFee: { basisPoints: 100, maximumFee: new BN(1000000) } }));
  eq('buyQuoteInput zero base reserve errors', 'buyQuoteInput', baseArgs({ quote: new BN('1000000'), baseReserve: new BN(0) }));
  eq('buyQuoteInput zero quote errors', 'buyQuoteInput', baseArgs({ quote: new BN(0) }));
  eq('buyQuoteInput tiny quote below transfer fee errors', 'buyQuoteInput', baseArgs({ quote: new BN(1), quoteTransferFee: { basisPoints: 10000, maximumFee: new BN(1000000) } }));
});
