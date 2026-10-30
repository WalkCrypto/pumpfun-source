import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

function competition() {
  return {
    id: 'c1', slug: 'c1', kind: 'group', title: 'T', description: 'D',
    prizeCopy: 'P', phase: 'live',
    prizes: [{ rankFrom: 1, rankTo: 1, amount: '1000' }], imageUrl: null,
    top: [], winners: [], minMembers: 1, maxMembers: 5,
    registrationOpensAt: null, registrationClosesAt: null,
    startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z',
    maxEntries: 10, entriesCount: 1, participants: 1, joinable: true, isFinal: false,
  };
}
const parse = (startSec, endSec) =>
  normalizeUpstreamResponse('competitions', {
    competition: competition(),
    leaderboard: { startSec, endSec, entries: [], totalRanked: 0, builtAtMs: 0, isFinal: false },
  }, { page: 1, competitionId: 'c1' });

test('leaderboard upstream competition detail rejects a board window that ends before it starts', () => {
  for (const [startSec, endSec] of [[100, 50], [1, 0]]) {
    assert.throws(() => parse(startSec, endSec), /window must not end before it starts/);
  }
});

test('leaderboard upstream competition detail still accepts ordered and equal board windows', () => {
  for (const [startSec, endSec] of [[0, 0], [50, 100]]) {
    const out = parse(startSec, endSec);
    assert.equal(out.kind, 'competition-detail');
  }
});
