import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PostStore,
  SYNTHETIC_POSTS_SEED,
  type RawPost,
} from '../src/posts-store.js';

const COUNT_KEYS = ['likeCount', 'replyCount', 'repostCount', 'quoteCount'] as const;

function seedWithCount(
  key: (typeof COUNT_KEYS)[number],
  value: number,
): RawPost[] {
  const seed = structuredClone(SYNTHETIC_POSTS_SEED.slice(0, 1)) as RawPost[];
  seed[0][key] = value;
  return seed;
}

for (const key of COUNT_KEYS) {
  for (const bad of [NaN, Infinity, -Infinity]) {
    test(`rejects a nonfinite ${key} (${bad}) at construction`, () => {
      assert.throws(
        () => new PostStore(seedWithCount(key, bad)),
        (error: unknown) =>
          error instanceof TypeError &&
          (error as Error).message === `Post ${key} must be finite`,
      );
    });
  }
}

test('accepts finite counts', () => {
  const store = new PostStore(seedWithCount('likeCount', 7));
  assert.equal(store.getLivePost(SYNTHETIC_POSTS_SEED[0].postId)?.likeCount, 7);
});
