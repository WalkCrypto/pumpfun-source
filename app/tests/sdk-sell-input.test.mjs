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
const published = mkdtempSync(join(tmpdir(), 'pump-sdk-sell-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const { PublicKey } = require('@solana/web3.js');
const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));
const zero = PublicKey.default;
const other = new PublicKey(new Uint8Array(32).fill(7));
const globalConfig = () => ({
  admin: zero, lpFeeBasisPoints: new BN(25), protocolFeeBasisPoints: new BN(50),
  disableFlags: 0, protocolFeeRecipients: [zero], coinCreatorFeeBasisPoints: new BN(10),
  adminSetCoinCreatorAuthority: zero, whitelistPda: zero, reservedFeeRecipient: zero,
  mayhemModeEnabled: false, reservedFeeRecipients: [], isCashbackEnabled: false,
  buybackFeeRecipients: [], buybackBasisPoints: new BN(0), boostAuthority: zero,
  boostEnabled: false, creatorFeeConfigurable: false, maxConfigurableCreatorFeeBps: new BN(0),
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

test('rebuilt sell base-input math matches published across amounts, slippage, and fees', () => {
  const transferFees = [null, { basisPoints: 100, maximumFee: new BN(1000000) }, { basisPoints: 500, maximumFee: new BN(10) }];
  for (const base of ['1', '1000000', '1000000000', '50000000000']) {
    for (const slippage of [0, 1, 5]) {
      for (const quoteTransferFee of transferFees) {
        eq(`sellBaseInput base=${base} slippage=${slippage} fee=${quoteTransferFee ? quoteTransferFee.basisPoints : 'none'}`, 'sellBaseInput', baseArgs({ base: new BN(base), slippage, quoteTransferFee }));
      }
    }
  }
  eq('sellBaseInput virtual reserves', 'sellBaseInput', baseArgs({ base: new BN('1000000000'), virtualQuoteReserves: new BN('1000000000') }));
  eq('sellBaseInput fee buckets', 'sellBaseInput', baseArgs({ base: new BN('1000000000'), feeBucketsTotal: new BN('1000000000') }));
  eq('sellBaseInput non-default coin creator pays creator fee', 'sellBaseInput', baseArgs({ base: new BN('1000000000'), coinCreator: other }));
  eq('sellBaseInput zero base reserve errors', 'sellBaseInput', baseArgs({ base: new BN('1000000'), baseReserve: new BN(0) }));
  eq('sellBaseInput zero quote reserve errors', 'sellBaseInput', baseArgs({ base: new BN('1000000'), quoteReserve: new BN(0) }));
  eq('sellBaseInput insufficient real reserves errors', 'sellBaseInput', baseArgs({ base: new BN('1000000000'), feeBucketsTotal: new BN('29999999999') }));
});

test('rebuilt sell quote-input math matches published across amounts, slippage, and fees', () => {
  const transferFees = [null, { basisPoints: 100, maximumFee: new BN(1000000) }, { basisPoints: 500, maximumFee: new BN(10) }];
  for (const quote of ['1000000', '100000000', '1000000000']) {
    for (const slippage of [0, 1, 5]) {
      for (const quoteTransferFee of transferFees) {
        eq(`sellQuoteInput quote=${quote} slippage=${slippage} fee=${quoteTransferFee ? quoteTransferFee.basisPoints : 'none'}`, 'sellQuoteInput', baseArgs({ quote: new BN(quote), slippage, quoteTransferFee }));
      }
    }
  }
  eq('sellQuoteInput virtual reserves', 'sellQuoteInput', baseArgs({ quote: new BN('100000000'), virtualQuoteReserves: new BN('1000000000') }));
  eq('sellQuoteInput fee buckets', 'sellQuoteInput', baseArgs({ quote: new BN('100000000'), feeBucketsTotal: new BN('1000000000') }));
  eq('sellQuoteInput non-default coin creator pays creator fee', 'sellQuoteInput', baseArgs({ quote: new BN('100000000'), coinCreator: other }));
  eq('sellQuoteInput zero base reserve errors', 'sellQuoteInput', baseArgs({ quote: new BN('1000000'), baseReserve: new BN(0) }));
  eq('sellQuoteInput quote at reserve errors', 'sellQuoteInput', baseArgs({ quote: new BN('30000000000') }));
  eq('sellQuoteInput insufficient real reserves errors', 'sellQuoteInput', baseArgs({ quote: new BN('100000000'), feeBucketsTotal: new BN('29999999999') }));
});
