/**
 * Empty list selections on the home-feed routes.
 *
 * The home-feed chains and assetClasses parameters are comma-separated
 * arrays with a maximum item count and no minimum in the captured
 * contract, so a client serializing an empty array sends chains= or
 * assetClasses=. Today both return 400 INVALID_QUERY_LIST, because the
 * shared list() splits the empty string into one empty item and rejects
 * it, instead of reading it as the valid empty selection — the same
 * shape open #1478 fixes for user-trades types=. An empty selection must
 * behave exactly like an absent one (no filter), while a trailing or
 * doubled comma, an unknown value, and a duplicate still fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './with-api-key.js';

const ROUTE = '/services/frontend/home-feed';

test('empty chains and assetClasses selections are accepted like absent ones', async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  const absent = await app.inject(ROUTE);
  assert.equal(absent.statusCode, 200);
  for (const query of ['chains=', 'assetClasses=', 'chains=&assetClasses=']) {
    const response = await app.inject(`${ROUTE}?${query}`);
    assert.equal(response.statusCode, 200, query);
    assert.deepEqual(response.json(), absent.json(), query);
  }
});

test('non-empty list validation is unchanged on home-feed routes', async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  for (const [query, code] of [
    ['chains=solana,', 'INVALID_QUERY_LIST'],
    ['chains=,solana', 'INVALID_QUERY_LIST'],
    ['chains=solana,solana', 'INVALID_QUERY_LIST'],
    ['chains=unknown', 'INVALID_QUERY_LIST'],
    ['assetClasses=coin,unknown', 'INVALID_QUERY_LIST'],
  ] as const) {
    const response = await app.inject(`${ROUTE}?${query}`);
    assert.equal(response.statusCode, 400, query);
    assert.equal(response.json().error, code, query);
  }
  const filtered = await app.inject(`${ROUTE}?chains=solana`);
  assert.equal(filtered.statusCode, 200);
});
