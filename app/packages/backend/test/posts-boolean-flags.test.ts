import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PostStore, type RawPost } from '../src/posts-store.js';

function sample(): RawPost {
  const seed = JSON.parse(
    readFileSync(new URL('../src/posts-seed.json', import.meta.url), 'utf8'),
  ) as RawPost[];
  return seed[0];
}

test('post seeds reject non-boolean deleted and hidden flags', () => {
  for (const field of ['deleted', 'hidden'] as const) {
    for (const value of ['false', 'true', 0, 1, null]) {
      const row = { ...sample(), [field]: value } as unknown as RawPost;
      assert.throws(
        () => new PostStore([row]),
        /boolean/i,
        `${field}: ${String(value)}`,
      );
    }
  }
});

test('a string false flag no longer hides a live post, and real flags still work', () => {
  const live = sample();
  const store = new PostStore([{ ...live, deleted: false, hidden: false }]);
  assert.equal(store.getLivePost(live.postId)?.postId, live.postId);
  const hidden = new PostStore([{ ...live, hidden: true }]);
  assert.equal(hidden.getLivePost(live.postId), undefined);
  const deleted = new PostStore([{ ...live, deleted: true }]);
  assert.equal(deleted.getLivePost(live.postId), undefined);
});
