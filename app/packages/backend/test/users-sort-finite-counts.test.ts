import test from 'node:test';
import assert from 'node:assert/strict';
import { UserStore, type User } from '../src/users-store.js';

const user = (address: string, over: Partial<User>): User => ({
  address,
  username: address,
  profile_image: null,
  bio: null,
  followers: 0,
  following: 0,
  x_username: null,
  ...over,
});

test('user seeds reject nonfinite sort-key counts before ranking or serialization', () => {
  for (const key of ['followers', 'following'] as const) {
    for (const value of [NaN, Infinity, -Infinity]) {
      assert.throws(
        () => new UserStore([user('synthetic-a', { [key]: value })]),
        /must be finite/,
        `${key}: ${value}`,
      );
    }
  }
});

test('a NaN follower count no longer heads a descending followers sort', () => {
  // On base, the NaN row sorted first in descending order (the comparator
  // returned NaN, treated as equal) and serialized its count as JSON null.
  assert.throws(
    () =>
      new UserStore([
        user('synthetic-nan', { followers: NaN }),
        user('synthetic-real', { followers: 100 }),
      ]),
    /followers must be finite/,
  );
  const store = new UserStore([
    user('synthetic-low', { followers: 10 }),
    user('synthetic-high', { followers: 100 }),
  ]);
  assert.deepEqual(
    store.list({ sort: 'followers', order: 'desc' }).map((u) => u.followers),
    [100, 10],
  );
  assert.equal(
    JSON.parse(JSON.stringify(store.list({ sort: 'followers' })[0])).followers,
    10,
  );
});
