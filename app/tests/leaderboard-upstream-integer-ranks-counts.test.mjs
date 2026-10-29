import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

function traderEntry(overrides = {}) {
  return {
    topPositions: [], pnlSol: 1, realizedPnlSol: 1, unrealizedPnlSol: 0,
    profileImage: null, rank: 1, walletAddress: 'w', username: null,
    userId: null, xUsername: null, isVerified: false,
    verifiedBadgeVisible: false, pnlUsd: 1.5, pnlPercent: 1.5,
    realizedPnlUsd: 1.5, unrealizedPnlUsd: 0, buySpendSol: 1.5,
    positionsCount: 2, lastRefreshedAtMs: 0, ...overrides,
  };
}

function traders(entries) {
  return {
    periodType: 0, periodLabel: 'daily', windowStartSec: 0, entries,
  };
}

function creatorEntry(overrides = {}) {
  return {
    profileImageUrl: null, twitterId: null, twitterUrl: null,
    wallets: ['w'], rank: 1, userId: null, username: null,
    walletAddress: null, isVerified: false, verifiedBadgeVisible: false,
    totalPaidUsdc: 1.5, payoutCount: 3, lastPaidAt: null, ...overrides,
  };
}

function competition(overrides = {}) {
  return {
    id: 'c1', slug: 'c1', kind: 'group', title: 'T', description: 'D',
    prizeCopy: 'P', phase: 'live', prizes: [], imageUrl: null,
    top: [], winners: [], minMembers: 1, maxMembers: 5,
    registrationOpensAt: null, registrationClosesAt: null,
    startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z',
    maxEntries: 10, entriesCount: 1, participants: 1, joinable: true,
    isFinal: false, ...overrides,
  };
}

function competitionEntry(overrides = {}) {
  return {
    entryId: 'e', participantId: 'p', kind: 'person', rank: 1,
    pnlUsd: 1.5, realizedPnlUsd: 1.5, unrealizedPnlUsd: 0,
    memberCount: 1, membersFresh: 1, struck: false,
    lastRefreshedAtMs: 0, walletAddress: null, username: null,
    isVerified: false, verifiedBadgeVisible: false,
    topPositions: [], buySpendSol: 1.5, positionsCount: 2,
    profileImageUrl: null, ...overrides,
  };
}

const parseTraders = (value) =>
  normalizeUpstreamResponse('traders', value, { page: 1, competitionId: null });
const parseCreators = (value) =>
  normalizeUpstreamResponse('creators', value, { page: 1, competitionId: null });
const parseCompetitions = (value) =>
  normalizeUpstreamResponse('competitions', value, { page: 1, competitionId: null });
const parseDetail = (value) =>
  normalizeUpstreamResponse('competitions', value, { page: 1, competitionId: 'c1' });

test('leaderboard upstream ranks and counts reject fractional values', () => {
  // Integer payloads still parse, and fractional money measures stay valid.
  assert.doesNotThrow(() => parseTraders(traders([traderEntry()])));
  assert.doesNotThrow(() => parseCreators({
    entries: [creatorEntry()], totalEarners: 10, generatedAt: null,
  }));
  assert.doesNotThrow(() => parseCompetitions({
    upcoming: [competition()], live: [], past: [],
  }));
  assert.doesNotThrow(() => parseDetail({
    leaderboard: {
      startSec: 0, endSec: 10, entries: [competitionEntry()],
      totalRanked: 1, builtAtMs: 0, isFinal: false,
    },
    competition: competition(),
  }));

  for (const [label, run] of [
    ['trader rank', () => parseTraders(traders([traderEntry({ rank: 1.5 })]))],
    ['trader positionsCount', () => parseTraders(traders([traderEntry({ positionsCount: 2.5 })]))],
    ['creator rank', () => parseCreators({
      entries: [creatorEntry({ rank: 1.5 })], totalEarners: 10, generatedAt: null,
    })],
    ['creator payoutCount', () => parseCreators({
      entries: [creatorEntry({ payoutCount: 3.5 })], totalEarners: 10, generatedAt: null,
    })],
    ['creator totalEarners', () => parseCreators({
      entries: [creatorEntry()], totalEarners: 10.5, generatedAt: null,
    })],
    ['prize rankFrom', () => parseCompetitions({
      upcoming: [competition({ prizes: [{ rankFrom: 1.5, rankTo: 2, amount: '1' }] })],
      live: [], past: [],
    })],
    ['prize rankTo', () => parseCompetitions({
      upcoming: [competition({ prizes: [{ rankFrom: 1, rankTo: 2.5, amount: '1' }] })],
      live: [], past: [],
    })],
    ['competition minMembers', () => parseCompetitions({
      upcoming: [competition({ minMembers: 1.5 })], live: [], past: [],
    })],
    ['competition entriesCount', () => parseCompetitions({
      upcoming: [competition({ entriesCount: 1.5 })], live: [], past: [],
    })],
    ['entry rank', () => parseDetail({
      leaderboard: {
        startSec: 0, endSec: 10, entries: [competitionEntry({ rank: 1.5 })],
        totalRanked: 1, builtAtMs: 0, isFinal: false,
      },
      competition: competition(),
    })],
    ['entry memberCount', () => parseDetail({
      leaderboard: {
        startSec: 0, endSec: 10, entries: [competitionEntry({ memberCount: 1.5 })],
        totalRanked: 1, builtAtMs: 0, isFinal: false,
      },
      competition: competition(),
    })],
    ['detail totalRanked', () => parseDetail({
      leaderboard: {
        startSec: 0, endSec: 10, entries: [competitionEntry()],
        totalRanked: 1.5, builtAtMs: 0, isFinal: false,
      },
      competition: competition(),
    })],
  ]) {
    assert.throws(run, /non-negative safe integer/, label);
  }
});
