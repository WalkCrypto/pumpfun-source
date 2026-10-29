import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardStore, type RawSeed } from '../src/leaderboard-store.js';
import seed from '../src/leaderboard-seed.json' with { type: 'json' };

function seedWithPositionChainId(value: unknown): RawSeed {
  const copy = structuredClone(seed) as unknown as RawSeed;
  const entry = copy.daily.find(candidate => (candidate.positions?.length ?? 0) > 0);
  assert.ok(entry, 'expected a daily entry with positions');
  (entry.positions[0] as unknown as Record<string, unknown>).chainId = value;
  return copy;
}

test('leaderboard position chain ids must be finite numbers, like the entry measures', () => {
  for (const value of ['0', null, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => new LeaderboardStore(seedWithPositionChainId(value)),
      /finite/i,
      `chainId = ${String(value)}`,
    );
  }
});

test('finite position chain ids, including zero, remain accepted', () => {
  assert.doesNotThrow(() => new LeaderboardStore(seedWithPositionChainId(0)));
  assert.doesNotThrow(() => new LeaderboardStore(seedWithPositionChainId(1)));
  assert.doesNotThrow(() => new LeaderboardStore());
});
