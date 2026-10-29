import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET as leaderboardGet } from '../packages/frontend/src/app/api/leaderboard/route.ts';
import { GET as mayhemGet } from '../packages/frontend/src/app/api/mayhem-screener/route.ts';

test('frontend leaderboard route rejects unknown query parameters', async () => {
  const response = await leaderboardGet(
    new Request('http://localhost/api/leaderboard?bogus=1'),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_QUERY');
});

test('frontend leaderboard route still serves known parameters', async () => {
  // No developer API key is configured in this environment, so a known-only
  // query reaches the offline failure instead of the unknown-key rejection.
  const response = await leaderboardGet(
    new Request('http://localhost/api/leaderboard'),
  );
  assert.equal(response.status, 503);
});

test('frontend mayhem route rejects unknown query parameters', async () => {
  const response = mayhemGet(
    new Request('http://localhost/api/mayhem-screener?bogus=1'),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'INVALID_MAYHEM_QUERY');
});

test('frontend mayhem route still serves known parameters', async () => {
  const response = mayhemGet(
    new Request('http://localhost/api/mayhem-screener'),
  );
  assert.equal(response.status, 503);
});
