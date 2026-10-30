import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

function competition(prizes) {
  return {
    id: 'c1', slug: 'c1', kind: 'group', title: 'T', description: 'D',
    prizeCopy: 'P', phase: 'live', prizes, imageUrl: null,
    top: [], winners: [], minMembers: 1, maxMembers: 5,
    registrationOpensAt: null, registrationClosesAt: null,
    startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z',
    maxEntries: 10, entriesCount: 1, participants: 1, joinable: true, isFinal: false,
  };
}
const parse = (prizes) =>
  normalizeUpstreamResponse('competitions', { upcoming: [competition(prizes)], live: [], past: [] }, { page: 1, competitionId: null });

test('leaderboard upstream prizes reject zero, reversed, and out-of-order rank ranges', () => {
  for (const prizes of [
    [{ rankFrom: 0, rankTo: 1, amount: '1000' }],
    [{ rankFrom: 1, rankTo: 0, amount: '1000' }],
    [{ rankFrom: 0, rankTo: 0, amount: '1000' }],
    [{ rankFrom: 5, rankTo: 1, amount: '1000' }],
    [{ rankFrom: 3, rankTo: 2, amount: '1000' }],
  ]) {
    assert.throws(() => parse(prizes), /prize range/);
  }
});

test('leaderboard upstream prizes still accept valid 1-based ranges', () => {
  const out = parse([
    { rankFrom: 1, rankTo: 1, amount: '1000' },
    { rankFrom: 3, rankTo: 5, amount: '2 SOL' },
  ]);
  assert.deepEqual(out.upcoming[0].prizes, [
    { rankFrom: 1, rankTo: 1, amount: '1000' },
    { rankFrom: 3, rankTo: 5, amount: '2 SOL' },
  ]);
});
