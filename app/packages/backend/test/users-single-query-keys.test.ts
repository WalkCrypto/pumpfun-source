import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

test('the users-by-id contract declares no query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const parameters = contract.paths['/users/{id}'].get.parameters;
  assert.ok(parameters.every((parameter: { in: string }) => parameter.in === 'path'));
});

test('the users-by-id read rejects undocumented query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    const list = (await app.inject('/v1/users')).json() as Record<string, unknown>[];
    const addr = list[0].address as string;
    for (const query of ['limit=1', 'viewer=wallet-alice', '%6cimit=1']) {
      const res = await app.inject(`/v1/users/${addr}?${query}`);
      assert.equal(res.statusCode, 501, query);
      assert.deepEqual(res.json(), {
        statusCode: 501,
        error: 'COMPATIBILITY_NOT_IMPLEMENTED',
        reason: 'USER_QUERY_UNSUPPORTED',
      });
    }
    const plain = await app.inject(`/v1/users/${addr}`);
    assert.equal(plain.statusCode, 200);
    assert.equal(plain.json().address, addr);
    const unknown = await app.inject('/v1/users/unknown-user?limit=1');
    assert.equal(unknown.statusCode, 501);
    const repeated = await app.inject(`/v1/users/${addr}?limit=1&limit=2`);
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
