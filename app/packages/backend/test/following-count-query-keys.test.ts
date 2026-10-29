import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';
import { FollowingStore } from '../src/following-store.js';
import { UserStore } from '../src/users-store.js';

const SEED_USERS = [
  {
    address: '0xaaa', userId: 'user-001', username: 'alice_pump', profile_image: 'a.png',
    bio: 'a', followers: 1200, following: 340, x_username: 'alice',
  },
  {
    address: '0xbbb', userId: 'user-002', username: 'bob_degen', profile_image: 'b.png',
    bio: 'b', followers: 850, following: 120, x_username: null,
  },
  {
    address: '0xccc', userId: 'user-003', username: null, profile_image: null,
    bio: null, followers: 0, following: 5, x_username: null,
  },
];

const EDGES = [
  { follower_id: 'user-002', following_id: 'user-001', timestamp: 1000 },
  { follower_id: 'user-003', following_id: 'user-001', timestamp: 3000 },
  { follower_id: 'user-001', following_id: 'user-002', timestamp: 2000 },
];

function makeApp() {
  const users = new UserStore(SEED_USERS);
  return buildApp([], { userStore: users, followingStore: new FollowingStore(users, EDGES) });
}

test('the following-count contracts declare no query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  for (const path of [
    '/following/v3/followers/count/{userId}',
    '/following/v3/following/count/{userId}',
  ]) {
    const parameters = contract.paths[path].get.parameters;
    assert.ok(parameters.every((parameter: { in: string }) => parameter.in === 'path'), path);
  }
});

test('the following count reads reject undocumented query parameters instead of serving past them', async () => {
  const app = makeApp();
  try {
    for (const base of [
      '/v1/following/v3/followers/count/user-001',
      '/v1/following/v3/following/count/user-001',
    ]) {
      for (const query of ['limit=1', 'viewer=user-002', '%6cimit=1']) {
        const res = await app.inject(`${base}?${query}`);
        assert.equal(res.statusCode, 501, `${base}?${query}`);
        assert.deepEqual(res.json(), {
          statusCode: 501,
          error: 'COMPATIBILITY_NOT_IMPLEMENTED',
          reason: 'FOLLOW_COUNT_QUERY_UNSUPPORTED',
        });
      }
      const repeated = await app.inject(`${base}?limit=1&limit=2`);
      assert.equal(repeated.statusCode, 501);
      assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
    }
    assert.deepEqual((await app.inject('/v1/following/v3/followers/count/user-001')).json(), { count: 2 });
    assert.deepEqual((await app.inject('/v1/following/v3/following/count/user-001')).json(), { count: 1 });
  } finally {
    await app.close();
  }
});
