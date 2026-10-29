import test from 'node:test';
import assert from 'node:assert/strict';
import { UserStore, type User } from '../src/users-store.js';

function sample(): User {
  return new UserStore().list({})[0];
}

test('user seeds reject kinds outside the person|group enum', () => {
  for (const kind of ['bogus', '', 'PERSON', 'Group', 42, null, true]) {
    const row = { ...sample(), kind: kind as unknown as User['kind'] };
    assert.throws(
      () => new UserStore([row]),
      /kind/i,
      `kind: ${String(kind)}`,
    );
  }
});

test('absent and valid user kinds are retained', () => {
  const absent = sample();
  delete absent.kind;
  assert.doesNotThrow(() => new UserStore([absent]));
  assert.equal(new UserStore([absent]).list({})[0].kind, undefined);
  for (const kind of ['person', 'group'] as const) {
    const row = { ...sample(), kind };
    assert.equal(new UserStore([row]).list({})[0].kind, kind);
  }
});
