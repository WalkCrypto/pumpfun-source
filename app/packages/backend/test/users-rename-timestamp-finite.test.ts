import test from 'node:test';
import assert from 'node:assert/strict';
import { UserStore, type User } from '../src/users-store.js';
import seed from '../src/users-seed.json' with { type: 'json' };

function userWithRenameTimestamp(value: unknown): User[] {
  const user = structuredClone(seed[0]) as unknown as Record<string, unknown>;
  user.last_username_update_timestamp = value;
  return [user as unknown as User];
}

test('the last username-change timestamp must be null or a finite number, like the user counts', () => {
  for (const value of ['1700000000000', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => new UserStore(userWithRenameTimestamp(value)),
      /finite/i,
      `last_username_update_timestamp = ${String(value)}`,
    );
  }
});

test('null, absent, and finite rename timestamps remain accepted', () => {
  assert.doesNotThrow(() => new UserStore(userWithRenameTimestamp(null)));
  assert.doesNotThrow(() => new UserStore(userWithRenameTimestamp(1700000000000)));
  const user = structuredClone(seed[0]) as unknown as Record<string, unknown>;
  delete user.last_username_update_timestamp;
  assert.doesNotThrow(() => new UserStore([user as unknown as User]));
  assert.doesNotThrow(() => new UserStore());
});
