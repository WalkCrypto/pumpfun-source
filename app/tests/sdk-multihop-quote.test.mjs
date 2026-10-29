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
const { PublicKey } = require('@solana/web3.js');
const { NATIVE_MINT } = require('@solana/spl-token');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
for (const sub of ['index.js', 'swap/index.js']) writeFileSync(join(published, sub), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), `package/dist/${sub}`]));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

const key = (label) => new PublicKey(createHash('sha256').update(label).digest());
const bn = (value) => new BN(value.toString());
const zero = PublicKey.default;

const globalConfig = {
  admin: key('multihop-admin'), lpFeeBasisPoints: bn(25), protocolFeeBasisPoints: bn(50),
  disableFlags: 0, protocolFeeRecipients: [key('multihop-protocol-recipient')],
  coinCreatorFeeBasisPoints: bn(25), adminSetCoinCreatorAuthority: key('multihop-admin-cc'),
  whitelistPda: zero, reservedFeeRecipient: zero, mayhemModeEnabled: false,
  reservedFeeRecipients: [], isCashbackEnabled: false, buybackFeeRecipients: [],
  buybackBasisPoints: bn(0), boostAuthority: key('multihop-boost'), boostEnabled: false,
  creatorFeeConfigurable: false, maxConfigurableCreatorFeeBps: bn(0),
};
const feeConfig = {
  admin: key('multihop-fee-admin'),
  flatFees: { lpFeeBps: bn(10), protocolFeeBps: bn(10), creatorFeeBps: bn(10) },
  feeTiers: [{ marketCapLamportsThreshold: bn(0), fees: { lpFeeBps: bn(20), protocolFeeBps: bn(30), creatorFeeBps: bn(40) } }],
  stableFeeTiers: [],
  exoticFlatFees: { lpFeeBps: bn(0), protocolFeeBps: bn(0), creatorFeeBps: bn(0) },
};

function pool(baseMint, quoteMint, opts = {}) {
  return {
    poolBump: 255, index: 0,
    creator: original.pumpPoolAuthorityPda(baseMint),
    baseMint, quoteMint, lpMint: key(`multihop-lp-${baseMint.toBase58().slice(0, 8)}`),
    poolBaseTokenAccount: key('multihop-pool-base-account'),
    poolQuoteTokenAccount: key('multihop-pool-quote-account'),
    lpSupply: bn('1000000000000'), coinCreator: opts.coinCreator ?? key('multihop-coin-creator'),
    isMayhemMode: opts.isMayhemMode ?? false, isCashbackCoin: opts.isCashbackCoin ?? false,
    virtualQuoteReserves: bn(opts.virtual ?? '100000000'),
    creatorFeeBps: bn(0), canEditCreatorFee: false, isHolderReward: false,
    protocolFees: bn(opts.protocolFees ?? 0), creatorFees: bn(opts.creatorFees ?? 0),
  };
}
function poolHop(p, baseReserve, quoteAmount, opts = {}) {
  return {
    kind: 'pool', poolKey: key(`multihop-poolkey-${p.baseMint.toBase58().slice(0, 8)}`), pool: p,
    baseTokenProgram: key('multihop-base-program'), quoteTokenProgram: key('multihop-quote-program'),
    poolBaseAmount: bn(baseReserve), poolQuoteAmount: bn(quoteAmount),
    baseMintSupply: bn('1000000000000000'), quoteTransferFee: opts.quoteTransferFee ?? null,
  };
}
function curveHop(baseMint, quoteMint) {
  return {
    kind: 'curve', baseMint, quoteMint,
    baseTokenProgram: key('multihop-base-program'), quoteTokenProgram: key('multihop-quote-program'),
    quote: (amountIn) => amountIn.muln(2),
  };
}

const mintA = key('multihop-mint-A'), mintB = key('multihop-mint-B'), mintC = key('multihop-mint-C');
const mintD = key('multihop-mint-D'), mintE = key('multihop-mint-E'), mintF = key('multihop-mint-F'), mintG = key('multihop-mint-G');
const hopAB = () => poolHop(pool(mintA, mintB), '1000000000', '500000000');
const hopCA = () => poolHop(pool(mintC, mintA), '2000000000', '800000000');

const attempt = (run, args) => {
  try {
    const result = run(args);
    return { amountOut: result.amountOut.toString(), minAmountOut: result.minAmountOut.toString(), hopAmountsOut: result.hopAmountsOut.map((x) => x.toString()) };
  } catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; }
};
const eq = (label, args) => assert.deepEqual(
  attempt((a) => built.multiHopSwapQuote(a), args),
  attempt((a) => original.multiHopSwapQuote(a), args),
  label,
);

test('rebuilt multi-hop pool quotes match published across amounts and slippage', () => {
  for (const amount of ['1', '1000', '1000000', '100000000', '1000000000']) {
    eq(`single buy ${amount}`, { inMint: mintB, hops: [hopAB()], amountIn: bn(amount), slippage: 1, globalConfig, feeConfig: null });
    eq(`single sell ${amount}`, { inMint: mintA, hops: [hopAB()], amountIn: bn(amount), slippage: 1, globalConfig, feeConfig: null });
  }
  for (const slippage of [0, 1, 10, 100]) {
    eq(`buy slippage ${slippage}`, { inMint: mintB, hops: [hopAB()], amountIn: bn('100000000'), slippage, globalConfig, feeConfig: null });
  }
});

test('rebuilt multi-hop routes match published across chains, fees, and curve hops', () => {
  eq('two-hop buy', { inMint: mintB, hops: [hopAB(), hopCA()], amountIn: bn('100000000'), slippage: 1, globalConfig, feeConfig: null });
  eq('two-hop sell', { inMint: mintB, hops: [poolHop(pool(mintB, mintA), '1000000000', '500000000'), poolHop(pool(mintA, mintC), '2000000000', '800000000')], amountIn: bn('1000000'), slippage: 2, globalConfig, feeConfig: null });
  eq('buy with transfer fee', { inMint: mintB, hops: [poolHop(pool(mintA, mintB), '1000000000', '500000000', { quoteTransferFee: { basisPoints: 100, maximumFee: bn('1000000') } })], amountIn: bn('100000000'), slippage: 1, globalConfig, feeConfig: null });
  eq('sell with transfer fee', { inMint: mintA, hops: [poolHop(pool(mintA, mintB), '1000000000', '500000000', { quoteTransferFee: { basisPoints: 100, maximumFee: bn('1000000') } })], amountIn: bn('1000000'), slippage: 1, globalConfig, feeConfig: null });
  eq('buy with feeConfig SOL quote', { inMint: NATIVE_MINT, hops: [poolHop(pool(mintA, NATIVE_MINT), '1000000000', '500000000')], amountIn: bn('100000000'), slippage: 1, globalConfig, feeConfig });
  eq('buy with feeConfig exotic quote', { inMint: mintB, hops: [hopAB()], amountIn: bn('100000000'), slippage: 1, globalConfig, feeConfig });
  eq('curve hop buy', { inMint: mintB, hops: [curveHop(mintA, mintB), hopCA()], amountIn: bn('1000000'), slippage: 1, globalConfig, feeConfig: null });
  eq('curve hop sell', { inMint: mintA, hops: [curveHop(mintA, mintB), poolHop(pool(mintB, mintC), '1000000000', '500000000')], amountIn: bn('1000000'), slippage: 1, globalConfig, feeConfig: null });
  eq('buy with zero coin creator', { inMint: mintB, hops: [poolHop(pool(mintA, mintB, { coinCreator: zero }), '1000000000', '500000000')], amountIn: bn('100000000'), slippage: 1, globalConfig, feeConfig: null });
  eq('six-hop three pools valid', { inMint: mintB, hops: [hopAB(), curveHop(mintC, mintA), poolHop(pool(mintD, mintC), '1000000000', '500000000'), curveHop(mintE, mintD), poolHop(pool(mintF, mintE), '1000000000', '500000000'), curveHop(mintG, mintF)], amountIn: bn('1000000'), slippage: 1, globalConfig, feeConfig: null });
});

test('rebuilt multi-hop quote rejections match published', () => {
  eq('amountIn zero', { inMint: mintB, hops: [hopAB()], amountIn: bn(0), slippage: 1, globalConfig, feeConfig: null });
  eq('amountIn negative', { inMint: mintB, hops: [hopAB()], amountIn: bn(-5), slippage: 1, globalConfig, feeConfig: null });
  eq('empty hops', { inMint: mintB, hops: [], amountIn: bn(1000), slippage: 1, globalConfig, feeConfig: null });
  eq('discontinuous', { inMint: mintB, hops: [hopAB(), poolHop(pool(mintC, key('multihop-mint-X')), '1000000000', '500000000')], amountIn: bn(1000), slippage: 1, globalConfig, feeConfig: null });
  eq('mixed direction', { inMint: mintB, hops: [hopAB(), poolHop(pool(mintA, mintC), '1000000000', '500000000')], amountIn: bn(1000), slippage: 1, globalConfig, feeConfig: null });
  eq('seven hops', { inMint: mintB, hops: Array.from({ length: 7 }, () => hopAB()), amountIn: bn(1000), slippage: 1, globalConfig, feeConfig: null });
  eq('six-hop four pools rejected', { inMint: mintB, hops: [hopAB(), poolHop(pool(mintC, mintA), '1000000000', '500000000'), poolHop(pool(mintD, mintC), '1000000000', '500000000'), poolHop(pool(mintE, mintD), '1000000000', '500000000'), curveHop(mintF, mintE), curveHop(mintG, mintF)], amountIn: bn('1000000'), slippage: 1, globalConfig, feeConfig: null });
  eq('mayhem hop', { inMint: mintB, hops: [poolHop(pool(mintA, mintB, { isMayhemMode: true }), '1000000000', '500000000')], amountIn: bn(1000), slippage: 1, globalConfig, feeConfig: null });
  eq('non-canonical hop', { inMint: mintB, hops: [poolHop({ ...pool(mintA, mintB), creator: key('multihop-not-canonical') }, '1000000000', '500000000')], amountIn: bn(1000), slippage: 1, globalConfig, feeConfig: null });
  eq('single cashback buy rejected', { inMint: mintB, hops: [poolHop(pool(mintA, mintB, { isCashbackCoin: true }), '1000000000', '500000000')], amountIn: bn(1000), slippage: 1, globalConfig, feeConfig: null });
  eq('sell insufficient real reserves', { inMint: mintA, hops: [poolHop(pool(mintA, mintB), '1000000000', '1000')], amountIn: bn('100000000'), slippage: 1, globalConfig, feeConfig: null });
});
