import test from 'node:test';
import assert from 'node:assert/strict';
import { PostStore, type RawPost } from '../src/posts-store.js';
import seed from '../src/posts-seed.json' with { type: 'json' };

function postWithCount(field: 'likeCount' | 'replyCount' | 'repostCount' | 'quoteCount', value: unknown): RawPost[] {
  const post = structuredClone(seed[0]) as unknown as Record<string, unknown>;
  post[field] = value;
  return [post as unknown as RawPost];
}

test('post counts must be finite numbers, like the other stores finite-check their measures', () => {
  for (const field of ['likeCount', 'replyCount', 'repostCount', 'quoteCount'] as const) {
    for (const value of ['5', null, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => new PostStore(postWithCount(field, value)),
        /finite/i,
        `${field} = ${String(value)}`,
      );
    }
  }
});

test('finite post counts, including zero, remain accepted', () => {
  for (const field of ['likeCount', 'replyCount', 'repostCount', 'quoteCount'] as const) {
    assert.doesNotThrow(() => new PostStore(postWithCount(field, 0)));
    assert.doesNotThrow(() => new PostStore(postWithCount(field, 42)));
  }
  assert.doesNotThrow(() => new PostStore());
});
