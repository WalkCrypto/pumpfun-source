import test from 'node:test';
import assert from 'node:assert/strict';
import { FollowingStore } from '../src/following-store.js';
import { UserStore } from '../src/users-store.js';

test('follow edges reject blank or non-string endpoints before counting', () => {
  const users = new UserStore([]);
  for (const edge of [
    { follower_id: '', following_id: 'user-alice', timestamp: 100 },
    { follower_id: 'user-bob', following_id: '', timestamp: 100 },
    { follower_id: '', following_id: '', timestamp: 100 },
    { follower_id: 42, following_id: 'user-alice', timestamp: 100 },
    { follower_id: 'user-bob', following_id: null, timestamp: 100 },
  ]) {
    assert.throws(
      () => new FollowingStore(users, [edge as never]),
      /non-empty/i,
      JSON.stringify(edge),
    );
  }
});

test('valid edges still count and page the same account', () => {
  const users = new UserStore([
    {
      address: 'wallet-alice',
      userId: 'user-alice',
      username: 'Alice',
      profile_image: null,
      bio: null,
      followers: 0,
      following: 0,
      x_username: null,
    },
    {
      address: 'wallet-bob',
      userId: 'user-bob',
      username: 'Bob',
      profile_image: null,
      bio: null,
      followers: 0,
      following: 0,
      x_username: null,
    },
  ]);
  const store = new FollowingStore(users, [
    { follower_id: 'user-bob', following_id: 'user-alice', timestamp: 100 },
  ]);
  assert.equal(store.countFollowers('user-alice'), 1);
  assert.equal(store.followersOf('user-alice').length, 1);
});
