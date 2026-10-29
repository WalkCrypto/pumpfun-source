import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './with-api-key.js';
import { CalloutsStore } from '../src/callouts-store.js';
import { CalloutDiscussionsStore } from '../src/callout-discussions-store.js';

const NOW = '2026-01-01T00:00:00.000Z';

function calloutsStore(): CalloutsStore {
  return new CalloutsStore({
    schemaVersion: 1,
    dataSource: 'synthetic',
    observedAt: NOW,
    authors: [],
    callouts: [],
    updates: [],
  });
}

function discussionsStore(): CalloutDiscussionsStore {
  return new CalloutDiscussionsStore(
    {
      schemaVersion: 1,
      dataSource: 'synthetic',
      observedAt: NOW,
      complete: true,
      calloutIds: [],
      authors: [],
      replies: [],
    },
    calloutsStore(),
  );
}

test('callout error bodies carry the documented Error envelope statusCode', async () => {
  const app = buildApp([], {
    calloutsStore: calloutsStore(),
    calloutDiscussionsStore: discussionsStore(),
  });
  try {
    const cases: Array<[string, number, Record<string, unknown>]> = [
      // User-mint lookup: duplicate key, unknown key, bad limit, unsupported chain.
      ['/v1/callout/user/someone/mint/some-mint?quotesLimit=1&quotesLimit=2', 400, { statusCode: 400, error: 'BAD_REQUEST', reason: 'CALLOUT_LOOKUP_QUERY_INVALID' }],
      ['/v1/callout/user/someone/mint/some-mint?bogus=1', 501, { statusCode: 501, error: 'COMPATIBILITY_NOT_IMPLEMENTED', reason: 'CALLOUT_LOOKUP_QUERY_UNSUPPORTED' }],
      ['/v1/callout/user/someone/mint/some-mint?quotesLimit=99', 400, { statusCode: 400, error: 'BAD_REQUEST', reason: 'CALLOUT_LOOKUP_QUERY_INVALID' }],
      ['/v1/callout/user/someone/mint/some-mint?chain=solana', 501, { statusCode: 501, error: 'COMPATIBILITY_NOT_IMPLEMENTED', reason: 'CALLOUT_LOOKUP_QUERY_UNSUPPORTED' }],
      // Single callout: any query is unsupported.
      ['/v1/callout/some-callout?bogus=1', 501, { statusCode: 501, error: 'COMPATIBILITY_NOT_IMPLEMENTED', reason: 'CALLOUT_QUERY_UNSUPPORTED' }],
      // List: an invalid limit.
      ['/v1/callout/list/someone?limit=0', 400, { statusCode: 400, error: 'BAD_REQUEST', reason: 'CALLOUT_LIST_QUERY_INVALID' }],
      // Discussion chain: any query is unsupported.
      ['/v1/callout/replies/some-reply/chain?bogus=1', 501, { statusCode: 501, error: 'COMPATIBILITY_NOT_IMPLEMENTED', reason: 'CALLOUT_DISCUSSION_QUERY_UNSUPPORTED' }],
    ];
    for (const [url, status, body] of cases) {
      const res = await app.inject(url);
      assert.equal(res.statusCode, status, url);
      assert.deepEqual(res.json(), body);
    }
  } finally {
    await app.close();
  }
});
