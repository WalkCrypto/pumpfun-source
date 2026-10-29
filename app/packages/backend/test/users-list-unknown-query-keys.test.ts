import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

test('the users-list contract declares exactly four query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const parameters = contract.paths['/users'].get.parameters;
  assert.deepEqual(
    parameters.map((parameter: { name: string }) => parameter.name).sort(),
    ['limit', 'offset', 'order', 'sort'],
  );
});

test('the users list rejects unknown query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    for (const query of ['bogus=1', 'searchTerm=alice', '%62ogus=1']) {
      const res = await app.inject(`/v1/users?${query}`);
      assert.equal(res.statusCode, 400, query);
      assert.deepEqual(res.json(), {
        statusCode: 400,
        error: 'UNKNOWN_QUERY_PARAMETER',
        parameter: query.startsWith('%') ? 'bogus' : query.split('=')[0],
      });
    }
    const plain = await app.inject('/v1/users?sort=followers&order=desc&limit=2');
    assert.equal(plain.statusCode, 200);
    assert.equal(plain.json().length, 2);
    const repeated = await app.inject('/v1/users?limit=1&limit=2');
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
