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

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-swap-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

test('rebuilt swap transfer-fee epoch selection and withholding match published', () => {
  // transferFeeAt: the newer schedule applies once its epoch has arrived,
  // the older schedule before that — the boundary epoch itself counts as new.
  const config = {
    newerTransferFee: { epoch: 100n, maximumFee: 5000n, transferFeeBasisPoints: 200 },
    olderTransferFee: { epoch: 0n, maximumFee: 1000n, transferFeeBasisPoints: 50 },
  };
  const feeString = (fee) => `${fee.basisPoints},${fee.maximumFee.toString()}`;
  for (const epoch of [0, 50, 99, 100, 101, 10000]) {
    assert.equal(feeString(built.transferFeeAt(config, epoch)), feeString(original.transferFeeAt(config, epoch)), `transferFeeAt epoch=${epoch}`);
  }
  // transferFeeAt also accepts a bigint epoch.
  assert.equal(feeString(built.transferFeeAt(config, 100n)), feeString(original.transferFeeAt(config, 100n)), 'transferFeeAt bigint epoch');

  // transferFeeOn: ceil-divided bps of the amount, capped at maximumFee;
  // null/undefined/zero-bps fees and zero amounts withhold nothing.
  const fees = [
    null, undefined,
    { basisPoints: 0, maximumFee: new BN(1000) },
    { basisPoints: 50, maximumFee: new BN(1000) },
    { basisPoints: 10000, maximumFee: new BN(1000) },
    { basisPoints: 500, maximumFee: new BN(10) },
  ];
  for (const fee of fees) {
    for (const amount of ['0', '1', '100', '100000', '1000000']) {
      assert.equal(
        built.transferFeeOn(fee, new BN(amount)).toString(),
        original.transferFeeOn(fee, new BN(amount)).toString(),
        `transferFeeOn fee=${fee ? fee.basisPoints : fee} amount=${amount}`,
      );
    }
  }
});
