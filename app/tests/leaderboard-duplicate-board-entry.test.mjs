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
const competition = () => ({
  id: 'c1', slug: 'c1', kind: 'group', title: 'T', description: 'D',
  prizeCopy: 'P', phase: 'live',
  prizes: [{ rankFrom: 1, rankTo: 1, amount: '1000' }], imageUrl: null,
  top: [], winners: [], minMembers: 1, maxMembers: 5,
  registrationOpensAt: null, registrationClosesAt: null,
  startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z',
  maxEntries: 10, entriesCount: 1, participants: 1, joinable: true, isFinal: false,
});
const parse = (entries) =>
  normalizeUpstreamResponse('competitions', {
    competition: competition(),
    leaderboard: { startSec: 0, endSec: 100, entries, totalRanked: entries.length, builtAtMs: 0, isFinal: false },
  }, { page: 1, competitionId: 'c1' });

test('leaderboard upstream competition detail rejects a repeated entryId on the board', () => {
  assert.throws(
    () => parse([entry('e1'), entry('e2'), entry('e1')]),
    /repeats an entry already on this board/,
  );
});

test('leaderboard upstream competition detail still accepts distinct board entryIds', () => {
  const out = parse([entry('e1'), entry('e2')]);
  assert.deepEqual(out.entries.map((row) => row.entryId), ['e1', 'e2']);
});
