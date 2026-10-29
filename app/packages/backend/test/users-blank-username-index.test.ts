import test from 'node:test';
import assert from 'node:assert/strict';
import { UserStore } from '../src/users-store.js';
test('blank usernames do not alias the username-exists lookup', () => {
  const rows = new UserStore().list({});
  rows[0].username = '';
  const store = new UserStore(rows);
  assert.equal(store.usernameExists(''), false);
  // A real username on another row still resolves, case-insensitively.
  assert.equal(store.usernameExists(rows[1].username!.toUpperCase()), true);
  assert.equal(store.usernameExists('no-such-username'), false);
});
