/**
 * Decimal integer literals on the following routes.
 *
 * The following list and search routes declare limit/offset as integers
 * and already reject empty, fractional and out-of-range values, but their
 * shared parseListPage funnels every value through Number(), which also
 * accepts non-decimal literals: limit=0x10 serves 16 rows, limit=1e1
 * serves 10, limit=010 serves 10, limit=+5 and a whitespace-padded limit
 * serve 5, and limit=5.0 serves 5 — all with 200. None of those spellings
 * is a decimal integer literal, and the repo's strict parsers (payouts,
 * positions, home-feed, callouts, user-trades) reject them all with a
 * decimal regex. Sibling of #1466 (posts) and #1481 (users), which reject
 * the same literals on their routes. Range and bounds checks are unchanged:
 * out-of-range decimal integers are still rejected with 400, not clamped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './with-api-key.js';

const NON_DECIMAL_LIMITS = ['0x10', '1e1', '010', '+5', ' 5', '5 ', '5.0', '5e0'];
const NON_DECIMAL_OFFSETS = ['0x10', '010', '+2', '2.0', ' 2'];

test('non-decimal pagination spellings are rejected on following list and search routes', async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  const routes = [
    '/v1/following/v3/followers/user-001',
    '/v1/following/v3/following/user-001',
    '/v1/following/v3/followers/search/user-001?searchTerm=al',
    '/v1/following/v3/following/search/user-001?searchTerm=al',
  ];
  for (const route of routes) {
    const separator = route.includes('?') ? '&' : '?';
    for (const limit of NON_DECIMAL_LIMITS) {
      const response = await app.inject({
        method: 'GET',
        url: `${route}${separator}limit=${encodeURIComponent(limit)}`,
      });
      assert.equal(response.statusCode, 400, `${route} limit=${JSON.stringify(limit)}`);
    }
    for (const offset of NON_DECIMAL_OFFSETS) {
      const response = await app.inject({
        method: 'GET',
        url: `${route}${separator}limit=2&offset=${encodeURIComponent(offset)}`,
      });
      assert.equal(response.statusCode, 400, `${route} offset=${JSON.stringify(offset)}`);
    }
  }
});

test('decimal pagination and existing range rejection are unchanged on following routes', async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  const plain = await app.inject({ method: 'GET', url: '/v1/following/v3/followers/user-001?limit=2' });
  assert.equal(plain.statusCode, 200);
  const outOfRange = await app.inject({ method: 'GET', url: '/v1/following/v3/followers/user-001?limit=1001' });
  assert.equal(outOfRange.statusCode, 400);
});
