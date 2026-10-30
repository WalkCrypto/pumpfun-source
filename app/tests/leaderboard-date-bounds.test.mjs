import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

function competition(overrides) {
  return {
    id: 'c1', slug: 'c1', kind: 'group', title: 'T', description: 'D',
    prizeCopy: 'P', phase: 'live',
    prizes: [{ rankFrom: 1, rankTo: 1, amount: '1000' }], imageUrl: null,
    top: [], winners: [], minMembers: 1, maxMembers: 5,
    registrationOpensAt: '2026-10-20T00:00:00Z',
    registrationClosesAt: '2026-10-25T00:00:00Z',
    startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z',
    maxEntries: 10, entriesCount: 1, participants: 1, joinable: true, isFinal: false,
    ...overrides,
  };
}
const parse = (overrides) =>
  normalizeUpstreamResponse('competitions', { upcoming: [competition(overrides)], live: [], past: [] }, { page: 1, competitionId: null });

test('leaderboard upstream competitions reject windows that end before they start', () => {
  assert.throws(() => parse({ registrationOpensAt: '2026-10-25T00:00:00Z', registrationClosesAt: '2026-10-20T00:00:00Z' }), /window must not end before it starts/);
  assert.throws(() => parse({ startsAt: '2026-10-30T00:00:00Z', endsAt: '2026-10-29T00:00:00Z' }), /window must not end before it starts/);
  // Differing UTC offsets must compare by instant, not lexicographically:
  // 2026-10-30T00:00+05:00 is 2026-10-29T19:00Z, before the 2026-10-29T20:00Z
  // end, so this window is valid even though its start string sorts later.
  assert.doesNotThrow(() => parse({ startsAt: '2026-10-30T00:00:00+05:00', endsAt: '2026-10-29T20:00:00Z' }));
});

test('leaderboard upstream competitions still accept ordered, equal, and open-ended windows', () => {
  for (const overrides of [
    {},
    { startsAt: '2026-10-30T00:00:00Z', endsAt: '2026-10-30T00:00:00Z' },
    { registrationOpensAt: null, registrationClosesAt: null },
    { startsAt: null, endsAt: null },
  ]) {
    const out = parse(overrides);
    assert.equal(out.upcoming[0].id, 'c1');
  }
});
