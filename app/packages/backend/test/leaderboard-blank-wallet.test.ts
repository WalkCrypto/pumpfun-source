import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LeaderboardStore } from '../src/leaderboard-store.js';

const fresh = () =>
  JSON.parse(
    readFileSync(new URL('../src/leaderboard-seed.json', import.meta.url), 'utf8'),
  );

test('leaderboard seeds reject a blank or non-string walletAddress before ranking', () => {
  for (const period of ['daily', 'weekly', 'monthly']) {
    for (const value of ['', 42, null]) {
      const seed = fresh();
      seed[period][0].walletAddress = value;
      assert.throws(
        () => new LeaderboardStore(seed),
        /non-empty/i,
        `${period}.walletAddress: ${JSON.stringify(value)}`,
      );
    }
  }
});

test('a distinct non-blank wallet still ranks and serves', () => {
  const seed = fresh();
  const board = new LeaderboardStore(seed).getBoard({ period: 'daily' });
  assert.ok(board.entries.length > 0);
  assert.ok(board.entries.every((row) => typeof row.walletAddress === 'string' && row.walletAddress !== ''));
});
