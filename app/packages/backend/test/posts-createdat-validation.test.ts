import test from 'node:test';
import assert from 'node:assert/strict';
import { PostStore } from '../src/posts-store.js';

const row = (postId, createdAt, parentPostId = null) => ({
  postId,
  authorId: 'user-001',
  kind: parentPostId ? 'reply' : 'root',
  content: 'x',
  mediaUrl: null,
  createdAt,
  parentPostId,
  rootPostId: null,
  quotedPostId: null,
  repostedPostId: null,
  likeCount: 0,
  replyCount: 0,
  repostCount: 0,
  quoteCount: 0,
  mentions: [],
  deleted: false,
});

test('post rows with an unparseable createdAt are rejected at construction', () => {
  assert.throws(
    () => new PostStore([row('p1', '2024-01-01T00:00:00.000Z'), row('p2', 'not-a-date')]),
    /Invalid post createdAt/,
  );
  assert.throws(
    () => new PostStore([row('p1', '   ')]),
    /Invalid post createdAt/,
  );
  assert.throws(
    () => new PostStore([row('p1', 123)]),
    /Invalid post createdAt/,
  );
});

test('null, empty and parseable createdAt values are still accepted', () => {
  assert.doesNotThrow(() => new PostStore([
    row('p1', null),
    row('p2', ''),
    row('p3', '2024-01-01T00:00:00.000Z'),
    row('p4', '2024-01-01'),
  ]));
});

test('valid replies still page through cursors in newest-first order', () => {
  const store = new PostStore([
    row('post-parent', '2024-01-01T00:00:00.000Z'),
    row('post-older', '2024-02-01T00:00:00.000Z', 'post-parent'),
    row('post-newer', '2024-06-01T00:00:00.000Z', 'post-parent'),
  ]);
  const page1 = store.getReplies('post-parent', { limit: 1 });
  assert.deepEqual(page1.replies.map((reply) => reply.postId), ['post-newer']);
  assert.ok(page1.nextCursor);
  const page2 = store.getReplies('post-parent', { cursor: page1.nextCursor, limit: 1 });
  assert.deepEqual(page2.replies.map((reply) => reply.postId), ['post-older']);
});
