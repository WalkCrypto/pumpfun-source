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

const key = (label) => new PublicKey(createHash('sha256').update(`sdk-error-${label}`).digest());

test('rebuilt SDK error classes match published', () => {
  // The differential tests cover the functions that throw these errors, but
  // never the error classes themselves: a drifted message would break every
  // caller that matches on it while the suite stays green.
  const cases = [
    ['NoShareholdersError', []],
    ['TooManyShareholdersError', [9, 8]],
    ['ZeroShareError', ['addr-1']],
    ['ShareCalculationOverflowError', []],
    ['InvalidShareTotalError', [9999]],
    ['DuplicateShareholderError', []],
    ['PoolRequiredForGraduatedError', []],
    ['UnsupportedQuoteMintError', [key('mint')]],
    ['CreatorFeeNotConfigurableError', []],
    ['CreatorFeeBpsOutOfRangeError', [new BN(600), new BN(500)]],
    ['CreatorFeeNotAllowedForCashbackCoinError', [key('mint')]],
    ['CashbackDeprecatedError', [key('mint')]],
    ['CashbackCoinNotSupportedError', [key('mint')]],
    ['CreatorFeeNotConfigurableForQuoteError', [key('mint')]],
    ['CtoNotAllowedForMayhemCoinError', [key('mint')]],
    ['CurveDepthExceededError', [6, 5]],
    ['HolderRewardCreatorImmutableError', [key('mint')]],
    ['HolderRewardDisabledError', []],
    ['QuoteBondingCurveNotEligibleError', [key('mint')]],
    ['QuoteCurveAwaitingMigrationError', [key('mint')]],
    ['QuotePoolNotFoundError', [key('mint'), key('pool')]],
    ['QuoteReservesOutOfRangeError', [key('mint'), new BN(0)]],
  ];
  for (const [name, args] of cases) {
    const actual = new built[name](...args);
    const expected = new original[name](...args);
    assert.ok(actual instanceof Error, `${name} is an Error`);
    assert.equal(actual.name, expected.name, `${name} name`);
    assert.equal(actual.message, expected.message, `${name} message`);
  }
});
