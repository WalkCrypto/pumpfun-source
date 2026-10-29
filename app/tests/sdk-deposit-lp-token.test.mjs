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

const attempt = (run, args) => {
  try {
    const result = run(...args);
    return { maxBase: result.maxBase.toString(), maxQuote: result.maxQuote.toString() };
  } catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; }
};
const eq = (label, args) => assert.deepEqual(
  attempt(built.depositLpToken, args),
  attempt(original.depositLpToken, args),
  label,
);

test('rebuilt depositLpToken matches published across amounts, slippage, and transfer fees', () => {
  for (const lp of ['0', '1', '3', '7', '1000', '999999', '1000000000']) {
    for (const slippage of [0, 1, 10, 100]) {
      eq(`lp=${lp} slippage=${slippage}`, [bn(lp), slippage, bn('1000000000'), bn('500000000'), bn('1000000000000'), null]);
      eq(`lp=${lp} slippage=${slippage} transfer fee`, [bn(lp), slippage, bn('1000000000'), bn('500000000'), bn('1000000000000'), { basisPoints: 250, maximumFee: bn('100000') }]);
    }
  }
  // Ceiling division is load-bearing here: 3 * 7 / 13 and 3 * 11 / 13 both round up, not down.
  eq('tiny reserves round up', [bn('3'), 1, bn('7'), bn('11'), bn('13'), null]);
  eq('lp above total supply', [bn('2000000000000'), 1, bn('1000000000'), bn('500000000'), bn('1000000000000'), null]);
  eq('capped transfer fee', [bn('1000000'), 5, bn('1000000000'), bn('500000000'), bn('1000000000000'), { basisPoints: 10000, maximumFee: bn('1000') }]);
  eq('zero transfer fee', [bn('1000000'), 5, bn('1000000000'), bn('500000000'), bn('1000000000000'), { basisPoints: 0, maximumFee: bn('0') }]);
});

test('rebuilt depositLpToken rejections match published', () => {
  eq('zero totalLp', [bn('1000'), 1, bn('1000000000'), bn('500000000'), bn(0), null]);
  // depositLpToken, unlike depositToken0, does not range-check slippage; both builds agree.
  eq('negative slippage', [bn('1000000'), -5, bn('1000000000'), bn('500000000'), bn('1000000000000'), null]);
  eq('slippage above 100', [bn('1000000'), 101, bn('1000000000'), bn('500000000'), bn('1000000000000'), null]);
});
