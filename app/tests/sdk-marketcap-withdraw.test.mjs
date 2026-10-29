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
const published = mkdtempSync(join(tmpdir(), 'pump-sdk-cap-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));
const stringify = (value) => {
  if (value && typeof value === 'object' && typeof value.toString === 'function' && value.constructor && value.constructor.name === 'BN') return value.toString();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stringify(v)]));
  return value;
};
const attempt = (run) => { try { return { value: stringify(run()) }; } catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; } };
const eq = (label, fn, args) => assert.deepEqual(attempt(() => built[fn](...args)), attempt(() => original[fn](...args)), label);

test('rebuilt pool market cap matches published across supplies, reserves, and mayhem mode', () => {
  for (const supply of ['0', '1', '1000000000000000', '123456789012345678']) {
    for (const [baseReserve, quoteReserve] of [['1000000000000', '30000000000'], ['1', '1'], ['999999999999', '7'], ['1000000000000', '0']]) {
      eq(`poolMarketCap supply=${supply} reserves=${baseReserve}/${quoteReserve}`, 'poolMarketCap', [{ baseMintSupply: new BN(supply), baseReserve: new BN(baseReserve), quoteReserve: new BN(quoteReserve) }]);
      eq(`poolMarketCap mayhem supply=${supply} reserves=${baseReserve}/${quoteReserve}`, 'poolMarketCap', [{ baseMintSupply: new BN(supply), baseReserve: new BN(baseReserve), quoteReserve: new BN(quoteReserve), isMayhemMode: true }]);
    }
  }
  eq('poolMarketCap zero base reserve errors', 'poolMarketCap', [{ baseMintSupply: new BN('1000'), baseReserve: new BN(0), quoteReserve: new BN('1000') }]);
});

test('rebuilt withdraw math matches published across amounts, slippage, and transfer fees', () => {
  const transferFees = [null, { basisPoints: 100, maximumFee: new BN(1000000) }, { basisPoints: 500, maximumFee: new BN(10) }];
  for (const lpAmount of ['1', '1000000', '500000000', '1000000000']) {
    for (const slippage of [0, 1, 5]) {
      for (const quoteTransferFee of transferFees) {
        eq(`withdraw lp=${lpAmount} slippage=${slippage} fee=${quoteTransferFee ? quoteTransferFee.basisPoints : 'none'}`, 'withdraw', [new BN(lpAmount), slippage, new BN('1000000000000'), new BN('30000000000'), new BN('1000000000'), quoteTransferFee]);
      }
    }
  }
  eq('withdraw full exit', 'withdraw', [new BN('1000000000'), 1, new BN('1000000000000'), new BN('30000000000'), new BN('1000000000'), null]);
  eq('withdraw zero lp amount errors', 'withdraw', [new BN(0), 1, new BN('1000000000000'), new BN('30000000000'), new BN('1000000000'), null]);
  eq('withdraw zero total lp errors', 'withdraw', [new BN('1000'), 1, new BN('1000000000000'), new BN('30000000000'), new BN(0), null]);
});
