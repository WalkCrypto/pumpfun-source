import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PostStore,
  SYNTHETIC_POSTS_SEED,
  type RawPost,
} from '../src/posts-store.js';

function seedWithKind(kind: unknown): RawPost[] {
  const seed = structuredClone(SYNTHETIC_POSTS_SEED.slice(0, 1)) as RawPost[];
  (seed[0] as unknown as { kind: unknown }).kind = kind;
  return seed;
}

test('a post with a kind outside the schema enum is rejected at construction', () => {
  for (const kind of ['bogus', 'REPOST', '', 0, undefined]) {
    assert.throws(
      () => new PostStore(seedWithKind(kind)),
      TypeError,
      `kind ${JSON.stringify(kind)}`,
    );
  }
});

test('every schema enum kind still constructs', () => {
  for (const kind of ['root', 'reply', 'quote', 'repost', null]) {
    assert.doesNotThrow(() => new PostStore(seedWithKind(kind)));
  }
});
