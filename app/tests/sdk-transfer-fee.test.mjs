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

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
for (const sub of ['index.js', 'swap/index.js']) writeFileSync(join(published, sub), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), `package/dist/${sub}`]));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

const bn = (value) => new BN(value.toString());

test('rebuilt swap transferFeeOn matches published across fees and amounts', () => {
  const fees = [
    null, undefined,
    { basisPoints: 0, maximumFee: bn(0) },
    { basisPoints: 100, maximumFee: bn('1000000') },
    { basisPoints: 250, maximumFee: bn(100) },
    { basisPoints: 10000, maximumFee: bn('1000000000') },
  ];
  for (const fee of fees) {
    for (const amount of ['0', '1', '99', '100', '101', '9999', '10000', '10001', '1000000000', '123456789012345678901234567890']) {
      assert.equal(
        built.transferFeeOn(fee, bn(amount)).toString(),
        original.transferFeeOn(fee, bn(amount)).toString(),
        `transferFeeOn bps=${fee?.basisPoints} amount=${amount}`,
      );
    }
  }
});

test('rebuilt swap transferFeeAt matches published across the epoch boundary', () => {
  const config = {
    newerTransferFee: { epoch: 100n, maximumFee: 5000n, transferFeeBasisPoints: 250 },
    olderTransferFee: { epoch: 50n, maximumFee: 1000n, transferFeeBasisPoints: 100 },
  };
  const attempt = (run, epoch) => {
    try {
      const fee = run(config, epoch);
      return { basisPoints: fee.basisPoints, maximumFee: fee.maximumFee.toString() };
    } catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; }
  };
  for (const epoch of [0, 49, 50, 99, 100, 101, 1000000, 100n, 99n]) {
    assert.deepEqual(
      attempt(built.transferFeeAt, epoch),
      attempt(original.transferFeeAt, epoch),
      `transferFeeAt epoch=${String(epoch)}`,
    );
  }
});
