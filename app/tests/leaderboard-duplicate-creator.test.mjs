import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

const creator = (rank, userId) => ({
  rank, userId, username: 'synthetic-test-creator', profileImageUrl: null,
  isVerified: false, verifiedBadgeVisible: true, twitterId: null,
  twitterUrl: null, wallets: ['synthetic-wallet'], totalPaidUsdc: 20,
  payoutCount: 2, lastPaidAt: '2026-10-28T00:00:00.000Z',
  walletAddress: 'synthetic-wallet',
});
const parse = (entries) =>
  normalizeUpstreamResponse('creators', {
    entries, totalEarners: entries.length, generatedAt: '2026-10-28T00:00:00.000Z',
  }, { page: 3, competitionId: null });

test('leaderboard upstream creators reject a userId appearing twice on one board', () => {
  assert.throws(
    () => parse([creator(1, 'user-a'), creator(2, 'user-a')]),
    /repeats a creator already on the board/,
  );
});

test('leaderboard upstream creators still accept distinct and null userIds', () => {
  const out = parse([creator(1, 'user-a'), creator(2, 'user-b'), creator(3, null), creator(4, null)]);
  assert.deepEqual(out.entries.map((entry) => entry.userId), ['user-a', 'user-b', null, null]);
});
