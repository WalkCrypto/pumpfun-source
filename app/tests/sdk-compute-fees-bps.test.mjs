import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));
const { PublicKey } = require('@solana/web3.js');
const BN = require('bn.js');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'index.js'));
const built = require(join(root, 'packages/sdk/dist/index.js'));

const zero = PublicKey.default;
const globalFor = () => ({
  initialized: true, authority: zero, feeRecipient: zero,
  initialVirtualTokenReserves: new BN('1073000000000000'),
  initialVirtualSolReserves: new BN('30000000000'),
  initialRealTokenReserves: new BN('793100000000000'),
  tokenTotalSupply: new BN('1000000000000000'),
  feeBasisPoints: new BN(95), withdrawAuthority: zero, enableMigrate: true,
  poolMigrationFee: new BN(0), creatorFeeBasisPoints: new BN(30),
  feeRecipients: [zero], setCreatorAuthority: zero, adminSetCreatorAuthority: zero,
  createV2Enabled: true, whitelistPda: zero, reservedFeeRecipient: zero,
  mayhemModeEnabled: false, reservedFeeRecipients: [], isCashbackEnabled: false,
  buybackFeeRecipients: [], buybackBasisPoints: new BN(0),
  initialVirtualQuoteReserves: new BN('30000000000'), whitelistedQuoteMints: [],
  creatorFeeConfigurable: true, maxConfigurableCreatorFeeBps: new BN(500),
  holderRewardClaimAuthority: zero, isHolderRewardEnabled: false, maxCurveDepth: 2,
});
const fees = (protocol, creator) => ({ lpFeeBps: new BN(0), protocolFeeBps: new BN(protocol), creatorFeeBps: new BN(creator) });
const feeConfigFor = (exotic) => ({
  admin: zero,
  flatFees: fees(60, 25),
  feeTiers: [
    { marketCapLamportsThreshold: new BN(0), fees: fees(95, 30) },
    { marketCapLamportsThreshold: new BN('1000000000000'), fees: fees(50, 20) },
  ],
  stableFeeTiers: [{ marketCapLamportsThreshold: new BN(0), fees: fees(80, 35) }],
  exoticFlatFees: exotic,
});

test('rebuilt computeFeesBps matches published', () => {
  const supply = new BN('1000000000000000');
  const curve = built.newBondingCurve(globalFor());
  const quotes = {
    'SOL (tier schedule)': zero,
    'mainnet USDC (stable schedule)': new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    'devnet USDC (exotic schedule)': new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  };
  const configs = {
    'no fee config (global rates)': null,
    'fee config set': feeConfigFor(fees(70, 40)),
    'fee config with exotic unset (flat fallback)': feeConfigFor(fees(0, 0)),
  };
  for (const [quoteName, quoteMint] of Object.entries(quotes)) {
    for (const [configName, feeConfig] of Object.entries(configs)) {
      for (const creator of [undefined, new BN(0), null, new BN(123)]) {
        const params = {
          global: globalFor(), feeConfig, mintSupply: supply,
          virtualQuoteReserves: curve.virtualQuoteReserves,
          virtualTokenReserves: curve.virtualTokenReserves, quoteMint,
          ...(creator !== undefined ? { creatorFeeBps: creator } : {}),
        };
        const expected = original.computeFeesBps(params);
        const actual = built.computeFeesBps(params);
        assert.equal(actual.protocolFeeBps.toString(), expected.protocolFeeBps.toString(), `${quoteName} ${configName} creator=${creator} protocol`);
        assert.equal(actual.creatorFeeBps.toString(), expected.creatorFeeBps.toString(), `${quoteName} ${configName} creator=${creator} creator`);
      }
    }
  }
  // A per-coin creator rate never overrides when the global disallows it.
  const locked = globalFor();
  locked.creatorFeeConfigurable = false;
  const params = {
    global: locked, feeConfig: feeConfigFor(fees(70, 40)), mintSupply: supply,
    virtualQuoteReserves: curve.virtualQuoteReserves,
    virtualTokenReserves: curve.virtualTokenReserves, quoteMint: zero,
    creatorFeeBps: new BN(123),
  };
  assert.deepEqual(
    [built.computeFeesBps(params).protocolFeeBps.toString(), built.computeFeesBps(params).creatorFeeBps.toString()],
    [original.computeFeesBps(params).protocolFeeBps.toString(), original.computeFeesBps(params).creatorFeeBps.toString()],
    'non-configurable creator override',
  );
});
