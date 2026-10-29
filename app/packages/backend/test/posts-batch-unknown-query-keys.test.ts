import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

const POST_1 = '00000000-0000-4000-8000-000000000001';
const POST_2 = '00000000-0000-4000-8000-000000000002';

test('the posts batch contract declares exactly one query parameter', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const parameters = contract.paths['/posts'].get.parameters;
  assert.deepEqual(
    parameters.map((parameter: { name: string }) => parameter.name),
    ['ids'],
  );
});

test('the posts batch rejects unknown query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    for (const query of [`ids=${POST_1}&bogus=1`, `ids=${POST_1}&limit=1`, `ids=${POST_1}&%62ogus=1`]) {
      const res = await app.inject(`/v1/posts?${query}`);
      assert.equal(res.statusCode, 400, query);
      assert.deepEqual(res.json(), {
        statusCode: 400,
        error: 'UNKNOWN_QUERY_PARAMETER',
        parameter: query.includes('%62ogus') ? 'bogus' : query.split('&')[1].split('=')[0],
      });
    }
    const single = await app.inject(`/v1/posts?ids=${POST_1}`);
    assert.equal(single.statusCode, 200);
    assert.equal(single.json().posts.length, 1);
    const repeated = await app.inject(`/v1/posts?ids=${POST_1}&ids=${POST_2}`);
    assert.equal(repeated.statusCode, 200);
    assert.equal(repeated.json().posts.length, 2);
    const missing = await app.inject('/v1/posts?bogus=1');
    assert.equal(missing.statusCode, 400);
    assert.deepEqual(missing.json(), {
      statusCode: 400,
      error: 'UNKNOWN_QUERY_PARAMETER',
      parameter: 'bogus',
    });
  } finally {
    await app.close();
  }
});
