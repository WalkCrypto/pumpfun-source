/**
 * Decimal integer literals on /v1/pnl-leaderboard.
 *
 * The board declares limit and positionsLimit as integers and already
 * rejects fractional, non-numeric and non-finite values, but its pageValue
 * funnels every value through Number(), which also accepts non-decimal
 * literals: limit=0x10 serves 16 rows, limit=1e1 serves 10, limit=010
 * serves 10, limit=+5 and a whitespace-padded limit serve 5, and
 * limit=5.0 serves 5 — all with 200. None of those spellings is a decimal
 * integer literal, and the repo's strict parsers (payouts, positions,
 * home-feed, callouts, user-trades) reject them all with a decimal regex.
 * Sibling of #1466 (posts), #1481 (users) and #1484 (following), which
 * reject the same literals on their routes. Out-of-range decimal integers
 * keep the existing store clamp behavior.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './with-api-key.js';

const NON_DECIMAL = ['0x10', '1e1', '010', '+5', ' 5', '5 ', '5.0', '5e0'];

describe('decimal integer literals on /v1/pnl-leaderboard', () => {
  test('non-decimal limit and positionsLimit spellings are rejected', async () => {
    const app = buildApp([]);
    try {
      for (const limit of NON_DECIMAL) {
        const res = await app.inject(
          `/v1/pnl-leaderboard?period=daily&limit=${encodeURIComponent(limit)}`,
        );
        assert.equal(res.statusCode, 400, `limit=${JSON.stringify(limit)}`);
        assert.deepEqual(res.json(), { statusCode: 400, error: 'INVALID_LIMIT' });
      }
      for (const positionsLimit of NON_DECIMAL) {
        const res = await app.inject(
          `/v1/pnl-leaderboard?period=daily&positionsLimit=${encodeURIComponent(positionsLimit)}`,
        );
        assert.equal(res.statusCode, 400, `positionsLimit=${JSON.stringify(positionsLimit)}`);
        assert.deepEqual(res.json(), { statusCode: 400, error: 'INVALID_POSITIONS_LIMIT' });
      }
    } finally {
      await app.close();
    }
  });

  test('decimal integers and the existing clamp behavior are unchanged', async () => {
    const app = buildApp([]);
    try {
      const plain = await app.inject('/v1/pnl-leaderboard?period=daily&limit=2');
      assert.equal(plain.statusCode, 200);
      const capped = await app.inject('/v1/pnl-leaderboard?period=daily&limit=500');
      assert.equal(capped.statusCode, 200);
    } finally {
      await app.close();
    }
  });
});
