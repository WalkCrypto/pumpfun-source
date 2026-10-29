/**
 * Decimal integer literals on the competitions routes.
 *
 * The competitions routes declare limit/positionsLimit/perMemberLimit as
 * integers and already reject fractional, non-numeric and non-finite
 * values, but their shared rejectInvalidNumbers funnels every value
 * through Number(), which also accepts non-decimal literals: limit=0x10
 * serves 16 rows, limit=1e1 serves 10, limit=010 serves 10, limit=+5 and
 * a whitespace-padded limit serve 5, and limit=5.0 serves 5 — all with
 * 200. None of those spellings is a decimal integer literal, and the
 * repo's strict parsers (payouts, positions, home-feed, callouts,
 * user-trades) reject them all with a decimal regex. Sibling of #1466
 * (posts), #1481 (users), #1484 (following) and #1485 (leaderboard),
 * which reject the same literals on their routes. Integer clamping is
 * unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './with-api-key.js';

const competition = '/v1/competitions/11111111-1111-4000-8000-000000000002';
const NON_DECIMAL = ['0x10', '1e1', '010', '+5', ' 5', '5 ', '5.0', '5e0'];
for (const [path, keys] of [
  [competition, ['limit', 'positionsLimit']],
  [competition + '/highlights', ['limit', 'perMemberLimit']],
  [competition + '/entries/22222222-2222-4000-8000-000000000001/highlights', ['limit']],
] as const) {
  test(`competition numeric parameters reject non-decimal literals: ${path}`, async () => {
    const app = buildApp();
    try {
      for (const key of keys) for (const value of NON_DECIMAL) {
        const response = await app.inject(path + '?' + new URLSearchParams({ [key]: value }));
        assert.equal(response.statusCode, 400, `${key}=${value}`);
        assert.equal(response.json().error, 'INVALID_QUERY');
      }
    } finally { await app.close(); }
  });
}
test('integer competition values retain existing clamping', async () => {
  const app = buildApp();
  try {
    const response = await app.inject(competition + '?limit=0&positionsLimit=99');
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().leaderboard.entries, []);
    const clamped = await app.inject(competition + '/highlights?limit=999&perMemberLimit=99');
    assert.equal(clamped.statusCode, 200);
  } finally { await app.close(); }
});
