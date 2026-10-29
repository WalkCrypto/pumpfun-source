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

test('the following parameterized contracts declare their query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const queryNames = (path: string) =>
    contract.paths[path].get.parameters
      .filter((parameter: { in: string }) => parameter.in === 'query')
      .map((parameter: { name: string }) => parameter.name)
      .sort();
  assert.deepEqual(queryNames('/following/v3/followers/{userId}'), ['limit', 'offset', 'sort']);
  assert.deepEqual(queryNames('/following/v3/following/{userId}'), ['limit', 'offset', 'sort']);
  assert.deepEqual(queryNames('/following/v3/followers/search/{userId}'), ['limit', 'offset', 'searchTerm']);
  assert.deepEqual(queryNames('/following/v3/following/search/{userId}'), ['limit', 'offset', 'searchTerm']);
  assert.deepEqual(queryNames('/following/single/{id}'), ['userId']);
});

test('the following parameterized reads reject unknown query parameters instead of serving past them', async () => {
  const app = makeApp();
  try {
    const cases: Array<[string, string]> = [
      ['/v1/following/v3/followers/user-001', 'bogus=1'],
      ['/v1/following/v3/following/user-001', 'bogus=1'],
      ['/v1/following/v3/followers/user-001', '%62ogus=1'],
      ['/v1/following/v3/followers/search/user-001', 'searchTerm=alice&sort=recent'],
      ['/v1/following/v3/following/search/user-001', 'searchTerm=alice&bogus=1'],
      ['/v1/following/single/user-001', 'userId=user-002&bogus=1'],
    ];
    for (const [base, query] of cases) {
      const res = await app.inject(`${base}?${query}`);
      assert.equal(res.statusCode, 400, `${base}?${query}`);
      assert.deepEqual(res.json(), {
        statusCode: 400,
        error: 'UNKNOWN_QUERY_PARAMETER',
        parameter: query.startsWith('%') ? 'bogus' : query.split('&').find((part) => part.split('=')[0] !== 'searchTerm' && part.split('=')[0] !== 'userId')!.split('=')[0],
      });
    }
    const page = await app.inject('/v1/following/v3/followers/user-001?limit=1&sort=recent');
    assert.equal(page.statusCode, 200);
    const search = await app.inject('/v1/following/v3/followers/search/user-001?searchTerm=alice');
    assert.equal(search.statusCode, 200);
    const single = await app.inject('/v1/following/single/user-001?userId=user-002');
    assert.equal(single.statusCode, 200);
    const repeated = await app.inject('/v1/following/v3/followers/user-001?limit=1&limit=2');
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
