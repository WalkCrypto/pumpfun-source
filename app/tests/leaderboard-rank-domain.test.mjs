import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLeaderboardResponse } from "../packages/frontend/src/app/leaderboard/types.ts";

const source = {
  mode: "developer-api",
  label: "Pump developer API",
  fetchedAt: "2026-10-30T00:00:00.000Z",
};

function traders(rank) {
  return {
    ok: true,
    source,
    data: {
      kind: "traders",
      entries: [
        {
          rank,
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
          positionsCount: 2,
          lastRefreshedAtMs: 1000,
        },
      ],
      periodLabel: "Daily",
      windowStartSec: 1000,
    },
  };
}

function creators(rank) {
  return {
    ok: true,
    source,
    data: {
      kind: "creators",
      entries: [
        {
          rank,
          userId: null,
          username: null,
          walletAddress: null,
          wallets: [],
          isVerified: false,
          verifiedBadgeVisible: false,
          totalPaidUsdc: 50,
          payoutCount: 3,
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

function competitionDetail(rank) {
  return {
    ok: true,
    source,
    data: {
      kind: "competition-detail",
      competition: {
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
      },
      entries: [
        {
          entryId: "entry-1",
          participantId: "nobody",
          kind: "person",
          rank,
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
        },
      ],
      totalRanked: 1,
      builtAtMs: 1000,
      isFinal: false,
    },
  };
}

test("fractional entry ranks are rejected in every leaderboard category", () => {
  for (const response of [traders(1.5), creators(2.5), competitionDetail(0.5)]) {
    assert.throws(
      () => parseLeaderboardResponse(response),
      /invalid response/i,
    );
  }
  for (const value of [NaN, Infinity, -1, 1e21]) {
    assert.throws(() => parseLeaderboardResponse(traders(value)), /invalid response/i);
  }
});

test("integer entry ranks, including the unranked zero, still parse", () => {
  assert.equal(parseLeaderboardResponse(traders(1)).data.entries[0].rank, 1);
  assert.equal(parseLeaderboardResponse(creators(2)).data.entries[0].rank, 2);
  assert.equal(
    parseLeaderboardResponse(competitionDetail(0)).data.entries[0].rank,
    0,
  );
});
