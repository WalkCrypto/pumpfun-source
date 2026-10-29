import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

test('the remaining no-parameter operations declare no query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  assert.deepEqual(
    contract.paths['/profiles/verified'].get.parameters ?? [],
    [],
  );
  assert.deepEqual(
    contract.paths['/profiles/verified'].post.parameters ?? [],
    [],
  );
  assert.deepEqual(
    contract.paths['/users/batch'].post.parameters ?? [],
    [],
  );
});

test('the remaining no-parameter routes reject query keys instead of serving past them', async () => {
  const app = buildApp();
  try {
    // GET /v1/profiles/verified follows the no-parameter GET family: 501 with a reason.
    for (const query of ['bogus=1', '%62ogus=1']) {
      const res = await app.inject(`/v1/profiles/verified?${query}`);
      assert.equal(res.statusCode, 501, query);
      assert.deepEqual(res.json(), {
        statusCode: 501,
        error: 'COMPATIBILITY_NOT_IMPLEMENTED',
        reason: 'VERIFIED_PROFILES_QUERY_UNSUPPORTED',
      });
    }
    const verified = await app.inject('/v1/profiles/verified');
    assert.equal(verified.statusCode, 200);

    // Body-only POSTs follow the portfolio POST precedent: any query is a 400.
    for (const [route, payload] of [
      ['/v1/users/batch', { addresses: [] }],
      ['/v1/profiles/verified', { ids: ['wallet-1'] }],
    ] as const) {
      for (const query of ['bogus=1', '%62ogus=1']) {
        const res = await app.inject({ method: 'POST', url: `${route}?${query}`, payload });
        assert.equal(res.statusCode, 400, `${route}?${query}`);
        assert.deepEqual(res.json(), { statusCode: 400, error: 'INVALID_BODY' });
      }
    }
    const batch = await app.inject({ method: 'POST', url: '/v1/users/batch', payload: { addresses: [] } });
    assert.equal(batch.statusCode, 201);
    const postVerified = await app.inject({ method: 'POST', url: '/v1/profiles/verified', payload: { ids: ['wallet-1'] } });
    assert.equal(postVerified.statusCode, 201);
    const repeated = await app.inject('/v1/profiles/verified?bogus=1&bogus=2');
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
