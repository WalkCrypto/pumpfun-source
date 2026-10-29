/**
 * Decimal integer literals on the users routes.
 *
 * contracts/developer.openapi.json declares offset/limit as integers, and
 * the users routes already reject fractional, non-numeric and non-finite
 * values. But the parser still funnels every value through Number(), which
 * also accepts non-decimal literals: limit=0x10 serves 16 rows, limit=1e1
 * serves 10, limit=010 serves 10, limit=+5 and a whitespace-padded
 * limit= 5  serve 5, and limit=5.0 serves 5 — all with 200. None of those
 * spellings is a decimal integer literal, and the repo's strict parsers
 * (payouts, positions, home-feed, callouts, user-trades) reject them all
 * with a decimal regex. Sibling of the posts fix (#1466), which rejects
 * the same literals on the posts sub-resources. Out-of-range decimal
 * integers keep the existing clamp behavior (negatives clamp to 0).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './with-api-key.js';

const NON_DECIMAL = ['0x10', '1e1', '010', '+5', ' 5', '5 ', '5.0', '5e0'];
const NON_DECIMAL_OFFSETS = ['0x10', '010', '+2', '2.0', ' 2'];

describe('decimal integer literals on users routes', () => {
  test('non-decimal limit and offset spellings are rejected on both users routes', async () => {
    const app = buildApp([]);
    try {
      for (const route of ['/v1/users', '/v1/users/search-v2']) {
        for (const limit of NON_DECIMAL) {
          const res = await app.inject(`${route}?limit=${encodeURIComponent(limit)}`);
          assert.equal(res.statusCode, 400, `${route} limit=${JSON.stringify(limit)}`);
          assert.deepEqual(res.json(), { statusCode: 400, error: 'INVALID_QUERY' });
        }
        for (const offset of NON_DECIMAL_OFFSETS) {
          const res = await app.inject(`${route}?limit=2&offset=${encodeURIComponent(offset)}`);
          assert.equal(res.statusCode, 400, `${route} offset=${JSON.stringify(offset)}`);
          assert.deepEqual(res.json(), { statusCode: 400, error: 'INVALID_QUERY' });
        }
      }
    } finally {
      await app.close();
    }
  });

  test('decimal integers and the existing clamp behavior are unchanged', async () => {
    const app = buildApp([]);
    try {
      for (const route of ['/v1/users', '/v1/users/search-v2']) {
        const plain = await app.inject(`${route}?limit=2`);
        assert.equal(plain.statusCode, 200, route);
        const negative = await app.inject(`${route}?limit=-5&offset=-5`);
        assert.equal(negative.statusCode, 200, route);
      }
    } finally {
      await app.close();
    }
  });
});
