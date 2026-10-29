import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CompetitionStore,
  type RawCompetition,
} from '../src/competitions-store.js';

function seedWith(
  compOverrides: Partial<RawCompetition> = {},
  entryOverrides: Record<string, unknown> = {},
): RawCompetition[] {
  return [
    {
      id: '11111111-1111-4000-8000-000000000001',
      slug: 'flag-arena',
      kind: 'person',
      title: 'Flag Arena',
      description: 'Seed for competition boolean flags',
      prizeCopy: 'Winner takes all',
      imageUrl: null,
      prizes: [{ rankFrom: 1, rankTo: 1, amount: '1000' }],
      registrationOpensAt: null,
      registrationClosesAt: null,
      startsAt: null,
      endsAt: '2024-02-01T00:00:00.000Z',
      minMembers: 1,
      maxMembers: 1,
      maxEntries: 10,
      phase: 'ended',
      isFinal: true,
      joinable: false,
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
          ...entryOverrides,
        },
      ],
      ...compOverrides,
    },
  ];
}

test('competition seeds reject non-boolean joinable, isFinal, and struck flags', () => {
  for (const field of ['joinable', 'isFinal'] as const) {
    for (const value of ['false', 'true', 0, 1, null]) {
      assert.throws(
        () => new CompetitionStore(seedWith({ [field]: value } as unknown as Partial<RawCompetition>)),
        /boolean/i,
        `${field}: ${String(value)}`,
      );
    }
  }
  for (const value of ['false', 'true', 0, 1, null]) {
    assert.throws(
      () => new CompetitionStore(seedWith({}, { struck: value })),
      /boolean/i,
      `struck: ${String(value)}`,
    );
  }
});

test('real competition flags retain their values and a string false no longer strikes an entry', () => {
  const store = new CompetitionStore(seedWith({ joinable: true, isFinal: false }));
  const view = store.getByIdOrSlug('flag-arena')!.competition;
  assert.equal(view.joinable, true);
  assert.equal(view.isFinal, false);
  const board = new CompetitionStore(seedWith({ phase: 'live', isFinal: false }));
  const detail = board.getByIdOrSlug('flag-arena')!;
  assert.equal(detail.leaderboard.entries[0].struck, false);
  assert.equal(detail.leaderboard.entries[0].rank, 1);
});
