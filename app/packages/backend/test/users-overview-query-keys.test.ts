import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

test('the users-overview contract declares no query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const parameters = contract.paths['/users/{id}/overview'].get.parameters;
  assert.ok(parameters.every((parameter: { in: string }) => parameter.in === 'path'));
});

test('the users-overview read rejects undocumented query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    const list = (await app.inject('/v1/users')).json() as Record<string, unknown>[];
    const addr = list[0].address as string;
    for (const query of ['limit=1', 'viewer=wallet-alice', '%6cimit=1']) {
      const res = await app.inject(`/v1/users/${addr}/overview?${query}`);
      assert.equal(res.statusCode, 501, query);
      assert.deepEqual(res.json(), {
        statusCode: 501,
        error: 'COMPATIBILITY_NOT_IMPLEMENTED',
        reason: 'USER_OVERVIEW_QUERY_UNSUPPORTED',
      });
    }
    const plain = await app.inject(`/v1/users/${addr}/overview`);
    assert.equal(plain.statusCode, 200);
    assert.equal(plain.json().address, addr);
    const repeated = await app.inject(`/v1/users/${addr}/overview?limit=1&limit=2`);
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
