import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

// Synthetic format samples only; these are not issued or verified credentials.
const key = `pf_live_${'A'.repeat(49)}`;

test('the credential-ambiguity rejection carries the documented Error envelope statusCode', async (t) => {
  const app = buildApp([]);
  t.after(() => app.close());
  // Two credential sources at once: the gate must fail closed before any handler.
  const response = await app.inject({
    url: '/v1/users',
    headers: { authorization: `Bearer ${key}`, 'x-api-key': key },
  });
  assert.equal(response.statusCode, 501);
  assert.deepEqual(response.json(), {
    statusCode: 501,
    error: 'COMPATIBILITY_NOT_IMPLEMENTED',
    reason: 'API_CREDENTIAL_AMBIGUITY_UNQUALIFIED',
  });
});
