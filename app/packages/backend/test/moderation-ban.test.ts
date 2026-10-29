import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from './with-api-key.js';

const BANNED_ADDRESS = '2n3fS1TX1Cy6dqLKMmMwBjVYMQH3WHGX4HGEvHureXkf'; // user-005, is_banned in the seed
const CLEAN_ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'; // user-001

test('the moderation ban contract returns a bare boolean, never null', () => {
  const contract = JSON.parse(
    readFileSync(
      new URL('../../../contracts/developer.openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const operation = contract.paths['/moderation/ban/address/{address}'].get;
  assert.equal(operation.responses['200'].content['application/json'].schema.type, 'boolean');
  assert.match(
    operation.responses['200'].content['application/json'].schema.description,
    /Never null/,
  );
  assert.deepEqual(
    operation.parameters.map((parameter: { name: string }) => parameter.name),
    ['address'],
  );
});

test('the native moderation ban read serves ban state from the user store', async () => {
  const app = buildApp();
  try {
    const banned = await app.inject(`/v1/moderation/ban/address/${BANNED_ADDRESS}`);
    assert.equal(banned.statusCode, 200);
    assert.equal(banned.json(), true);

    const clean = await app.inject(`/v1/moderation/ban/address/${CLEAN_ADDRESS}`);
    assert.equal(clean.statusCode, 200);
    assert.equal(clean.json(), false);

    // Unknown addresses read as false, never 404 or null.
    const unknown = await app.inject('/v1/moderation/ban/address/11111111111111111111111111111111');
    assert.equal(unknown.statusCode, 200);
    assert.equal(unknown.json(), false);

    // A user id is not a wallet address: it must not read as its owner's ban state.
    const userId = await app.inject('/v1/moderation/ban/address/user-005');
    assert.equal(userId.statusCode, 200);
    assert.equal(userId.json(), false);

    const queried = await app.inject(`/v1/moderation/ban/address/${CLEAN_ADDRESS}?bogus=1`);
    assert.equal(queried.statusCode, 501);
    assert.deepEqual(queried.json(), {
      statusCode: 501,
      error: 'COMPATIBILITY_NOT_IMPLEMENTED',
      reason: 'MODERATION_BAN_QUERY_UNSUPPORTED',
    });

    const repeated = await app.inject(`/v1/moderation/ban/address/${CLEAN_ADDRESS}?bogus=1&bogus=2`);
    assert.equal(repeated.statusCode, 501);
    assert.deepEqual(repeated.json(), { error: 'DUPLICATE_QUERY_KEYS_UNIMPLEMENTED' });
  } finally {
    await app.close();
  }
});
