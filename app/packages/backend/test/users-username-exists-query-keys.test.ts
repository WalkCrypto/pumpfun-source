import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

test('the username-exists contract declares no query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const parameters = contract.paths['/users/username-exists/{username}'].get.parameters;
  assert.ok(parameters.every((parameter: { in: string }) => parameter.in === 'path'));
});

test('the username-exists read rejects undocumented query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    const list = (await app.inject('/v1/users')).json() as Record<string, unknown>[];
    const username = list.find((user) => typeof user.username === 'string' && user.username !== '')!.username as string;
    for (const query of ['limit=1', 'viewer=wallet-alice', '%6cimit=1']) {
      const res = await app.inject(`/v1/users/username-exists/${username}?${query}`);
      assert.equal(res.statusCode, 501, query);
      assert.deepEqual(res.json(), {
        statusCode: 501,
        error: 'COMPATIBILITY_NOT_IMPLEMENTED',
        reason: 'USERNAME_EXISTS_QUERY_UNSUPPORTED',
      });
    }
    const plain = await app.inject(`/v1/users/username-exists/${username}`);
    assert.equal(plain.statusCode, 200);
    assert.equal(plain.json().exists_flag, true);
    const repeated = await app.inject(`/v1/users/username-exists/${username}?limit=1&limit=2`);
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
