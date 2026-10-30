import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

const position = {
  mint: 'synthetic-mint', chainId: 1, symbol: 'TEST',
  name: 'Synthetic test position', imageUri: null,
};
const trader = (rank, walletAddress) => ({
  rank, pnlSol: 1, pnlUsd: 25, pnlPercent: 5, buySpendSol: 2,
  lastRefreshedAtMs: 1_700_000_000_000, realizedPnlSol: 0.5, realizedPnlUsd: 10,
  unrealizedPnlSol: 0.5, unrealizedPnlUsd: 15, positionsCount: 1,
  topPositions: [position], walletAddress, username: 'synthetic-test-user',
  profileImage: null, xUsername: null, isVerified: false,
  verifiedBadgeVisible: true, userId: 'synthetic-user-id',
});
const parse = (entries) =>
  normalizeUpstreamResponse('traders', {
    entries, periodType: 0, periodLabel: 'Daily', windowStartSec: 1_700_000_000,
  }, { page: 1, competitionId: null });

test('leaderboard upstream traders reject a wallet appearing twice on one board', () => {
  assert.throws(
    () => parse([trader(1, 'synthetic-wallet'), trader(2, 'synthetic-wallet')]),
    /repeats a wallet already on the board/,
  );
  assert.throws(
    () => parse([trader(1, 'wallet-a'), trader(2, 'wallet-b'), trader(3, 'wallet-a')]),
    /repeats a wallet already on the board/,
  );
});

test('leaderboard upstream traders still accept distinct wallets', () => {
  const out = parse([trader(1, 'wallet-a'), trader(2, 'wallet-b')]);
  assert.deepEqual(out.entries.map((entry) => entry.walletAddress), ['wallet-a', 'wallet-b']);
});
