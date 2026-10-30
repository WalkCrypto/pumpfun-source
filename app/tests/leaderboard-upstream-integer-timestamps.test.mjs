import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse, UpstreamValidationError } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

const position = { mint: 'synthetic-mint', chainId: 1, symbol: 'TEST', name: 'Synthetic test position', imageUri: null };
const trader = (overrides = {}) => ({
  rank: 1, pnlSol: 1, pnlUsd: 25, pnlPercent: 5, buySpendSol: 2, lastRefreshedAtMs: 1_700_000_000_000,
  realizedPnlSol: 0.5, realizedPnlUsd: 10, unrealizedPnlSol: 0.5, unrealizedPnlUsd: 15, positionsCount: 1,
  topPositions: [position], walletAddress: 'synthetic-wallet', username: null,
  profileImage: null, xUsername: null, isVerified: false, verifiedBadgeVisible: true, userId: 'synthetic-user-id',
  ...overrides,
});
const tradersPayload = (overrides = {}) => ({
  entries: [trader()], periodType: 0, periodLabel: 'Daily', windowStartSec: 1_700_000_000, ...overrides,
});
const competition = {
  id: 'synthetic-competition-id', slug: 'synthetic-competition', kind: 'person',
  title: 'Synthetic contract test competition', description: 'Test-only contract fixture.',
  prizeCopy: '$0 test fixture', imageUrl: null, prizes: [{ rankFrom: 1, rankTo: 1, amount: '$0' }],
  registrationOpensAt: '2026-10-20T00:00:00.000Z', registrationClosesAt: '2026-10-30T00:00:00.000Z',
  startsAt: '2026-10-21T00:00:00.000Z', endsAt: '2026-10-30T00:00:00.000Z',
  minMembers: 1, maxMembers: 1, maxEntries: 50, entriesCount: 1, participants: 1,
  joinable: true, phase: 'live', isFinal: false, top: [], winners: [],
};
const competitionEntry = (overrides = {}) => ({
  entryId: 'synthetic-entry', participantId: 'synthetic-participant', kind: 'person', rank: 1,
  pnlUsd: 30, realizedPnlUsd: 20, unrealizedPnlUsd: 10, buySpendSol: 2, memberCount: 1,
  membersFresh: 1, struck: false, lastRefreshedAtMs: 1_700_000_000_000, positionsCount: 1,
  topPositions: [position], walletAddress: 'synthetic-wallet',
  username: 'synthetic-test-entrant', profileImageUrl: null, isVerified: false, verifiedBadgeVisible: true,
  ...overrides,
});
const detailPayload = (overrides = {}) => ({
  competition,
  leaderboard: {
    builtAtMs: 1_700_000_000_000, startSec: 1_700_000_000, endSec: 1_700_003_600, totalRanked: 1, isFinal: false,
    entries: [competitionEntry()],
  },
  ...overrides,
});

test('upstream timestamps reject fractional values', () => {
  assert.doesNotThrow(() => normalizeUpstreamResponse('traders', tradersPayload(), { page: 1, competitionId: null }));
  assert.doesNotThrow(() => normalizeUpstreamResponse('competitions', detailPayload(), { page: 1, competitionId: 'synthetic-competition-id' }));
  for (const bad of [1.5, 0.5, NaN, Infinity, '1', null, 2 ** 53]) {
    assert.throws(
      () => normalizeUpstreamResponse('traders', tradersPayload({ entries: [trader({ lastRefreshedAtMs: bad })] }), { page: 1, competitionId: null }),
      UpstreamValidationError,
      `trader lastRefreshedAtMs ${String(bad)}`,
    );
    assert.throws(
      () => normalizeUpstreamResponse('traders', tradersPayload({ windowStartSec: bad }), { page: 1, competitionId: null }),
      UpstreamValidationError,
      `windowStartSec ${String(bad)}`,
    );
    assert.throws(
      () => normalizeUpstreamResponse('competitions', detailPayload({ leaderboard: { builtAtMs: 1_700_000_000_000, startSec: bad, endSec: 1_700_003_600, totalRanked: 1, isFinal: false, entries: [competitionEntry()] } }), { page: 1, competitionId: 'synthetic-competition-id' }),
      UpstreamValidationError,
      `detail startSec ${String(bad)}`,
    );
    assert.throws(
      () => normalizeUpstreamResponse('competitions', detailPayload({ leaderboard: { builtAtMs: bad, startSec: 1_700_000_000, endSec: 1_700_003_600, totalRanked: 1, isFinal: false, entries: [competitionEntry()] } }), { page: 1, competitionId: 'synthetic-competition-id' }),
      UpstreamValidationError,
      `detail builtAtMs ${String(bad)}`,
    );
    assert.throws(
      () => normalizeUpstreamResponse('competitions', detailPayload({ leaderboard: { builtAtMs: 1_700_000_000_000, startSec: 1_700_000_000, endSec: 1_700_003_600, totalRanked: 1, isFinal: false, entries: [competitionEntry({ lastRefreshedAtMs: bad })] } }), { page: 1, competitionId: 'synthetic-competition-id' }),
      UpstreamValidationError,
      `entry lastRefreshedAtMs ${String(bad)}`,
    );
  }
  // Fractional money measures stay valid: only timestamps are tightened.
  assert.doesNotThrow(() => normalizeUpstreamResponse('traders', tradersPayload({ entries: [trader({ pnlUsd: 25.5 })] }), { page: 1, competitionId: null }));
});
