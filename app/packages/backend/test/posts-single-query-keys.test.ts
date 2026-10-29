import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

const POST_1 = '00000000-0000-4000-8000-000000000001';
const UNKNOWN_POST = '00000000-0000-4000-8000-000000000999';

test('the single-post contract declares no query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const parameters = contract.paths['/posts/{postId}'].get.parameters;
  assert.ok(parameters.every((parameter: { in: string }) => parameter.in === 'path'));
});

test('the single-post read rejects undocumented query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    for (const query of ['limit=1', 'viewer=wallet-alice', '%6cimit=1']) {
      const res = await app.inject(`/v1/posts/${POST_1}?${query}`);
      assert.equal(res.statusCode, 501, query);
      assert.deepEqual(res.json(), {
        statusCode: 501,
        error: 'COMPATIBILITY_NOT_IMPLEMENTED',
        reason: 'POST_QUERY_UNSUPPORTED',
      });
    }
    const plain = await app.inject(`/v1/posts/${POST_1}`);
    assert.equal(plain.statusCode, 200);
    assert.equal(plain.json().post.postId, POST_1);
    const unknown = await app.inject(`/v1/posts/${UNKNOWN_POST}?limit=1`);
    assert.equal(unknown.statusCode, 501);
    const repeated = await app.inject(`/v1/posts/${POST_1}?limit=1&limit=2`);
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
