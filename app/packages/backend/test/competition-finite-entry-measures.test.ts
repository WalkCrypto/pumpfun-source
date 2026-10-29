import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CompetitionStore,
  type RawCompetition,
} from '../src/competitions-store.js';

const MEASURES = ['pnlUsd', 'realizedPnlUsd', 'unrealizedPnlUsd', 'buySpendSol', 'membersFresh', 'lastRefreshedAtMs'] as const;

function seedWithEntry(overrides: Partial<Record<(typeof MEASURES)[number], number>>): RawCompetition[] {
  return [
    {
      id: '11111111-1111-4000-8000-000000000001',
      slug: 'finite-arena',
      kind: 'person',
      title: 'Finite Arena',
      description: 'Seed for finite entry measures',
      prizeCopy: 'Winner takes all',
      imageUrl: null,
      prizes: [{ rankFrom: 1, rankTo: 1, amount: '1000' }],
      registrationOpensAt: null,
      registrationClosesAt: null,
      startsAt: null,
      endsAt: null,
      minMembers: 1,
      maxMembers: 1,
      maxEntries: 10,
      phase: 'live',
      isFinal: false,
      joinable: true,
      entries: [
        {
          entryId: '22222222-2222-4000-8000-000000000001',
          participantId: 'nobody',
          registeredAt: '2024-01-01T00:00:00.000Z',
          struck: false,
          pnlUsd: 100,
          realizedPnlUsd: 60,
          unrealizedPnlUsd: 40,
          buySpendSol: 10,
          membersFresh: 0,
          lastRefreshedAtMs: 1000,
          ...overrides,
        },
      ],
    },
  ];
}

test('competition entry seeds reject nonfinite measures before ranking or JSON serialization', () => {
  for (const measure of MEASURES) {
    for (const value of [NaN, Infinity, -Infinity]) {
      assert.throws(
        () => new CompetitionStore(seedWithEntry({ [measure]: value })),
        /finite/i,
        `${measure}: ${value}`,
      );
    }
  }
});

test('finite losses, zero and fractional entry measures retain their supplied values', () => {
  const store = new CompetitionStore(seedWithEntry({ pnlUsd: -1.25, realizedPnlUsd: 0, unrealizedPnlUsd: -1.25 }));
  const board = store.getByIdOrSlug('finite-arena')!.leaderboard;
  const row = board.entries[0];
  assert.equal(row.pnlUsd, -1.25);
  assert.equal(row.realizedPnlUsd, 0);
  assert.equal(row.unrealizedPnlUsd, -1.25);
  assert.equal(JSON.parse(JSON.stringify(row)).pnlUsd, -1.25);
});
