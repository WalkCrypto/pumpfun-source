import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse, UpstreamValidationError } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

const position = (chainId) => ({ mint: 'synthetic-mint', chainId, symbol: 'TEST', name: 'Synthetic test position', imageUri: null });
const trader = (chainId) => ({
  rank: 1, pnlSol: 1, pnlUsd: 25, pnlPercent: 5, buySpendSol: 2, lastRefreshedAtMs: 1_700_000_000_000,
  realizedPnlSol: 0.5, realizedPnlUsd: 10, unrealizedPnlSol: 0.5, unrealizedPnlUsd: 15, positionsCount: 1,
  topPositions: [position(chainId)], walletAddress: 'synthetic-wallet', username: null,
  profileImage: null, xUsername: null, isVerified: false, verifiedBadgeVisible: true, userId: 'synthetic-user-id',
});
const tradersPayload = (chainId) => ({ entries: [trader(chainId)], periodType: 0, periodLabel: 'Daily', windowStartSec: 1_700_000_000 });

const competition = {
  id: 'synthetic-competition-id', slug: 'synthetic-competition', kind: 'person',
  title: 'Synthetic contract test competition', description: 'Test-only contract fixture.',
  prizeCopy: '$0 test fixture', imageUrl: null, prizes: [{ rankFrom: 1, rankTo: 1, amount: '$0' }],
  registrationOpensAt: '2026-10-20T00:00:00.000Z', registrationClosesAt: '2026-10-30T00:00:00.000Z',
  startsAt: '2026-10-21T00:00:00.000Z', endsAt: '2026-10-30T00:00:00.000Z',
  minMembers: 1, maxMembers: 1, maxEntries: 50, entriesCount: 1, participants: 1,
  joinable: true, phase: 'live', isFinal: false, top: [], winners: [],
};
const competitionEntry = (chainId) => ({
  entryId: 'synthetic-entry', participantId: 'synthetic-participant', kind: 'person', rank: 1,
  pnlUsd: 30, realizedPnlUsd: 20, unrealizedPnlUsd: 10, buySpendSol: 2, memberCount: 1,
  membersFresh: 1, struck: false, lastRefreshedAtMs: 1_700_000_000_000, positionsCount: 1,
  topPositions: [position(chainId)], walletAddress: 'synthetic-wallet',
  username: 'synthetic-test-entrant', profileImageUrl: null, isVerified: false, verifiedBadgeVisible: true,
});
const detailPayload = (chainId) => ({
  competition,
  leaderboard: { builtAtMs: 1_700_000_000_000, startSec: 1_700_000_000, endSec: 1_700_003_600, totalRanked: 1, isFinal: false, entries: [competitionEntry(chainId)] },
});

test('upstream trader positions reject fractional chain ids', () => {
  assert.doesNotThrow(() => normalizeUpstreamResponse('traders', tradersPayload(1), { page: 1, competitionId: null }));
  for (const chainId of [1.5, 0.5, NaN, Infinity, '1', null]) {
    assert.throws(
      () => normalizeUpstreamResponse('traders', tradersPayload(chainId), { page: 1, competitionId: null }),
      UpstreamValidationError,
      `chainId ${String(chainId)}`,
    );
  }
});

test('upstream competition-detail positions reject fractional chain ids', () => {
  assert.doesNotThrow(() => normalizeUpstreamResponse('competitions', detailPayload(1), { page: 1, competitionId: 'synthetic-competition' }));
  for (const chainId of [1.5, 0.5, NaN, Infinity]) {
    assert.throws(
      () => normalizeUpstreamResponse('competitions', detailPayload(chainId), { page: 1, competitionId: 'synthetic-competition' }),
      UpstreamValidationError,
      `chainId ${String(chainId)}`,
    );
  }
});
