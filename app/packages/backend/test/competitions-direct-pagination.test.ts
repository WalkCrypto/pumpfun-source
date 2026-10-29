import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/competitions-seed.json' with { type: 'json' };
import {
  CompetitionStore,
  type RawCompetition,
  type RawEntry,
} from '../src/competitions-store.js';

const LIVE_ID = '11111111-1111-4000-8000-000000000002';
const LIVE_ENTRY_1 = '22222222-2222-4000-8000-000000000001';
const BAD = [NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1];

function groupEntry(entryId: string, pnlUsd: number): RawEntry {
  return {
    entryId,
    participantId: 'nobody',
    registeredAt: '2024-01-01T00:00:00.000Z',
    struck: false,
    pnlUsd,
    realizedPnlUsd: pnlUsd,
    unrealizedPnlUsd: 0,
    buySpendSol: 1,
    membersFresh: 1,
    lastRefreshedAtMs: 1000,
    members: [],
    positions: [],
    highlightTokens: [],
  };
}

function groupComp(id: string, entries: RawEntry[]): RawCompetition {
  return {
    id,
    slug: id,
    kind: 'group',
    title: 'Direct pagination arena',
    description: 'Seed for direct competition pagination',
    prizeCopy: 'Winner takes all',
    imageUrl: null,
    prizes: [{ rankFrom: 1, rankTo: 1, amount: '1000' }],
    registrationOpensAt: null,
    registrationClosesAt: null,
    startsAt: null,
    endsAt: null,
    minMembers: 1,
    maxMembers: 4,
    maxEntries: 1000,
    phase: 'live',
    isFinal: false,
    joinable: true,
    entries,
  };
}

test('direct competition reads reject unsafe or fractional pagination values', () => {
  const store = new CompetitionStore();
  const live = structuredClone(seed.find(row => row.id === LIVE_ID)) as RawCompetition;
  for (const value of BAD) {
    assert.throws(() => store.getByIdOrSlug(LIVE_ID, { limit: value }), /Invalid competition pagination/);
    assert.throws(() => store.getByIdOrSlug(LIVE_ID, { positionsLimit: value }), /Invalid competition pagination/);
    assert.throws(() => store.toCompetitionView(live, value), /Invalid competition pagination/);
    assert.throws(() => store.getEntryHighlights(LIVE_ID, LIVE_ENTRY_1, { limit: value }), /Invalid competition pagination/);
    assert.throws(() => store.getCompetitionHighlights(LIVE_ID, { limit: value }), /Invalid competition pagination/);
    assert.throws(() => store.getCompetitionHighlights(LIVE_ID, { perMemberLimit: value }), /Invalid competition pagination/);
  }
});

test('direct competition reads keep the routes documented page bounds', () => {
  const store = new CompetitionStore();
  const base = store.getByIdOrSlug(LIVE_ID)!;
  assert.equal(base.leaderboard.totalRanked, 3);
  // Single-competition board: limit 0..100, positionsLimit 0..5.
  assert.equal(store.getByIdOrSlug(LIVE_ID, { limit: 0 })!.leaderboard.entries.length, 0);
  assert.equal(store.getByIdOrSlug(LIVE_ID, { limit: 0 })!.leaderboard.totalRanked, 3);
  assert.equal(store.getByIdOrSlug(LIVE_ID, { limit: -5 })!.leaderboard.entries.length, 0);
  assert.equal(store.getByIdOrSlug(LIVE_ID, { limit: 1000 })!.leaderboard.entries.length, 3);
  const noPositions = store.getByIdOrSlug(LIVE_ID, { positionsLimit: 0 })!;
  assert.deepEqual(noPositions.competition.top.map(row => row.topPositions), [[], [], []]);
  assert.deepEqual(noPositions.competition.top.map(row => row.positionsCount), [4, 1, 0]);
  const capped = store.getByIdOrSlug(LIVE_ID, { positionsLimit: 100 })!;
  assert.ok(capped.competition.top.every(row => row.topPositions.length <= 5));
  assert.equal(capped.competition.top[0].topPositions.length, 4);

  // Entry highlights: limit 1..10.
  assert.equal(store.getEntryHighlights(LIVE_ID, LIVE_ENTRY_1, { limit: 0 })!.tokens.length, 1);
  assert.equal(store.getEntryHighlights(LIVE_ID, LIVE_ENTRY_1, { limit: 100 })!.tokens.length, 2);

  // Competition highlights: limit 1..20, perMemberLimit 1..10.
  assert.equal(store.getCompetitionHighlights(LIVE_ID, { limit: 0 })!.rows.length, 1);
  assert.equal(store.getCompetitionHighlights(LIVE_ID, { limit: 100 })!.rows.length, 3);
  assert.equal(store.getCompetitionHighlights(LIVE_ID, { perMemberLimit: 0 })!.rows.length, 3);
});

test('a wide direct board keeps the documented 100-row ceiling', () => {
  const entries = Array.from({ length: 150 }, (_, index) =>
    groupEntry(`wide-entry-${index}`, 150 - index));
  const store = new CompetitionStore([groupComp('wide-arena', entries)]);
  assert.equal(store.getByIdOrSlug('wide-arena')!.leaderboard.entries.length, 100);
  assert.equal(store.getByIdOrSlug('wide-arena', { limit: 1000 })!.leaderboard.entries.length, 100);
  assert.equal(store.getByIdOrSlug('wide-arena', { limit: 2 })!.leaderboard.entries.length, 2);
});

test('wide direct highlight reads keep the documented row and per-member ceilings', () => {
  const entry = groupEntry('highlight-entry', 100);
  entry.highlightTokens = Array.from({ length: 25 }, (_, index) => ({
    mint: `mint-${index}`,
    chainId: 101,
    symbol: 'T',
    name: 'Tok',
    imageUri: null,
    pnlUsd: 100 - index,
    realizedPnlUsd: 100 - index,
    unrealizedPnlUsd: 0,
    buySpendUsd: 1,
    members: [{ userId: `trader-${index}`, pnlUsd: 100 - index, realizedPnlUsd: 100 - index, unrealizedPnlUsd: 0, buySpendUsd: 1 }],
  }));
  const store = new CompetitionStore([groupComp('highlight-arena', [entry])]);
  assert.equal(store.getCompetitionHighlights('highlight-arena', { limit: 100 })!.rows.length, 20);
  const shared = groupEntry('shared-entry', 100);
  shared.highlightTokens = Array.from({ length: 25 }, (_, index) => ({
    mint: `mint-${index}`,
    chainId: 101,
    symbol: 'T',
    name: 'Tok',
    imageUri: null,
    pnlUsd: 100 - index,
    realizedPnlUsd: 100 - index,
    unrealizedPnlUsd: 0,
    buySpendUsd: 1,
    members: [{ userId: 'same-trader', pnlUsd: 100 - index, realizedPnlUsd: 100 - index, unrealizedPnlUsd: 0, buySpendUsd: 1 }],
  }));
  const sharedStore = new CompetitionStore([groupComp('shared-arena', [shared])]);
  assert.equal(sharedStore.getCompetitionHighlights('shared-arena', { perMemberLimit: 100 })!.rows.length, 10);
  assert.equal(store.getEntryHighlights('highlight-arena', 'highlight-entry', { limit: 100 })!.tokens.length, 10);
});
