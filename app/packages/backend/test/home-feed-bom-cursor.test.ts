import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import seed from '../src/home-feed-seed.json' with { type: 'json' };
import {
  HomeFeedStore,
  HomeFeedCursorError,
} from '../src/home-feed-store.js';

// Home-feed cursors use a public checksum, not an authentication secret: a
// client can recompute it for any body, so the body itself must be canonical.
function withBomPrefix(token: string): string {
  const [body] = token.split('.');
  const raw = Buffer.from(body, 'base64url');
  const bomBody = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    raw,
  ]).toString('base64url');
  const digest = createHash('sha256')
    .update('pump-local-home-feed-cursor-v1\0')
    .update(bomBody)
    .digest()
    .subarray(0, 16)
    .toString('base64url');
  return `${bomBody}.${digest}`;
}

test('home-feed cursor decoding rejects a UTF-8 BOM added to a valid payload', () => {
  const store = new HomeFeedStore(structuredClone(seed));
  const filters = { chains: [], assetClasses: [] };
  const first = store.newest({ filters, pageSize: 1 });
  assert.ok(first.nextPageToken);
  assert.equal(
    store.newest({ filters, pageSize: 1, pageToken: first.nextPageToken })
      .coins.length,
    1,
  );
  assert.throws(
    () =>
      store.newest({
        filters,
        pageSize: 1,
        pageToken: withBomPrefix(first.nextPageToken!),
      }),
    HomeFeedCursorError,
  );
});
