import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CompetitionStore } from '../src/competitions-store.js';

function seed() {
  return JSON.parse(
    readFileSync(new URL('../src/competitions-seed.json', import.meta.url), 'utf8'),
  );
}

test('competition entries reject blank or non-string entryIds before indexing', () => {
  const blank = seed();
  blank[1].entries[0].entryId = '';
  assert.throws(() => new CompetitionStore(blank), /entryId/i);

  const nonString = seed();
  nonString[1].entries[0].entryId = 42;
  assert.throws(() => new CompetitionStore(nonString), /entryId/i);

  assert.doesNotThrow(() => new CompetitionStore(seed()));
});

test('a blank entryId is not addressable through entry detail on a valid store', () => {
  // Regression anchor for the pre-fix behavior: getEntryDetail('') returned
  // the blank row instead of null. After the constructor guard above, such
  // a store cannot be built, so the default seed must not resolve ''.
  const store = new CompetitionStore(seed());
  assert.equal(
    store.getEntryDetail('11111111-1111-4000-8000-000000000002', ''),
    null,
  );
  assert.equal(
    store.getEntryHighlights('11111111-1111-4000-8000-000000000002', ''),
    null,
  );
});
