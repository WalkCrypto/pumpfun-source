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

test('rebuilt buy debit matches published across v1, v2, mayhem, and taxed quotes', () => {
  const original = require(join(published, 'swap/index.js'));
  const built = require(join(root, 'packages/sdk/dist/swap/index.js'));
  const gc = (bps) => ({ buybackBasisPoints: new BN(bps) });
  const tf = (bps, cap) => ({ basisPoints: bps, maximumFee: new BN(cap) });
  const base = {
    quoteAmountIn: new BN(1000000), lpFee: new BN(100),
    protocolFee: new BN(200), coinCreatorFee: new BN(50),
    globalConfig: gc(500),
  };
  const cases = [
    ['v1 untaxed', { ...base }],
    ['v1 taxed', { ...base, quoteTransferFee: tf(100, 100000) }],
    ['v2 untaxed', { ...base, tradeV2: true }],
    // v2 withholds the buyback slice (floor of buybackBasisPoints) from the vault gross-up.
    ['v2 taxed', { ...base, tradeV2: true, quoteTransferFee: tf(100, 100000) }],
    ['v2 taxed, capped fee', { ...base, tradeV2: true, quoteTransferFee: tf(500, 10) }],
    // Mayhem pools pay no buyback slice even on v2.
    ['v2 mayhem', { ...base, tradeV2: true, isMayhemMode: true }],
    ['v2 mayhem taxed', { ...base, tradeV2: true, isMayhemMode: true, quoteTransferFee: tf(100, 100000) }],
    ['zero amounts', {
      quoteAmountIn: new BN(0), lpFee: new BN(0), protocolFee: new BN(0),
      coinCreatorFee: new BN(0), tradeV2: true, globalConfig: gc(0),
    }],
    // Full buyback slice: the vault gross-up excludes the whole protocol fee.
    ['v2 full buyback', { ...base, tradeV2: true, globalConfig: gc(10000) }],
  ];
  for (const [label, args] of cases) {
    assert.equal(built.buyDebit(args).toString(), original.buyDebit(args).toString(), label);
  }
});
