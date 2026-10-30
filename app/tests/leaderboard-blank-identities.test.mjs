import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpstreamResponse } from '../packages/frontend/src/app/api/leaderboard/upstream.ts';

function trader(walletAddress) {
  return {
    rank: 1, walletAddress, username: null, userId: null, xUsername: null,
    profileImage: null,
    isVerified: false, verifiedBadgeVisible: false,
    pnlUsd: 0, pnlPercent: 0, realizedPnlUsd: 0, unrealizedPnlUsd: 0,
    pnlSol: 0, realizedPnlSol: 0, unrealizedPnlSol: 0,
    buySpendSol: 0, positionsCount: 0, lastRefreshedAtMs: 0, topPositions: [],
  };
}
const traders = (entries) =>
  normalizeUpstreamResponse('traders', { periodType: 0, entries, periodLabel: 'D', windowStartSec: 0 }, { page: 1, competitionId: null });

function competition(overrides = {}) {
  return {
    id: 'c1', slug: 'c1', kind: 'group', title: 'T', description: 'D',
    prizeCopy: 'P', phase: 'live', prizes: [], imageUrl: null,
    top: [], winners: [], minMembers: 1, maxMembers: 5,
    registrationOpensAt: null, registrationClosesAt: null,
    startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z',
    maxEntries: 10, entriesCount: 1, participants: 1, joinable: true, isFinal: false,
    ...overrides,
  };
}
const competitions = (upcoming) =>
  normalizeUpstreamResponse('competitions', { upcoming, live: [], past: [] }, { page: 1, competitionId: null });

test('leaderboard upstream rejects blank trader wallet addresses', () => {
  assert.throws(() => traders([trader('')]), /non-empty/);
  assert.doesNotThrow(() => traders([trader('local')]));
});

test('leaderboard upstream rejects blank competition identities', () => {
  assert.throws(() => competitions([competition({ id: '' })]), /non-empty/);
  assert.throws(() => competitions([competition({ slug: '' })]), /non-empty/);
  assert.doesNotThrow(() => competitions([competition()]));
});

test('leaderboard upstream rejects blank entry identities and position mints', () => {
  const entry = {
    entryId: 'e1', participantId: 'p1', kind: 'person', rank: 1,
    pnlUsd: 0, realizedPnlUsd: 0, unrealizedPnlUsd: 0, memberCount: 1,
    membersFresh: 1, struck: false, lastRefreshedAtMs: 0,
    profileImageUrl: null,
    buySpendSol: 0, positionsCount: 0,
    walletAddress: null, username: null, isVerified: false,
    verifiedBadgeVisible: false, topPositions: [],
  };
  const withEntry = (row) => competition({ top: [row] });
  assert.throws(() => competitions([withEntry({ ...entry, entryId: '' })]), /non-empty/);
  assert.throws(() => competitions([withEntry({ ...entry, participantId: '' })]), /non-empty/);
  assert.throws(
    () => competitions([withEntry({ ...entry, topPositions: [{ mint: '', chainId: 1, symbol: null, name: null, imageUri: null }] })]),
    /non-empty/,
  );
  assert.doesNotThrow(() => competitions([withEntry(entry)]));
});

test('leaderboard upstream rejects blank creator wallet entries', () => {
  const creator = {
    rank: 1, userId: null, username: null, walletAddress: null, wallets: [''],
    profileImageUrl: null, twitterId: null, twitterUrl: null,
    isVerified: false, verifiedBadgeVisible: false, totalPaidUsdc: 0,
    payoutCount: 0, lastPaidAt: null,
  };
  const parse = (entries) =>
    normalizeUpstreamResponse('creators', { entries, totalEarners: 1, generatedAt: null }, { page: 1, competitionId: null });
  assert.throws(() => parse([creator]), /non-empty/);
  assert.doesNotThrow(() => parse([{ ...creator, wallets: ['local'] }]));
});
