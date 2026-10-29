import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LeaderboardStore,
  type RawLeaderboardEntry,
} from '../src/leaderboard-store.js';

function seed(): {
  daily: RawLeaderboardEntry[];
  weekly: RawLeaderboardEntry[];
  monthly: RawLeaderboardEntry[];
} {
  const entry = (
    walletAddress: string,
    pnlUsd: number,
  ): RawLeaderboardEntry => ({
    userId: null,
    walletAddress,
    pnlSol: 10,
    pnlUsd,
    pnlPercent: 5,
    realizedPnlSol: 6,
    realizedPnlUsd: 60,
    unrealizedPnlSol: 4,
    unrealizedPnlUsd: 40,
    buySpendSol: 2,
    lastRefreshedAtMs: 1000,
    positions: [
      { mint: 'mint-1', chainId: 101, symbol: 'ONE', name: 'One', imageUri: null },
      { mint: 'mint-2', chainId: 101, symbol: 'TWO', name: 'Two', imageUri: null },
      { mint: 'mint-3', chainId: 101, symbol: 'THREE', name: 'Three', imageUri: null },
      { mint: 'mint-4', chainId: 101, symbol: 'FOUR', name: 'Four', imageUri: null },
    ],
  });
  return {
    daily: [entry('wallet-1', 100), entry('wallet-2', 50)],
    weekly: [],
    monthly: [],
  };
}

test('direct getBoard reads reject fractional and non-finite pagination', () => {
  const store = new LeaderboardStore(seed());
  for (const limit of [2.5, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => store.getBoard({ period: 'daily', limit }),
      RangeError,
      `limit=${limit} should throw`,
    );
  }
  for (const positionsLimit of [2.5, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => store.getBoard({ period: 'daily', positionsLimit }),
      RangeError,
      `positionsLimit=${positionsLimit} should throw`,
    );
  }
});

test('direct getBoard reads keep the documented integer clamp behavior', () => {
  const store = new LeaderboardStore(seed());
  // Undefined keeps the defaults; out-of-range safe integers still clamp.
  assert.equal(store.getBoard({ period: 'daily' }).entries.length, 2);
  assert.equal(
    store.getBoard({ period: 'daily', limit: 1 }).entries.length,
    1,
  );
  assert.equal(
    store.getBoard({ period: 'daily', limit: 1000 }).entries.length,
    2,
  );
  assert.equal(
    store.getBoard({ period: 'daily', limit: -5 }).entries.length,
    0,
  );
  assert.equal(
    store.getBoard({ period: 'daily', limit: 1 }).entries[0].topPositions
      .length,
    3,
  );
  assert.equal(
    store.getBoard({ period: 'daily', limit: 1, positionsLimit: 0 })
      .entries[0].topPositions.length,
    0,
  );
  assert.equal(
    store.getBoard({ period: 'daily', limit: 1, positionsLimit: 99 })
      .entries[0].topPositions.length,
    4,
  );
});
