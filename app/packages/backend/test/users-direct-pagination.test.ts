import test from 'node:test';
import assert from 'node:assert/strict';
import { UserStore } from '../src/users-store.js';

test('direct user reads clamp negative pagination like the route layer documents', () => {
  const store = new UserStore();
  const all = store.list({});
  assert.ok(all.length > 1);
  // search() defaults includeLabelledWallets to false, so its unfiltered
  // page is the list minus labelled rows; pagination behavior is the same.
  const searched = store.search({});
  for (const [read, expected] of [
    [(opts: { offset?: number; limit?: number }) => store.list(opts), all],
    [(opts: { offset?: number; limit?: number }) => store.search(opts), searched],
  ] as const) {
    assert.deepEqual(read({ offset: -1 }), expected);
    assert.deepEqual(read({ offset: -1, limit: 2 }), expected.slice(0, 2));
    assert.deepEqual(read({ limit: -1 }), []);
    assert.deepEqual(read({ offset: 1, limit: 1 }), expected.slice(1, 2));
  }
});

test('direct user reads reject unsafe or fractional pagination', () => {
  const store = new UserStore();
  for (const value of [NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    for (const read of [
      (opts: { offset?: number; limit?: number }) => store.list(opts),
      (opts: { offset?: number; limit?: number }) => store.search(opts),
    ]) {
      assert.throws(() => read({ limit: value }), /Invalid user pagination/);
      assert.throws(() => read({ offset: value }), /Invalid user pagination/);
    }
  }
});

test('direct user reads keep the default list-all behavior', () => {
  const store = new UserStore();
  assert.equal(store.list({}).length, store.list({ limit: undefined }).length);
  // search() still defaults includeLabelledWallets to false, so it keeps
  // excluding labelled rows; only the pagination default is unchanged.
  assert.deepEqual(store.search({}), store.search({ limit: undefined }));
  assert.ok(store.search({}).length < store.list({}).length);
});
