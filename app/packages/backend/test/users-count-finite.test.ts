import test from 'node:test';
import assert from 'node:assert/strict';
import { UserStore, type User } from '../src/users-store.js';
import seed from '../src/users-seed.json' with { type: 'json' };

function userWithCount(field: 'followers' | 'following', value: unknown): User[] {
  const user = structuredClone(seed[0]) as unknown as Record<string, unknown>;
  user[field] = value;
  return [user as unknown as User];
}

test('user follower and following counts must be finite numbers, like the posts counts', () => {
  for (const field of ['followers', 'following'] as const) {
    for (const value of ['1200', null, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => new UserStore(userWithCount(field, value)),
        /finite/i,
        `${field} = ${String(value)}`,
      );
    }
  }
});

test('finite user counts, including zero, remain accepted', () => {
  for (const field of ['followers', 'following'] as const) {
    assert.doesNotThrow(() => new UserStore(userWithCount(field, 0)));
    assert.doesNotThrow(() => new UserStore(userWithCount(field, 1200)));
  }
  assert.doesNotThrow(() => new UserStore());
});
