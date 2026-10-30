import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
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
const key = (label) => new PublicKey(createHash('sha256').update(`pump-quote-${label}`).digest());
const bn = (value) => new BN(value.toString());
const globalFor = (maxCurveDepth = 2) => ({
  initialized: true, authority: zero, feeRecipient: zero,
  initialVirtualTokenReserves: bn('1073000000000000'), initialVirtualSolReserves: bn('30000000000'),
  initialRealTokenReserves: bn('793100000000000'), tokenTotalSupply: bn('1000000000000000'),
  feeBasisPoints: bn(95), withdrawAuthority: zero, enableMigrate: true, poolMigrationFee: bn(0),
  creatorFeeBasisPoints: bn(30), feeRecipients: [zero], setCreatorAuthority: zero,
  adminSetCreatorAuthority: zero, createV2Enabled: true, whitelistPda: zero,
  reservedFeeRecipient: zero, mayhemModeEnabled: false, reservedFeeRecipients: [],
  isCashbackEnabled: false, buybackFeeRecipients: [], buybackBasisPoints: bn(0),
  initialVirtualQuoteReserves: bn('30000000000'), whitelistedQuoteMints: [],
  creatorFeeConfigurable: true, maxConfigurableCreatorFeeBps: bn(500),
  holderRewardClaimAuthority: zero, isHolderRewardEnabled: false, maxCurveDepth,
});
const quoteControl = (mints) => ({ admin: zero, reservesAdmin: zero, reserved: [], mints });

const attempt = (run) => {
  try {
    const result = run();
    return { virtualQuoteReserves: result.virtualQuoteReserves.toString(), depth: result.depth };
  } catch (error) {
    return { error: `${error.constructor.name}: ${error.message}` };
  }
};
const eq = (label, global, quote, control) => assert.deepEqual(
  attempt(() => built.pumpQuoteReserves(global, quote, control)),
  attempt(() => original.pumpQuoteReserves(global, quote, control)),
  label,
);

test('rebuilt pumpQuoteReserves matches published', () => {
  const fresh = () => built.newBondingCurve(globalFor());
  const qMint = key('Q');
  const rMint = key('R');
  const nestedCurve = { ...fresh(), depth: 1, quoteMint: rMint };
  // Distinct reserves from Q's curve, so the two chain hops do not commute
  // and the hop order is actually pinned by the test.
  const rootCurve = { ...fresh(), virtualQuoteReserves: fresh().virtualQuoteReserves.muln(2), virtualTokenReserves: fresh().virtualTokenReserves.divn(2) };

  // #1899 covers initialVirtualQuoteReservesFor's pump-quote path (depth-0
  // only); this test covers pumpQuoteReserves itself: chain hops, the
  // admission gates, and the migrated-pool path.
  eq('depth-0 fresh curve', globalFor(), { mint: qMint, bondingCurve: fresh() }, undefined);
  eq('depth-1 chain with SOL root', globalFor(), { mint: qMint, bondingCurve: nestedCurve, chain: [{ mint: rMint, bondingCurve: rootCurve }] }, undefined);
  eq('mayhem Q rejected', globalFor(), { mint: qMint, bondingCurve: { ...fresh(), isMayhemMode: true } }, undefined);
  eq('depth gate exceeded', globalFor(2), { mint: qMint, bondingCurve: { ...fresh(), depth: 5 } }, undefined);
  eq('complete unmigrated Q rejected', globalFor(), { mint: qMint, bondingCurve: { ...fresh(), complete: true } }, undefined);
  eq('chain mint mismatch', globalFor(), { mint: qMint, bondingCurve: nestedCurve, chain: [{ mint: key('X'), bondingCurve: rootCurve }] }, undefined);
  eq('nested Q without chain', globalFor(), { mint: qMint, bondingCurve: nestedCurve }, undefined);

  const migratedCurve = { ...fresh(), realQuoteReserves: bn(0), virtualQuoteReserves: bn(0), realTokenReserves: bn(0), virtualTokenReserves: bn(0) };
  eq('migrated Q with pool', globalFor(), {
    mint: qMint, bondingCurve: migratedCurve,
    pool: { baseReserves: bn('500000000000'), quoteReserves: bn('20000000000'), virtualQuoteReserves: bn('1000000000') },
  }, undefined);
  eq('migrated Q without pool', globalFor(), { mint: qMint, bondingCurve: migratedCurve }, undefined);

  const qcMint = key('QC');
  const qcRoot = { ...fresh(), quoteMint: qcMint };
  const qcChain = { mint: qMint, bondingCurve: nestedCurve, chain: [{ mint: rMint, bondingCurve: qcRoot }] };
  eq('root quote-control hit', globalFor(), qcChain, quoteControl([{ mint: qcMint, initialVirtualQuoteReserves: bn('42000000000') }]));
  eq('root quote-control miss', globalFor(), qcChain, quoteControl([{ mint: key('other'), initialVirtualQuoteReserves: bn('42000000000') }]));
});
