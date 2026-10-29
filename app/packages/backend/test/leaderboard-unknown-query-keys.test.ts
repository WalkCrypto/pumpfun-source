import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

test('the pnl-leaderboard contract declares exactly four query parameters', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const parameters = contract.paths['/pnl-leaderboard'].get.parameters;
  assert.deepEqual(
    parameters.map((parameter: { name: string }) => parameter.name).sort(),
    ['limit', 'period', 'positionsLimit', 'sort'],
  );
});

test('the pnl-leaderboard read rejects unknown query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    for (const query of ['bogus=1', 'perMemberLimit=2', '%62ogus=1']) {
      const res = await app.inject(`/v1/pnl-leaderboard?period=weekly&${query}`);
      assert.equal(res.statusCode, 400, query);
      assert.deepEqual(res.json(), {
        statusCode: 400,
        error: 'UNKNOWN_QUERY_PARAMETER',
        parameter: query.startsWith('%') ? 'bogus' : query.split('=')[0],
      });
    }
    const plain = await app.inject('/v1/pnl-leaderboard?period=weekly&limit=2&sort=realized&positionsLimit=1');
    assert.equal(plain.statusCode, 200);
    assert.equal(plain.json().entries.length, 2);
    const repeated = await app.inject('/v1/pnl-leaderboard?period=weekly&limit=1&limit=2');
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
