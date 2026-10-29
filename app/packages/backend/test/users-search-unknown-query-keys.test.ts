import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

test('the users-search contract declares exactly six query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const parameters = contract.paths['/users/search-v2'].get.parameters;
  assert.deepEqual(
    parameters.map((parameter: { name: string }) => parameter.name).sort(),
    ['includeLabelledWallets', 'limit', 'offset', 'order', 'searchTerm', 'sort'],
  );
});

test('the users search rejects unknown query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    for (const query of ['bogus=1', 'address=wallet-alice', '%62ogus=1']) {
      const res = await app.inject(`/v1/users/search-v2?searchTerm=alice&${query}`);
      assert.equal(res.statusCode, 400, query);
      assert.deepEqual(res.json(), {
        statusCode: 400,
        error: 'UNKNOWN_QUERY_PARAMETER',
        parameter: query.startsWith('%') ? 'bogus' : query.split('=')[0],
      });
    }
    const plain = await app.inject('/v1/users/search-v2?searchTerm=alice&limit=3');
    assert.equal(plain.statusCode, 200);
    const repeated = await app.inject('/v1/users/search-v2?searchTerm=alice&searchTerm=bob');
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
