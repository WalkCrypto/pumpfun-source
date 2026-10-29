import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CompetitionStore,
  type RawCompetition,
} from '../src/competitions-store.js';

function seedWith(
  overrides: Partial<RawCompetition> = {},
): RawCompetition[] {
  return [
    {
      id: '11111111-1111-4000-8000-000000000001',
      slug: 'enum-arena',
      kind: 'person',
      title: 'Enum Arena',
      description: 'Seed for competition enum validation',
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
        },
      ],
      ...overrides,
    },
  ];
}

test('competition seeds reject kinds and phases outside the schema enum', () => {
  for (const kind of ['bogus', '', 'PERSON', 42, null]) {
    assert.throws(
      () =>
        new CompetitionStore(
          seedWith({ kind: kind as unknown as RawCompetition['kind'] }),
        ),
      /kind/i,
      `kind: ${String(kind)}`,
    );
  }
  for (const phase of ['bogus', '', 'LIVE', 42, null]) {
    assert.throws(
      () =>
        new CompetitionStore(
          seedWith({ phase: phase as unknown as RawCompetition['phase'] }),
        ),
      /phase/i,
      `phase: ${String(phase)}`,
    );
  }
});

test('valid competition kinds and phases retain their supplied values', () => {
  for (const kind of ['person', 'group'] as const) {
    for (const phase of ['upcoming', 'registration', 'live', 'ended'] as const) {
      const store = new CompetitionStore(seedWith({ kind, phase }));
      const view = store.getByIdOrSlug('enum-arena')!.competition;
      assert.equal(view.kind, kind);
      assert.equal(view.phase, phase);
    }
  }
  const live = new CompetitionStore(seedWith({ phase: 'live' }));
  assert.equal(live.listBuckets().live.length, 1);
  const ended = new CompetitionStore(seedWith({ phase: 'ended' }));
  assert.equal(ended.listBuckets().past.length, 1);
});
