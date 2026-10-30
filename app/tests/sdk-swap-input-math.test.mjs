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
const { PublicKey } = require('@solana/web3.js');
const BN = require('bn.js');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-swap-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

const zero = PublicKey.default;
const key = (byte) => new PublicKey(Buffer.alloc(32, byte));
const fees = (lp, protocol, creator) => ({ lpFeeBps: new BN(lp), protocolFeeBps: new BN(protocol), creatorFeeBps: new BN(creator) });
const globalConfig = {
  admin: zero, lpFeeBasisPoints: new BN(25), protocolFeeBasisPoints: new BN(50),
  disableFlags: 0, protocolFeeRecipients: [zero], coinCreatorFeeBasisPoints: new BN(25),
  adminSetCoinCreatorAuthority: zero, whitelistPda: zero, reservedFeeRecipient: zero,
  mayhemModeEnabled: false, reservedFeeRecipients: [], isCashbackEnabled: false,
  buybackFeeRecipients: [], buybackBasisPoints: new BN(100), boostAuthority: zero,
  boostEnabled: false, creatorFeeConfigurable: true, maxConfigurableCreatorFeeBps: new BN(500),
};
const feeConfig = {
  admin: zero, flatFees: fees(30, 60, 25),
  feeTiers: [{ marketCapLamportsThreshold: new BN(0), fees: fees(25, 50, 25) }],
  stableFeeTiers: [{ marketCapLamportsThreshold: new BN(0), fees: fees(20, 40, 30) }],
  exoticFlatFees: fees(35, 70, 40),
};

const stringify = (value) => {
  if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'BN') return value.toString();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stringify(v)]));
  return value;
};
const attempt = (run) => {
  try {
    return { value: stringify(run()) };
  } catch (error) {
    return { error: `${error.constructor.name}: ${error.message}` };
  }
};
const eq = (label, fn, args) => assert.deepEqual(attempt(() => built[fn](args)), attempt(() => original[fn](args)), label);

test('rebuilt swap pool buy/sell input math matches published', () => {
  const shared = {
    slippage: 1, baseReserve: new BN('1000000000000'), quoteReserve: new BN('30000000000'),
    globalConfig, baseMintAccount: { supply: 1000000000000000n }, baseMint: key(7),
    coinCreator: key(3), creator: key(3), feeConfig,
  };
  const transferFees = [null, { basisPoints: 100, maximumFee: new BN(1000000) }];
  for (const base of ['1', '1000000', '500000000000']) {
    for (const quoteTransferFee of transferFees) {
      eq(`buyBaseInput base=${base} fee=${quoteTransferFee ? quoteTransferFee.basisPoints : 'none'}`, 'buyBaseInput', { ...shared, base: new BN(base), quoteTransferFee });
      eq(`sellBaseInput base=${base} fee=${quoteTransferFee ? quoteTransferFee.basisPoints : 'none'}`, 'sellBaseInput', { ...shared, base: new BN(base), quoteTransferFee });
    }
  }
  for (const quote of ['1000000', '1000000000']) {
    eq(`buyQuoteInput quote=${quote}`, 'buyQuoteInput', { ...shared, quote: new BN(quote) });
    eq(`sellQuoteInput quote=${quote}`, 'sellQuoteInput', { ...shared, quote: new BN(quote) });
  }
  // Error paths agree too: buying more base than the pool holds is rejected.
  eq('buyBaseInput over-reserve errors', 'buyBaseInput', { ...shared, base: new BN('1000000000001') });
  eq('buyBaseInput zero quote reserve errors', 'buyBaseInput', { ...shared, base: new BN('1000'), quoteReserve: new BN(0) });
});
