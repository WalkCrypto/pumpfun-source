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
const { NATIVE_MINT, NATIVE_MINT_2022 } = require('@solana/spl-token');

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

const globalFor = (whitelistedQuoteMints = []) => ({
  initialized: true, authority: zero, feeRecipient: zero,
  initialVirtualTokenReserves: bn('1073000000000000'), initialVirtualSolReserves: bn('30000000000'),
  initialRealTokenReserves: bn('793100000000000'), tokenTotalSupply: supply,
  feeBasisPoints: bn(95), withdrawAuthority: zero, enableMigrate: true, poolMigrationFee: bn(0),
  creatorFeeBasisPoints: bn(30), feeRecipients: [zero], setCreatorAuthority: zero,
  adminSetCreatorAuthority: zero, createV2Enabled: true, whitelistPda: zero,
  reservedFeeRecipient: zero, mayhemModeEnabled: false, reservedFeeRecipients: [],
  isCashbackEnabled: false, buybackFeeRecipients: [], buybackBasisPoints: bn(0),
  initialVirtualQuoteReserves: bn('30000000000'), whitelistedQuoteMints,
  creatorFeeConfigurable: true, maxConfigurableCreatorFeeBps: bn(500),
  holderRewardClaimAuthority: zero, isHolderRewardEnabled: false, maxCurveDepth: 2,
});
const quoteControl = (mints) => ({ admin: zero, reservesAdmin: zero, reserved: [], mints });
const mintA = key('initial-virtual-quote-A');
const mintB = key('initial-virtual-quote-B');

const attempt = (run, args) => {
  try { return run(...args).toString(); }
  catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; }
};
const eq = (label, args) => assert.deepEqual(
  attempt(built.initialVirtualQuoteReservesFor, args),
  attempt(original.initialVirtualQuoteReservesFor, args),
  label,
);

test('rebuilt initialVirtualQuoteReservesFor matches published across admission paths', () => {
  eq('legacy zero key', [globalFor(), zero]);
  eq('legacy WSOL', [globalFor(), NATIVE_MINT]);
  eq('token-2022 native rejected', [globalFor(), NATIVE_MINT_2022]);
  eq('whitelist hit', [globalFor([mintA]), mintA]);
  eq('whitelist miss with no lists', [globalFor(), mintA]);
  eq('quoteControl hit', [globalFor(), mintA, quoteControl([{ mint: mintA, initialVirtualQuoteReserves: bn('42000000000') }])]);
  eq('quoteControl miss', [globalFor(), mintA, quoteControl([{ mint: mintB, initialVirtualQuoteReserves: bn('42000000000') }])]);
  eq('quoteControl null', [globalFor(), mintA, null]);
  eq('caller quoteControl beats pumpQuote quoteControl', [globalFor(), mintA,
    quoteControl([{ mint: mintA, initialVirtualQuoteReserves: bn('111') }]),
    { mint: mintA, bondingCurve: original.newBondingCurve(globalFor()), quoteControl: quoteControl([{ mint: mintA, initialVirtualQuoteReserves: bn('222') }]) }]);
  eq('pumpQuote quoteControl fallback', [globalFor(), mintA, undefined,
    { mint: mintA, bondingCurve: original.newBondingCurve(globalFor()), quoteControl: quoteControl([{ mint: mintA, initialVirtualQuoteReserves: bn('222') }]) }]);
  eq('pumpQuote mint mismatch', [globalFor(), mintA, undefined,
    { mint: mintB, bondingCurve: original.newBondingCurve(globalFor()) }]);
  eq('pumpQuote depth-0 chain', [globalFor(), mintA, undefined,
    { mint: mintA, bondingCurve: original.newBondingCurve(globalFor()) }]);
});
