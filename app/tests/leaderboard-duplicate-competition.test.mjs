import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

const competition = (id, phase) => ({
  id, slug: id, kind: 'group', title: 'T', description: 'D',
  prizeCopy: 'P', phase,
  prizes: [{ rankFrom: 1, rankTo: 1, amount: '1000' }], imageUrl: null,
  top: [], winners: [], minMembers: 1, maxMembers: 5,
  registrationOpensAt: null, registrationClosesAt: null,
  startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z',
  maxEntries: 10, entriesCount: 1, participants: 1, joinable: true, isFinal: false,
});
const parse = (upcoming, live, past) =>
  normalizeUpstreamResponse('competitions', { upcoming, live, past }, { page: 1, competitionId: null });

test('leaderboard upstream competitions reject an id repeated across buckets', () => {
  assert.throws(
    () => parse([competition('c1', 'upcoming')], [competition('c1', 'live')], []),
    /repeats a competition already listed/,
  );
  assert.throws(
    () => parse([competition('c1', 'upcoming'), competition('c1', 'upcoming')], [], []),
    /repeats a competition already listed/,
  );
});

test('leaderboard upstream competitions still accept distinct ids', () => {
  const out = parse([competition('c1', 'upcoming')], [competition('c2', 'live')], [competition('c3', 'ended')]);
  assert.deepEqual(out.upcoming.map((row) => row.id), ['c1']);
  assert.deepEqual(out.live.map((row) => row.id), ['c2']);
  assert.deepEqual(out.past.map((row) => row.id), ['c3']);
});
