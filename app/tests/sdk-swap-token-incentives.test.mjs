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

const bn = (value) => new BN(value.toString());
const globalAccumulator = (start, end, day, supplies, volumes) => ({
  startTime: bn(start), endTime: bn(end), secondsInADay: bn(day),
  totalTokenSupply: supplies.map(bn), solVolumes: volumes.map(bn),
});
const userAccumulator = (unclaimed, volume, lastUpdate) => ({
  totalUnclaimedTokens: bn(unclaimed), currentSolVolume: bn(volume), lastUpdateTimestamp: bn(lastUpdate),
});

test('rebuilt swap token-incentive accrual matches published', () => {
  // The swap dist carries its own copies of the accrual functions; #1850
  // covers the root-dist copies, not these.
  const cases = [
    ['zero window', globalAccumulator(0, 0, 0, [1000], [100]), userAccumulator(50, 10, 0)],
    ['before start', globalAccumulator(1000, 2000, 100, [1000, 2000], [100, 200]), userAccumulator(50, 10, 900)],
    ['accrual day', globalAccumulator(1000, 2000, 100, [1000, 2000], [100, 200]), userAccumulator(50, 10, 1100)],
    ['no volume on last-updated day', globalAccumulator(1000, 2000, 100, [1000, 2000], [0, 200]), userAccumulator(50, 10, 1100)],
    ['same day current', globalAccumulator(1000, 2000, 100, [1000, 2000], [100, 200]), userAccumulator(50, 10, 1150)],
    ['past end', globalAccumulator(1000, 2000, 100, [1000, 2000], [100, 200]), userAccumulator(50, 10, 2100)],
    ['end before start', globalAccumulator(2000, 1000, 100, [1000], [100]), userAccumulator(50, 10, 1500)],
  ];
  for (const [name, global, user] of cases) {
    for (const timestamp of [1050, 1150, 1250]) {
      for (const fn of ['totalUnclaimedTokens', 'currentDayTokens']) {
        assert.equal(
          built[fn](global, user, timestamp).toString(),
          original[fn](global, user, timestamp).toString(),
          `${fn} ${name} ts=${timestamp}`,
        );
      }
    }
  }
});
