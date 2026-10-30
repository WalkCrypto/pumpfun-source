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
const fees = (lp, protocol, creator) => ({ lpFeeBps: new BN(lp), protocolFeeBps: new BN(protocol), creatorFeeBps: new BN(creator) });
const feeConfigFor = (overrides) => ({
  admin: zero, flatFees: fees(30, 60, 25),
  feeTiers: [
    { marketCapLamportsThreshold: new BN(0), fees: fees(25, 50, 25) },
    { marketCapLamportsThreshold: new BN('1000000000000'), fees: fees(15, 30, 20) },
  ],
  stableFeeTiers: [{ marketCapLamportsThreshold: new BN(0), fees: fees(20, 40, 30) }],
  exoticFlatFees: fees(35, 70, 40),
  ...overrides,
});

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
const eq = (label, args) => assert.deepEqual(
  attempt(() => built.feesForQuoteMint(args)),
  attempt(() => original.feesForQuoteMint(args)),
  label,
);

test('rebuilt swap feesForQuoteMint matches published', () => {
  const quotes = {
    'SOL': zero,
    'mainnet USDC': new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    'devnet USDC (exotic)': new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  };
  const configs = {
    'full config': feeConfigFor({}),
    'stable tiers empty (falls back to SOL tiers)': feeConfigFor({ stableFeeTiers: [] }),
    'exotic unset (falls back to flat fees)': feeConfigFor({ exoticFlatFees: fees(0, 0, 0) }),
  };
  for (const [quoteName, quoteMint] of Object.entries(quotes)) {
    for (const isPumpPool of [true, false]) {
      for (const [configName, feeConfig] of Object.entries(configs)) {
        for (const marketCap of ['0', '500000000000', '2000000000000']) {
          eq(`${quoteName} pump=${isPumpPool} ${configName} cap=${marketCap}`, { feeConfig, isPumpPool, marketCap: new BN(marketCap), quoteMint });
        }
      }
    }
  }
  // Non-pump pools always pay flat fees regardless of quote or market cap.
  // Empty SOL tiers throw with the same message on both sides.
  eq('empty tiers throws', { feeConfig: feeConfigFor({ feeTiers: [] }), isPumpPool: true, marketCap: new BN(0), quoteMint: zero });
});
