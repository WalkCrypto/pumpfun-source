import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLeaderboardResponse } from "../packages/frontend/src/app/leaderboard/types.ts";

const source = {
  mode: "developer-api",
  label: "Pump developer API",
  fetchedAt: "2026-10-30T00:00:00.000Z",
};

function traders(positionsCount) {
  return {
    ok: true,
    source,
    data: {
      kind: "traders",
      entries: [
        {
          rank: 1,
          walletAddress: "synthetic-wallet",
          username: null,
          userId: null,
          xUsername: null,
          isVerified: false,
          verifiedBadgeVisible: false,
          pnlUsd: 100,
          pnlPercent: 10,
          realizedPnlUsd: 60,
          unrealizedPnlUsd: 40,
          buySpendSol: 5,
          positionsCount,
          lastRefreshedAtMs: 1000,
        },
      ],
      periodLabel: "Daily",
      windowStartSec: 1000,
    },
  };
}

function creators(payoutCount) {
  return {
    ok: true,
    source,
    data: {
      kind: "creators",
      entries: [
        {
          rank: 1,
          userId: null,
          username: null,
          walletAddress: null,
          wallets: [],
          isVerified: false,
          verifiedBadgeVisible: false,
          totalPaidUsdc: 50,
          payoutCount,
          lastPaidAt: null,
        },
      ],
      totalEarners: 1,
      generatedAt: null,
      page: 1,
      pageSize: 25,
    },
  };
}

function competitionSummary(overrides) {
  return {
    id: "synthetic-competition",
    slug: "synthetic-competition",
    kind: "group",
    title: "Synthetic competition",
    description: "Synthetic contract fixture",
    prizeCopy: "",
    prizes: [{ rankFrom: 1, rankTo: 1, amount: "1000" }],
    minMembers: 2,
    maxMembers: 5,
    registrationOpensAt: null,
    registrationClosesAt: null,
    startsAt: null,
    endsAt: null,
    maxEntries: 100,
    entriesCount: 0,
    participants: 0,
    joinable: false,
    phase: "upcoming",
    isFinal: false,
    ...overrides,
  };
}

function competitionDetail(overrides, entryOverrides) {
  return {
    ok: true,
    source,
    data: {
      kind: "competition-detail",
      competition: competitionSummary(overrides),
      entries: [
        {
          entryId: "entry-1",
          participantId: "nobody",
          kind: "person",
          rank: 1,
          pnlUsd: 100,
          realizedPnlUsd: 60,
          unrealizedPnlUsd: 40,
          memberCount: 1,
          membersFresh: 0,
          struck: false,
          lastRefreshedAtMs: 1000,
          walletAddress: null,
          username: null,
          isVerified: false,
          verifiedBadgeVisible: false,
          ...entryOverrides,
        },
      ],
      totalRanked: 1,
      builtAtMs: 1000,
      isFinal: false,
    },
  };
}

function competitions(overrides) {
  return {
    ok: true,
    source,
    data: {
      kind: "competitions",
      upcoming: [competitionSummary(overrides)],
      live: [],
      past: [],
    },
  };
}

test("fractional count fields are rejected in every leaderboard category", () => {
  for (const response of [
    traders(2.5),
    creators(3.5),
    competitions({ maxEntries: 100.5 }),
    competitions({ entriesCount: 1.5 }),
    competitions({ participants: 1.5 }),
    competitions({ minMembers: 2.5 }),
    competitions({ maxMembers: 5.5 }),
    competitionDetail({}, { memberCount: 1.5 }),
    competitionDetail({}, { membersFresh: 0.5 }),
  ]) {
    assert.throws(
      () => parseLeaderboardResponse(response),
      /invalid response/i,
    );
  }
  const fractionalTotal = competitionDetail({}, {});
  fractionalTotal.data.totalRanked = 1.5;
  assert.throws(
    () => parseLeaderboardResponse(fractionalTotal),
    /invalid response/i,
  );
});

test("integer count fields still parse", () => {
  assert.equal(
    parseLeaderboardResponse(traders(2)).data.entries[0].positionsCount,
    2,
  );
  assert.equal(
    parseLeaderboardResponse(creators(3)).data.entries[0].payoutCount,
    3,
  );
  assert.equal(
    parseLeaderboardResponse(competitions({ entriesCount: 4 })).data.upcoming[0]
      .entriesCount,
    4,
  );
  assert.equal(
    parseLeaderboardResponse(competitionDetail({}, { memberCount: 2 })).data
      .entries[0].memberCount,
    2,
  );
});
