import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

const LIVE_ID = '11111111-1111-4000-8000-000000000002';
const LIVE_ENTRY_1 = '22222222-2222-4000-8000-000000000001';

test('the competitions parameterized contracts declare their query parameters', () => {
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
  assert.deepEqual(queryNames('/competitions/{id}/entries/{entryId}/highlights'), ['limit']);
  assert.deepEqual(queryNames('/competitions/{id}/highlights'), ['limit', 'perMemberLimit']);
  assert.deepEqual(queryNames('/competitions/{idOrSlug}'), ['limit', 'positionsLimit']);
});

test('the competitions parameterized reads reject unknown query parameters instead of serving past them', async () => {
  const app = buildApp([]);
  try {
    const cases: Array<[string, string, string]> = [
      [`/v1/competitions/${LIVE_ID}/entries/${LIVE_ENTRY_1}/highlights`, 'limit=1&bogus=1', 'bogus'],
      [`/v1/competitions/${LIVE_ID}/entries/${LIVE_ENTRY_1}/highlights`, 'limit=1&%62ogus=1', 'bogus'],
      [`/v1/competitions/${LIVE_ID}/highlights`, 'limit=1&positionsLimit=2', 'positionsLimit'],
      [`/v1/competitions/${LIVE_ID}`, 'limit=1&perMemberLimit=2', 'perMemberLimit'],
    ];
    for (const [base, query, expected] of cases) {
      const res = await app.inject(`${base}?${query}`);
      assert.equal(res.statusCode, 400, `${base}?${query}`);
      assert.deepEqual(res.json(), {
        statusCode: 400,
        error: 'UNKNOWN_QUERY_PARAMETER',
        parameter: expected,
      });
    }
    const highlights = await app.inject(`/v1/competitions/${LIVE_ID}/highlights?limit=10&perMemberLimit=2`);
    assert.equal(highlights.statusCode, 200);
    const board = await app.inject(`/v1/competitions/${LIVE_ID}?limit=10&positionsLimit=3`);
    assert.equal(board.statusCode, 200);
    const repeated = await app.inject(`/v1/competitions/${LIVE_ID}?limit=1&limit=2`);
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
