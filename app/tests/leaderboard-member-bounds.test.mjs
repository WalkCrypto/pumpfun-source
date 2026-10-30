import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

function competition(minMembers, maxMembers) {
  return {
    id: 'c1', slug: 'c1', kind: 'group', title: 'T', description: 'D',
    prizeCopy: 'P', phase: 'live',
    prizes: [{ rankFrom: 1, rankTo: 1, amount: '1000' }], imageUrl: null,
    top: [], winners: [], minMembers, maxMembers,
    registrationOpensAt: null, registrationClosesAt: null,
    startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z',
    maxEntries: 10, entriesCount: 1, participants: 1, joinable: true, isFinal: false,
  };
}
const parse = (minMembers, maxMembers) =>
  normalizeUpstreamResponse('competitions', { upcoming: [competition(minMembers, maxMembers)], live: [], past: [] }, { page: 1, competitionId: null });

test('leaderboard upstream competitions reject reversed member bounds', () => {
  for (const [minMembers, maxMembers] of [[5, 3], [2, 1], [10, 0]]) {
    assert.throws(() => parse(minMembers, maxMembers), /member bounds/);
  }
});

test('leaderboard upstream competitions still accept equal and ordered member bounds', () => {
  for (const [minMembers, maxMembers] of [[1, 1], [1, 5], [0, 0]]) {
    const out = parse(minMembers, maxMembers);
    assert.equal(out.upcoming[0].minMembers, minMembers);
    assert.equal(out.upcoming[0].maxMembers, maxMembers);
  }
});
