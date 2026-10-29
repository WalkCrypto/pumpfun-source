/**
 * Decimal integer literals on the posts sub-resources.
 *
 * contracts/developer.openapi.json declares limit/offset as integers, and
 * the posts sub-resources already reject fractional, non-numeric and
 * non-finite values (#902). But the parser still funnels every value through
 * Number(), which also accepts non-decimal literals: limit=0x10 serves 16
 * rows, limit=1e1 serves 10, limit=010 serves 10, limit=+5 and a
 * whitespace-padded limit= 5  serve 5, and limit=5.0 serves 5 — all with
 * 200. None of those spellings is a decimal integer literal, and the repo's
 * strict parsers (payouts, positions, home-feed, callouts, user-trades)
 * reject them all with a decimal regex. Sibling of the frontend fix (#1307),
 * which rejects the same literals on /api/leaderboard and
 * /api/mayhem-screener. Out-of-range decimal integers keep the existing
 * clamp behavior.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './with-api-key.js';

const POST_1 = '00000000-0000-4000-8000-000000000001';

const NON_DECIMAL_LIMITS = ['0x10', '1e1', '010', '+5', ' 5', '5 ', '5.0', '5e0'];
const NON_DECIMAL_OFFSETS = ['0x10', '010', '+2', '2.0', ' 2'];

describe('decimal integer literals on posts sub-resources', () => {
  test('non-decimal limit spellings are rejected on replies and quotes', async () => {
    const app = buildApp([]);
    try {
      for (const relation of ['replies', 'quotes']) {
        for (const limit of NON_DECIMAL_LIMITS) {
          const res = await app.inject(`/v1/posts/${POST_1}/${relation}?limit=${encodeURIComponent(limit)}`);
          assert.equal(res.statusCode, 400, `${relation} limit=${JSON.stringify(limit)}`);
          assert.deepEqual(res.json(), { statusCode: 400, error: 'INVALID_LIMIT' });
        }
      }
    } finally {
      await app.close();
    }
  });

  test('non-decimal limit and offset spellings are rejected on likers and reposters', async () => {
    const app = buildApp([]);
    try {
      for (const relation of ['likers', 'reposters']) {
        for (const limit of NON_DECIMAL_LIMITS) {
          const res = await app.inject(`/v1/posts/${POST_1}/${relation}?limit=${encodeURIComponent(limit)}`);
          assert.equal(res.statusCode, 400, `${relation} limit=${JSON.stringify(limit)}`);
          assert.deepEqual(res.json(), { statusCode: 400, error: 'INVALID_LIMIT' });
        }
        for (const offset of NON_DECIMAL_OFFSETS) {
          const res = await app.inject(`/v1/posts/${POST_1}/${relation}?limit=2&offset=${encodeURIComponent(offset)}`);
          assert.equal(res.statusCode, 400, `${relation} offset=${JSON.stringify(offset)}`);
          assert.deepEqual(res.json(), { statusCode: 400, error: 'INVALID_OFFSET' });
        }
      }
    } finally {
      await app.close();
    }
  });

  test('decimal integers and the existing clamp behavior are unchanged', async () => {
    const app = buildApp([]);
    try {
      const replies = await app.inject(`/v1/posts/${POST_1}/replies?limit=2`);
      assert.equal(replies.statusCode, 200);
      const capped = await app.inject(`/v1/posts/${POST_1}/replies?limit=500`);
      assert.equal(capped.statusCode, 200);
      const likers = await app.inject(`/v1/posts/${POST_1}/likers?limit=2&offset=-5`);
      assert.equal(likers.statusCode, 200);
      assert.equal(likers.json().likers.length, 2);
      const zeroLimit = await app.inject(`/v1/posts/${POST_1}/likers?limit=0`);
      assert.equal(zeroLimit.statusCode, 200);
    } finally {
      await app.close();
    }
  });
});
