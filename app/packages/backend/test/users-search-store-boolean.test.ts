import test from 'node:test';
import assert from 'node:assert/strict';
import { UserStore } from '../src/users-store.js';

test('direct users search flags are booleans rather than truthy values', () => {
  const store = new UserStore();
  for (const value of ['false', 'true', 0, 1, null]) {
    assert.throws(
      () => store.search({ includeLabelledWallets: value as never }),
      /includeLabelledWallets must be a boolean/,
    );
  }
  assert.doesNotThrow(() =>
    store.search({ includeLabelledWallets: false }),
  );
  assert.doesNotThrow(() =>
    store.search({ includeLabelledWallets: true }),
  );
});
