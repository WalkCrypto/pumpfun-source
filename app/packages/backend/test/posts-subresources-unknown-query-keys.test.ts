import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

const POST_1 = '00000000-0000-4000-8000-000000000001';

test('the posts sub-resource contracts declare their query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const queryNames = (path: string) =>
    contract.paths[path].get.parameters
      .filter((parameter: { in: string }) => parameter.in === 'query')
      .map((parameter: { name: string }) => parameter.name)
      .sort();
  assert.deepEqual(queryNames('/posts/{postId}/replies'), ['cursor', 'limit']);
  assert.deepEqual(queryNames('/posts/{postId}/quotes'), ['cursor', 'limit']);
  assert.deepEqual(queryNames('/posts/{postId}/likers'), ['limit', 'offset']);
  assert.deepEqual(queryNames('/posts/{postId}/reposters'), ['limit', 'offset']);
});

test('the posts sub-resources reject unknown query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    const cases: Array<[string, string, string]> = [
      [`/v1/posts/${POST_1}/replies`, 'limit=1&bogus=1', 'bogus'],
      [`/v1/posts/${POST_1}/replies`, 'limit=1&%62ogus=1', 'bogus'],
      [`/v1/posts/${POST_1}/quotes`, 'bogus=1', 'bogus'],
      [`/v1/posts/${POST_1}/likers`, 'limit=1&cursor=abc', 'cursor'],
      [`/v1/posts/${POST_1}/reposters`, 'offset=0&sort=recent', 'sort'],
    ];
    for (const [base, query, expected] of cases) {
      const res = await app.inject(`${base}?${query}`);
      assert.equal(res.statusCode, 400, `${base}?${query}`);
      assert.deepEqual(res.json(), {
        statusCode: 400,
        error: 'UNKNOWN_QUERY_PARAMETER',
        parameter: expected,
      });
    }
    const replies = await app.inject(`/v1/posts/${POST_1}/replies?limit=1`);
    assert.equal(replies.statusCode, 200);
    const likers = await app.inject(`/v1/posts/${POST_1}/likers?limit=2&offset=0`);
    assert.equal(likers.statusCode, 200);
    const repeated = await app.inject(`/v1/posts/${POST_1}/replies?limit=1&limit=2`);
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
