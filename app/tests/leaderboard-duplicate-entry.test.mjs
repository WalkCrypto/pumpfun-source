import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

const position = {
  mint: 'synthetic-mint', chainId: 1, symbol: 'TEST',
  name: 'Synthetic test position', imageUri: null,
};
const entry = (entryId) => ({
  entryId, participantId: 'synthetic-participant', kind: 'person', rank: 1,
  pnlUsd: 30, realizedPnlUsd: 20, unrealizedPnlUsd: 10, buySpendSol: 2,
  memberCount: 1, membersFresh: 1, struck: false,
  lastRefreshedAtMs: 1_700_000_000_000, positionsCount: 1,
  topPositions: [position], walletAddress: 'synthetic-wallet',
  username: 'synthetic-test-entrant', profileImageUrl: null,
  isVerified: false, verifiedBadgeVisible: true,
});
const competition = (top, winners) => ({
  id: 'synthetic-competition-id', slug: 'synthetic-competition', kind: 'person',
  title: 'Synthetic contract test competition', description: 'Test-only contract fixture.',
  prizeCopy: '$0 test fixture', imageUrl: null,
  prizes: [{ rankFrom: 1, rankTo: 1, amount: '$0' }],
  registrationOpensAt: '2026-10-20T00:00:00.000Z',
  registrationClosesAt: '2026-10-30T00:00:00.000Z',
  startsAt: '2026-10-21T00:00:00.000Z', endsAt: '2026-10-30T00:00:00.000Z',
  minMembers: 1, maxMembers: 1, maxEntries: 50, entriesCount: 1,
  participants: 1, joinable: true, phase: 'live', isFinal: false, top, winners,
});
const parse = (top, winners) =>
  normalizeUpstreamResponse('competitions', { upcoming: [competition(top, winners)], live: [], past: [] }, { page: 1, competitionId: null });

test('leaderboard upstream competitions reject a repeated entryId across top and winners', () => {
  assert.throws(
    () => parse([entry('e1'), entry('e2')], [entry('e2')]),
    /repeats an entry already in this competition/,
  );
  assert.throws(
    () => parse([entry('e1'), entry('e1')], []),
    /repeats an entry already in this competition/,
  );
});

test('leaderboard upstream competitions still accept distinct entryIds', () => {
  const out = parse([entry('e1')], [entry('e2')]);
  assert.equal(out.upcoming[0].id, 'synthetic-competition-id');
});
